/** QR contains only an opaque, random credential; no attendee information. */
export function parseCredential(raw: string) {
  const text = raw.trim();
  const token = text.startsWith("cuelance:ticket:") ? text.slice(16) : text;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      token,
    )
  )
    throw new Error("INVALID");
  return token;
}
