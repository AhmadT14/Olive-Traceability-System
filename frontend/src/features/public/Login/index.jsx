import { Navigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";
import { useWallet } from "../../../wallet/useWallet";
import { CHAIN_ID } from "../../../api";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import "./style.css";

export default function Login() {
  const { session, login, loggingIn, error } = useAuth();
  const wallet = useWallet();

  if (session) return <Navigate to="/app" replace />;

  const message = error || wallet.error;

  return (
    <main className="login">
      <Card title="Sign in">
        <p>
          Connect your MetaMask wallet and sign a message to prove you own it.
          No transaction is sent and no fee is charged.
        </p>
        {!wallet.hasProvider && (
          <p className="login__error">
            MetaMask was not found in this browser. Install the extension and
            reload.
          </p>
        )}
        {wallet.wrongChain && (
          <p className="login__warning">
            MetaMask is on the wrong network. Signing in will switch it to chain{" "}
            {CHAIN_ID}.
          </p>
        )}
        {message && <p className="login__error">{message}</p>}
        <Button onClick={login} disabled={loggingIn || !wallet.hasProvider}>
          {loggingIn ? "Waiting for wallet" : "Connect and sign in"}
        </Button>
      </Card>
    </main>
  );
}
