import { createSocket } from "node:dgram";
import { networkInterfaces } from "node:os";

const VIRTUAL_IFACE = /^(lo|bridge|awdl|llw|gif|stf|utun|vmnet|vboxnet|docker|veth|tap|tun|ppp|pktap)/i;

function interfaceRank(name: string, ip: string): number {
  if (/^en0$/i.test(name) && ip.startsWith("192.168.")) return 0;
  if (/^(en|wlan|wifi)/i.test(name) && ip.startsWith("192.168.")) return 1;
  if (ip.startsWith("192.168.")) return 2;
  if (ip.startsWith("10.")) return 3;
  if (ip.startsWith("172.")) return 4;
  return 5;
}

function fromOs(): string[] {
  const nets = networkInterfaces();
  const scored: Array<{ ip: string; rank: number }> = [];
  const seen = new Set<string>();
  for (const [name, list] of Object.entries(nets)) {
    if (VIRTUAL_IFACE.test(name)) continue;
    for (const n of list ?? []) {
      const family = n.family === "IPv4" || String(n.family) === "4";
      if (!family || n.internal) continue;
      if (!n.address || n.address.startsWith("169.254.")) continue;
      if (seen.has(n.address)) continue;
      seen.add(n.address);
      scored.push({ ip: n.address, rank: interfaceRank(name, n.address) });
    }
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.ip.localeCompare(b.ip))
    .map((row) => row.ip);
}

function guessOutboundIPv4(): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = createSocket("udp4");
    const done = (ip: string | null) => {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      resolve(ip);
    };
    const timer = setTimeout(() => done(null), 400);
    socket.once("error", () => {
      clearTimeout(timer);
      done(null);
    });
    try {
      socket.connect(53, "1.1.1.1", () => {
        clearTimeout(timer);
        try {
          const addr = socket.address();
          const ip = typeof addr === "object" && "address" in addr ? addr.address : null;
          done(ip && !ip.startsWith("127.") && !ip.startsWith("169.254.") ? ip : null);
        } catch {
          done(null);
        }
      });
    } catch {
      clearTimeout(timer);
      done(null);
    }
  });
}

export async function listLanIPv4(): Promise<string[]> {
  const osList = fromOs();
  const guessed = await guessOutboundIPv4();
  const out = [...osList];
  if (guessed && !out.includes(guessed)) out.unshift(guessed);
  return out;
}
