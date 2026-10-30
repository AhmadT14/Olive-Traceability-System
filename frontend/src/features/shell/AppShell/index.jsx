import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";
import { useWallet } from "../../../wallet/useWallet";
import {
  ROLE_HOME,
  ROLE_LABELS,
  ROLE_NAV,
  SHARED_NAV,
} from "../../../auth/roles";
import {
  CHAIN_ID,
  USE_MOCKS,
  getParticipantProfile,
  resetMockData,
} from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import Badge from "../../../components/Badge";
import Button from "../../../components/Button";
import { shortAddress } from "../../../utils/format";
import "./style.css";

function linkClass({ isActive }) {
  return `app-shell__link${isActive ? " app-shell__link--active" : ""}`;
}

export default function AppShell() {
  const { session, switchRole, logout } = useAuth();
  const wallet = useWallet();
  const navigate = useNavigate();
  const role = session.activeRole;
  const { data: profile } = useAsync(
    () => getParticipantProfile(session.address),
    session.address,
  );
  const walletUnavailable =
    wallet.hasProvider && wallet.ready && !wallet.account;

  // Mock mode only: back to the demo batches, in every tab.
  function handleResetMocks() {
    if (!window.confirm("Delete every batch made in mock mode?")) return;
    resetMockData();
    window.location.reload();
  }

  function handleRoleChange(event) {
    const next = event.target.value;
    switchRole(next);
    navigate(ROLE_HOME[next]);
  }

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <Link to={ROLE_HOME[role]} className="app-shell__brand">
          Olive Traceability
        </Link>
        <nav className="app-shell__nav">
          {[...ROLE_NAV[role], ...SHARED_NAV].map((link) => (
            <NavLink key={link.path} to={link.path} end className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="app-shell__main">
        <header className="app-shell__header">
          {session.roles.length > 1 ? (
            <select
              className="app-shell__role-select"
              value={role}
              onChange={handleRoleChange}
              aria-label="Active role"
            >
              {session.roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r] || r}
                </option>
              ))}
            </select>
          ) : (
            <Badge tone="success">{ROLE_LABELS[role] || role}</Badge>
          )}
          <span className="app-shell__wallet" title={session.address}>
            {(profile && profile.name) || shortAddress(session.address)}
          </span>
          {USE_MOCKS && (
            <Button variant="secondary" onClick={handleResetMocks}>
              Reset mock data
            </Button>
          )}
          <Button variant="secondary" onClick={() => logout()}>
            Sign out
          </Button>
        </header>
        {wallet.wrongChain && (
          <div className="app-shell__notice" role="alert">
            <span>
              MetaMask is on the wrong network (chain {wallet.chainId}). Switch
              to chain {CHAIN_ID} before you send any transaction.
            </span>
            <Button variant="secondary" onClick={() => wallet.switchChain()}>
              Switch network
            </Button>
          </div>
        )}
        {walletUnavailable && (
          <div className="app-shell__notice" role="alert">
            <span>
              MetaMask is not connected to this site. You are still signed in,
              but you need to connect it again before you send any transaction.
            </span>
            <Button
              variant="secondary"
              onClick={() => wallet.connect()}
              disabled={wallet.connecting}
            >
              Connect wallet
            </Button>
          </div>
        )}
        {wallet.error && (wallet.wrongChain || walletUnavailable) && (
          <p className="app-shell__notice-error">{wallet.error}</p>
        )}
        <div className="app-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
