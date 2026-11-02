import { useAuth } from "../../auth/useAuth";
import { TEXT } from "../consumer/strings";

// Signed in users go to their dashboard; /app picks the role's home.
export function useAccountLink() {
  const { session } = useAuth();
  return session
    ? { to: "/app", label: TEXT.landing.dashboard }
    : { to: "/login", label: TEXT.landing.signIn };
}
