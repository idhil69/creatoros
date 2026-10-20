export const AUTH_COOKIE_NAME = "creatoros_session";

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "p3b216013";

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.TOKEN_SECRET ||
  "creatoros-p3b216013-secure-auth-secret";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(user: string = ADMIN_USERNAME): Promise<string> {
  const enc = new TextEncoder();
  const payload = {
    user,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // Berlaku 30 hari
  };
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<{ user: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  try {
    const enc = new TextEncoder();
    const key = await getHmacKey();
    const sigBytes = base64UrlDecode(sigB64);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as BufferSource,
      enc.encode(payloadB64)
    );
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { user: payload.user };
  } catch {
    return null;
  }
}
