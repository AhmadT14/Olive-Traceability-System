import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getNonce,
  login as loginRequest,
  setToken,
  setUnauthorizedHandler,
  ADMIN_ADDRESS,
} from "../api";
import { useWallet } from "../wallet/useWallet";
import { useToast } from "../components/Toast/useToast";
import { AuthContext } from "./context";

const SESSION_KEY = "olive_session";
const SESSION_MS = 55 * 60 * 1000; // token lasts 1 hour, expire a little early

function saveSession(session) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      setToken(null);
      saveSession(null);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

// Accepts "FARMER", "farmer" or "FARMER_ROLE" and returns "farmer".
function normalizeRole(role) {
  return String(role)
    .toLowerCase()
    .replace(/_role$/, "");
}

export function AuthProvider({ children }) {
  const wallet = useWallet();
  const { onAccountChange } = wallet;
  const toast = useToast();
  const [session, setSession] = useState(loadSession);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const logout = useCallback(
    (message) => {
      setToken(null);
      saveSession(null);
      sessionRef.current = null;
      setSession(null);
      if (typeof message === "string" && message)
        toast.show(message, "warning");
    },
    [toast],
  );

  // Any 401 from the API ends the session (only if one exists).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (sessionRef.current) logout("Your session expired. Sign in again.");
    });
  }, [logout]);

  // Token expiry after about 1 hour.
  useEffect(() => {
    if (!session) return undefined;
    const ms = Math.max(session.expiresAt - Date.now(), 0);
    const timer = setTimeout(
      () => logout("Your session expired. Sign in again."),
      ms,
    );
    return () => clearTimeout(timer);
  }, [session, logout]);

  // Log out only when MetaMask reports a different account. A locked or
  // disconnected wallet reports no account, and the session is kept.
  useEffect(
    () =>
      onAccountChange((account) => {
        const current = sessionRef.current;
        if (current && account && account.toLowerCase() !== current.address) {
          logout("The wallet account changed. Sign in again.");
        }
      }),
    [onAccountChange, logout],
  );

  const login = useCallback(async () => {
    setError("");
    setLoggingIn(true);
    try {
      const address =
        wallet.account && !wallet.wrongChain
          ? wallet.account
          : await wallet.connect();
      if (!address) return false;

      const { message } = await getNonce(address);
      const signer = await wallet.getSigner();
      const signature = await signer.signMessage(message);
      const res = await loginRequest(address, signature);

      const roles = (res.roles || []).map(normalizeRole);
      // Workaround for gap 2: admin is detected from the env address.
      if (address.toLowerCase() === ADMIN_ADDRESS && !roles.includes("admin")) {
        roles.push("admin");
      }

      setToken(res.token);
      const next = {
        address: address.toLowerCase(),
        roles,
        activeRole: roles[0] || null,
        expiresAt: Date.now() + SESSION_MS,
      };
      saveSession(next);
      sessionRef.current = next;
      setSession(next);
      return true;
    } catch (err) {
      const rejected =
        err && (err.code === 4001 || err.code === "ACTION_REJECTED");
      setError(rejected ? "You rejected the signature request." : err.message);
      return false;
    } finally {
      setLoggingIn(false);
    }
  }, [wallet]);

  const switchRole = useCallback((role) => {
    setSession((prev) => {
      if (!prev || !prev.roles.includes(role)) return prev;
      const next = { ...prev, activeRole: role };
      saveSession(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ session, loggingIn, error, login, logout, switchRole }),
    [session, loggingIn, error, login, logout, switchRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
