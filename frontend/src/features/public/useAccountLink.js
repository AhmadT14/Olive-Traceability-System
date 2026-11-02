import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../consumer/language/useLanguage";

// Signed in users go to their dashboard; /app picks the role's home.
export function useAccountLink() {
  const { session } = useAuth();
  const { text: TEXT } = useLanguage();
  return session
    ? { to: "/app", label: TEXT.landing.dashboard }
    : { to: "/login", label: TEXT.landing.signIn };
}
