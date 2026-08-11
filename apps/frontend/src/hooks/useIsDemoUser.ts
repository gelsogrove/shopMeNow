import { useCurrentUser } from "@/hooks/useCurrentUser"

/**
 * Demo accounts hide the billing UI (Plans card, PayPal connection blocks).
 *
 * The flag is set per user from the backoffice and read from /auth/me, so a
 * change takes effect on the next currentUser fetch without a re-login.
 * While the user is still loading this returns false, which keeps the billing
 * blocks hidden-on-demand only once we actually know the account is a demo.
 */
export function useIsDemoUser(): boolean {
  const { data: user } = useCurrentUser()
  return Boolean((user as { isDemoUser?: boolean } | undefined)?.isDemoUser)
}
