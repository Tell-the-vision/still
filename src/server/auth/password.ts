import * as crypto from "node:crypto";

// Passwords of institution staff and STILL operators (SPEC §9.2, §10.5): argon2id hashes only.

// Node ≥ 24.7 ships argon2 in node:crypto; @types/node 20 does not declare it yet.
type Argon2Params = { message: string; nonce: Buffer; memory: number; passes: number; parallelism: number; tagLength: number };
type Argon2 = (algorithm: "argon2id", params: Argon2Params, callback: (error: Error | null, key: Buffer) => void) => void;
const argon2 = (crypto as unknown as { argon2: Argon2 }).argon2;

// OWASP minimum for argon2id: 19 MiB, 2 passes, 1 lane.
const COST = { memory: 19456, passes: 2, parallelism: 1 };

export const MIN_PASSWORD_LENGTH = 12; // SPEC §9.2 implementation default

const b64 = (bytes: Buffer) => bytes.toString("base64").replace(/=+$/, "");

function derive(password: string, salt: Buffer, cost: typeof COST, tagLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    argon2("argon2id", { message: password, nonce: salt, ...cost, tagLength }, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

// PHC string: $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = await derive(password, salt, COST, 32);
  return `$argon2id$v=19$m=${COST.memory},t=${COST.passes},p=${COST.parallelism}$${b64(salt)}$${b64(key)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(stored);
  if (!match) return false;
  const [, memory, passes, parallelism, salt, hash] = match;
  const expected = Buffer.from(hash, "base64");
  const cost = { memory: Number(memory), passes: Number(passes), parallelism: Number(parallelism) };
  const actual = await derive(password, Buffer.from(salt, "base64"), cost, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// A sign-in for an unknown or ineligible account still runs one verification, so the
// response time does not reveal which check failed (SPEC §10.5).
let decoyHash: Promise<string> | undefined;
export async function verifyDecoy(password: string) {
  decoyHash ??= hashPassword(crypto.randomBytes(16).toString("hex"));
  await verifyPassword(password, await decoyHash);
  return false;
}

// Shown once to the operator, who passes it on (SPEC §9.2). No 0/o, 1/l/i to misread.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function temporaryPassword() {
  const chars = Array.from({ length: 16 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
  return chars.match(/.{4}/g)!.join("-"); // e.g. "k7mq-x2pa-hd4w-9rtn"
}
