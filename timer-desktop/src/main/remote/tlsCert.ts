import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generate as generateSelfSigned } from "selfsigned";

export type RemoteTlsMaterial = {
  key: string;
  cert: string;
};

/**
 * 폰 리모컨용 자체 서명 인증서.
 * HTTPS여야 이미지 클립보드/시스템 공유 API가 동작한다.
 * (최초 접속 시 브라우저 경고 → 고급 → 계속 한 번 허용)
 */
export async function loadOrCreateRemoteTls(): Promise<RemoteTlsMaterial> {
  const dir = join(app.getPath("userData"), "remote-tls");
  const keyPath = join(dir, "key.pem");
  const certPath = join(dir, "cert.pem");

  if (existsSync(keyPath) && existsSync(certPath)) {
    return {
      key: readFileSync(keyPath, "utf8"),
      cert: readFileSync(certPath, "utf8"),
    };
  }

  mkdirSync(dir, { recursive: true });
  const notBeforeDate = new Date();
  const notAfterDate = new Date(notBeforeDate);
  notAfterDate.setFullYear(notAfterDate.getFullYear() + 10);

  const pems = await generateSelfSigned([{ name: "commonName", value: "MNF Timer Remote" }], {
    keySize: 2048,
    algorithm: "sha256",
    notBeforeDate,
    notAfterDate,
    extensions: [
      { name: "basicConstraints", cA: true },
      {
        name: "keyUsage",
        keyCertSign: true,
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: "extKeyUsage",
        serverAuth: true,
      },
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
        ],
      },
    ],
  });

  writeFileSync(keyPath, pems.private, "utf8");
  writeFileSync(certPath, pems.cert, "utf8");
  return { key: pems.private, cert: pems.cert };
}
