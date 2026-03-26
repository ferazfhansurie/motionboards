/**
 * Check if user is logged in. If not, redirect to signup.
 * Returns true if authenticated, false if redirecting.
 */
export function requireAuth(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (window as any).__mb_user;
  if (user) return true;
  window.location.href = "/signup";
  return false;
}

export function isLoggedIn(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any).__mb_user;
}
