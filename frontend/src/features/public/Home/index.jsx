import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHealth, USE_MOCKS } from "../../../api";
import { useAuth } from "../../../auth/useAuth";
import BatchLookup from "../../../components/BatchLookup";
import Badge from "../../../components/Badge";
import { TEXT } from "../../consumer/strings";
import "./style.css";

const T = TEXT.landing;

// Public landing: batch code search for consumers, sign in for members.
export default function Home() {
  const { session } = useAuth();
  // Signed in users go to their dashboard; /app picks the role's home.
  const account = session
    ? { to: "/app", label: T.dashboard }
    : { to: "/login", label: T.signIn };
  const [state, setState] = useState({ status: "loading", message: "" });

  useEffect(() => {
    getHealth()
      .then((data) =>
        setState({ status: data.ok ? "ok" : "down", message: "" }),
      )
      .catch((err) => setState({ status: "down", message: err.message }));
  }, []);

  return (
    <div className="home">
      <header className="home__bar">
        <Link to="/" className="home__brand">
          {TEXT.brand}
        </Link>
        <Link to={account.to} className="home__sign-in">
          {account.label}
        </Link>
      </header>

      <main className="home__main">
        <h1 className="home__title">{T.title}</h1>
        <p className="home__intro">{T.intro}</p>
        <div className="home__search">
          <BatchLookup basePath="/trace" text={T.search} />
          {USE_MOCKS && <p className="home__hint">{T.mockHint}</p>}
        </div>

        <p className="home__members">
          {T.members} <Link to={account.to}>{account.label}</Link>
        </p>

        <p className="home__status">
          {T.status}:{" "}
          {state.status === "loading" && <Badge>{T.checking}</Badge>}
          {state.status === "ok" && <Badge tone="success">{T.connected}</Badge>}
          {state.status === "down" && (
            <Badge tone="danger">{T.unreachable}</Badge>
          )}
          {state.message && (
            <span className="home__message"> {state.message}</span>
          )}
        </p>
      </main>
    </div>
  );
}
