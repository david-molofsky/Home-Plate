/** URL-safe base64 encode/decode for embedding arbitrary UTF-8 text
 * (used for shareable meal links) directly in a URL path segment. The
 * standard base64 alphabet includes '+', '/', and '=' padding — '/'
 * in particular would be read by the router as an extra path segment
 * boundary. Swapping to the "base64url" alphabet and stripping
 * padding avoids that entirely, with no percent-encoding needed. */
export function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
