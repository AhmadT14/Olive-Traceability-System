import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHealth, USE_MOCKS } from "../../../api";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import "./style.css";

export default function Home() {
  const [state, setState] = useState({ status: "loading", message: "" });

  useEffect(() => {
    getHealth()
      .then((data) =>
        setState({ status: data.ok ? "ok" : "down", message: "" }),
      )
      .catch((err) => setState({ status: "down", message: err.message }));
  }, []);

  return (
    <main className="home">
      <h1 className="home__title">Olive Oil Traceability</h1>
      <p>
        <Link to="/login">Sign in</Link>
      </p>
      <Card title="Backend connection">
        {state.status === "loading" && <Badge>Checking</Badge>}
        {state.status === "ok" && <Badge tone="success">Connected</Badge>}
        {state.status === "down" && <Badge tone="danger">Not reachable</Badge>}
        {state.message && <p className="home__message">{state.message}</p>}
        {USE_MOCKS && <p className="home__message">Mock mode is on.</p>}
      </Card>
    </main>
  );
}
