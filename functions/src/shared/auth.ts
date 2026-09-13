export function isRegisteredPasswordUser(
  token:
    { email?: unknown; firebase?: { sign_in_provider?: unknown } } | undefined,
): boolean {
  return (
    !!token &&
    typeof token.email === "string" &&
    token.email.length > 0 &&
    token.firebase?.sign_in_provider === "password"
  );
}
