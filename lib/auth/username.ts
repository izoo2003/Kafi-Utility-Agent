/** Supabase Auth requires an email; usernames map to this synthetic domain. */
export const AUTH_USERNAME_DOMAIN = "facility-ops.local";

export function usernameToEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Username is required");
  }
  if (normalized.includes("@")) {
    return normalized;
  }
  return `${normalized}@${AUTH_USERNAME_DOMAIN}`;
}

export function emailToUsername(email: string) {
  const domain = `@${AUTH_USERNAME_DOMAIN}`;
  if (email.toLowerCase().endsWith(domain)) {
    return email.slice(0, -domain.length);
  }
  return email;
}
