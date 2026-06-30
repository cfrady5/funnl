import crypto from "node:crypto";
import { env } from "./config";

/**
 * AES-256-GCM encryption for OAuth refresh tokens at rest.
 *
 * PRODUCTION GUIDANCE
 * -------------------
 * - ENCRYPTION_KEY must be a 32-byte key. Accepts base64 (recommended) or
 *   64-char hex. Generate with: `openssl rand -base64 32`.
 * - Do NOT keep this key in `.env` in production. Source it from a managed
 *   secret store (GCP Secret Manager, AWS Secrets Manager, Vault) and inject
 *   it at runtime. Rotate periodically: keep the previous key available for
 *   decryption during a re-encryption migration.
 * - Encrypted payload format: `v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>`.
 *   The version prefix lets you migrate algorithms/keys later.
 * - Access tokens are short-lived and may be stored encrypted too, but the
 *   refresh token is the sensitive long-lived secret that MUST be encrypted.
 */

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getKey(): Buffer {
  const raw = env.encryptionKey;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Refusing to handle tokens without it.",
    );
  }
  // Try base64 first, then hex.
  let key = Buffer.from(raw, "base64");
  if (key.length !== 32) key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or hex).",
    );
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptToken(payload: string): string {
  const key = getKey();
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== VERSION) {
    throw new Error(`Unsupported token encryption version: ${version}`);
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Convenience used by the OAuth callback; encrypts only when a key exists. */
export function maybeEncrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  if (!env.encryptionKey) {
    // In demo/dev without a key we still must not store plaintext secrets.
    // Returning a clearly-marked placeholder keeps the data shape intact.
    return "ENC_KEY_MISSING__NOT_PERSISTED";
  }
  return encryptToken(plaintext);
}
