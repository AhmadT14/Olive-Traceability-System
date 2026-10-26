import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth";
import { ROLE_HOME, ROLE_LABELS } from "../../../auth/roles";
import Badge from "../../../components/Badge";
import Button from "../../../components/Button";
import "./style.css";

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function AppShell() {
  const { session, switchRole, logout } = useAuth();
  const navigate = useNavigate();
  const role = session.activeRole;

  function handleRoleChange(event) {
    const next = event.target.value;
    switchRole(next);
    navigate(ROLE_HOME[next]);
  }

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">Olive Traceability</div>
        <nav className="app-shell__nav">
          <NavLink
            to={ROLE_HOME[role]}
            className={({ isActive }) =>
              `app-shell__link${isActive ? " app-shell__link--active" : ""}`
            }
          >
            Home
          </NavLink>
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
            {shortAddress(session.address)}
          </span>
          <Button variant="secondary" onClick={() => logout()}>
            Sign out
          </Button>
        </header>
        <div className="app-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
