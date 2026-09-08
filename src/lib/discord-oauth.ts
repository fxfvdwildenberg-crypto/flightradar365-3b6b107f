/** Shared helpers for the Discord sign-in flow (server side only). */

/** The single origin registered as the Discord OAuth2 redirect URI. */
export const CANONICAL_ORIGIN =
  process.env["PUBLIC_SITE_ORIGIN"] || "https://flightradar365.lovable.app";

/** Origins we are willing to hand a finished session back to. */
export function isAllowedOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (protocol !== "https:") return false;
    return hostname.endsWith(".lovable.app") || hostname === "flightradar365.lovable.app";
  } catch {
    return false;
  }
}

/** Decode the origin we stashed in the OAuth `state` parameter. */
export function decodeReturnOrigin(state: string | null): string {
  if (!state) return CANONICAL_ORIGIN;
  try {
    const decoded = atob(state);
    return isAllowedOrigin(decoded) ? decoded : CANONICAL_ORIGIN;
  } catch {
    return CANONICAL_ORIGIN;
  }
}
