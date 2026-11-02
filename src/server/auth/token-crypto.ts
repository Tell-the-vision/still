import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// SPEC §2.3: provider tokens are AES-256-GCM encrypted. Layout: [keyVersion byte][iv 12][tag 16][ciphertext].
// TOKEN_ENC_KEYS is a comma-separated list "v1:<base64 32B>,v2:..."; the last entry encrypts, all can decrypt.
function keys(): Map<number, Buffer> {
  const entries = String(process.env.TOKEN_ENC_KEYS ?? "").split(",").filter(Boolean);
  return new Map(
    entries.map((entry: string): [number, Buffer] => {
      const [version, key] = entry.split(":");
      return [Number(version.slice(1)), Buffer.from(key, "base64")];
    }),
  );
}

export function encryptToken(plaintext: string): Buffer {
  const [version, key] = [...keys()].at(-1) ?? [];
  if (!key) throw new Error("TOKEN_ENC_KEYS is not configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([version!]), iv, cipher.getAuthTag(), body]);
}

export function decryptToken(ciphertext: Buffer): string {
  const key = keys().get(ciphertext[0]);
  if (!key) throw new Error("Unknown token key version");
  const decipher = createDecipheriv("aes-256-gcm", key, ciphertext.subarray(1, 13));
  decipher.setAuthTag(ciphertext.subarray(13, 29));
  return Buffer.concat([decipher.update(ciphertext.subarray(29)), decipher.final()]).toString("utf8");
}
