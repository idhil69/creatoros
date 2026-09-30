import type { SocialAccount } from "@/db/schema";

/** Hilangkan token terenkripsi sebelum dikirim ke client. */
export function sanitizeAccount(a: SocialAccount) {
  const { accessTokenEnc: _a, refreshTokenEnc: _r, ...safe } = a;
  void _a;
  void _r;
  return safe;
}
