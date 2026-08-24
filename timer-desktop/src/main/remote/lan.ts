import { createSocket } from "node:dgram";
import { networkInterfaces } from "node:os";

function fromOs(): string[] {
  const nets = networkInterfaces();
  const out: string[] = [];
  for (const list of Object.values(nets)) {
    for (const n of list ?? []) {
      const family = n.family === "IPv4" || String(n.family) === "4";
      if (!family || n.internal) continue;
      if (!n.address || n.address.startsWith("169.254.")) continue;
      if (!out.includes(n.address)) out.push(n.address);
    }
  }
  const rank = (ip: string) => {
    if (ip.startsWith("192.168.")) return 0;
    if (ip.startsWith("10.")) return 1;
    if (ip.startsWith("172.")) return 2;
    return 3;
  };
  return out.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
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
