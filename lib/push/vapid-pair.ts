import crypto from "crypto";

function decodeBase64Url(input: string): Buffer {
  const padding = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

function encodeBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export function deriveVapidPublicKey(privateKeyBase64: string): string {
  let privateKeyBuffer = decodeBase64Url(privateKeyBase64);
  if (privateKeyBuffer.length < 32) {
    privateKeyBuffer = Buffer.concat([Buffer.alloc(32 - privateKeyBuffer.length), privateKeyBuffer]);
  }

  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(privateKeyBuffer);

  let publicKeyBuffer = ecdh.getPublicKey();
  if (publicKeyBuffer.length < 65) {
    publicKeyBuffer = Buffer.concat([Buffer.alloc(65 - publicKeyBuffer.length), publicKeyBuffer]);
  }

  return encodeBase64Url(publicKeyBuffer);
}

export function vapidKeysMatch(publicKey: string, privateKey: string): boolean {
  try {
    return deriveVapidPublicKey(privateKey) === publicKey.trim();
  } catch {
    return false;
  }
}
