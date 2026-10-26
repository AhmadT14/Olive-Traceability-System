import { ToastProvider } from "./components/Toast";
import { WalletProvider } from "./wallet";
import { AuthProvider } from "./auth";
import AppRoutes from "./routes/index.jsx";

export default function App() {
  return (
    <ToastProvider>
      <WalletProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </WalletProvider>
    </ToastProvider>
  );
}
