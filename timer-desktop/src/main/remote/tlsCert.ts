import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { X509Certificate } from "node:crypto";
import { generate as generateSelfSigned } from "selfsigned";

export type RemoteTlsMaterial = {
  key: string;
  cert: string;
};

/** SAN/재발급 전략이 바뀌면 올린다. 옛 인증서(localhost만)를 강제 교체. */
const CERT_GEN = 3;

type CertMeta = {
  gen: number;
  ips: string[];
};

function tlsDir(): string {
  return join(app.getPath("userData"), "remote-tls");
}

function metaPath(): string {
  return join(tlsDir(), "meta.json");
}

function readMeta(): CertMeta | null {
  try {
    const raw = JSON.parse(readFileSync(metaPath(), "utf8")) as CertMeta;
    if (!raw || typeof raw.gen !== "number" || !Array.isArray(raw.ips)) return null;
    return raw;
  } catch {
    return null;
  }
}

function sameIpSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort().join(",");
  const sb = [...b].sort().join(",");
  return sa === sb;
}

function buildAltNames(ips: string[]) {
  const altNames: Array<{ type: 2; value: string } | { type: 7; ip: string }> = [
    { type: 2, value: "localhost" },
    { type: 7, ip: "127.0.0.1" },
  ];
  const seen = new Set(["127.0.0.1"]);
  for (const ip of ips) {
    const v = ip.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    altNames.push({ type: 7, ip: v });
  }
  return altNames;
}

async function generateTls(ips: string[]): Promise<RemoteTlsMaterial> {
  const notBeforeDate = new Date();
  const notAfterDate = new Date(notBeforeDate);
  notAfterDate.setFullYear(notAfterDate.getFullYear() + 10);

  const pems = await generateSelfSigned([{ name: "commonName", value: "MNF Timer Remote" }], {
    keySize: 2048,
    algorithm: "sha256",
    notBeforeDate,
    notAfterDate,
    extensions: [
      { name: "basicConstraints", cA: false },
      {
        name: "keyUsage",
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: "extKeyUsage",
        serverAuth: true,
      },
      {
        name: "subjectAltName",
        altNames: buildAltNames(ips),
      },
    ],
  });

  return { key: pems.private, cert: pems.cert };
}

/**
 * 폰 리모컨용 자체 서명 인증서.
 * 접속 LAN IP를 SAN에 넣어야 iOS Safari에서 "웹사이트 방문"이 통과된다.
 * (localhost만 있으면 아이폰에서 경고 후 넘어가지 않음)
 */
export async function loadOrCreateRemoteTls(lanIps: string[] = []): Promise<RemoteTlsMaterial> {
  const dir = tlsDir();
  mkdirSync(dir, { recursive: true });
  const keyPath = join(dir, "key.pem");
  const certPath = join(dir, "cert.pem");
  const ips = [...new Set(lanIps.map((ip) => ip.trim()).filter(Boolean))];
  const meta = readMeta();

  const canReuse =
    existsSync(keyPath) &&
    existsSync(certPath) &&
    meta != null &&
    meta.gen === CERT_GEN &&
    sameIpSet(meta.ips, ips);

  if (canReuse) {
    return {
      key: readFileSync(keyPath, "utf8"),
      cert: readFileSync(certPath, "utf8"),
    };
  }

  const material = await generateTls(ips);
  writeFileSync(keyPath, material.key, "utf8");
  writeFileSync(certPath, material.cert, "utf8");
  writeFileSync(metaPath(), JSON.stringify({ gen: CERT_GEN, ips } satisfies CertMeta, null, 2), "utf8");
  console.log(`[remote] TLS 인증서 발급 SAN ips=${ips.join(",") || "(none)"}`);
  return material;
}

/** iOS 설정에 설치할 DER(.cer) 바이트. */
export function remoteTlsCertDer(): Buffer | null {
  const certPath = join(tlsDir(), "cert.pem");
  if (!existsSync(certPath)) return null;
  try {
    const pem = readFileSync(certPath, "utf8");
    const x509 = new X509Certificate(pem);
    return x509.raw;
  } catch (e) {
    console.warn("[remote] cert DER 변환 실패", e);
    return null;
  }
}
