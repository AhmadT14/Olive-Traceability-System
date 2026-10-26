import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider } from "ethers";
import { CHAIN_ID } from "../api";
import { WalletContext } from "./context";

const CHAIN_HEX = "0x" + CHAIN_ID.toString(16);

function readableError(err) {
  if (err && (err.code === 4001 || err.code === "ACTION_REJECTED")) {
    return "You rejected the request in MetaMask.";
  }
  return (err && err.message) || "Wallet error.";
}

async function ensureChain(eth) {
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }],
    });
  } catch (err) {
    if (err && err.code === 4001) throw err;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: "Anvil Local",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["http://127.0.0.1:8545"],
        },
      ],
    });
  }
}

export function WalletProvider({ children }) {
  const eth = typeof window !== "undefined" ? window.ethereum : undefined;
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  // Without MetaMask there is nothing to wait for.
  const [ready, setReady] = useState(() => !eth);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const listeners = useRef(new Set());

  // Every account update from MetaMask goes through here, so subscribers
  // (the auth provider) see the same value as the state.
  const publishAccount = useCallback((next) => {
    setAccount(next);
    listeners.current.forEach((fn) => fn(next));
  }, []);

  const onAccountChange = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  useEffect(() => {
    if (!eth) return undefined;
    let active = true;
    Promise.all([
      eth.request({ method: "eth_accounts" }),
      eth.request({ method: "eth_chainId" }),
    ])
      .then(([accounts, chain]) => {
        if (!active) return;
        publishAccount(accounts[0] || null);
        setChainId(parseInt(chain, 16));
      })
      .catch(() => {})
      .finally(() => active && setReady(true));

    const onAccounts = (accounts) => publishAccount(accounts[0] || null);
    const onChain = (chain) => setChainId(parseInt(chain, 16));
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      active = false;
      eth.removeListener("accountsChanged", onAccounts);
      eth.removeListener("chainChanged", onChain);
    };
  }, [eth, publishAccount]);

  const connect = useCallback(async () => {
    if (!eth) {
      setError("MetaMask was not found in this browser.");
      return null;
    }
    setConnecting(true);
    setError("");
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      await ensureChain(eth);
      const chain = await eth.request({ method: "eth_chainId" });
      publishAccount(accounts[0] || null);
      setChainId(parseInt(chain, 16));
      return accounts[0] || null;
    } catch (err) {
      setError(readableError(err));
      return null;
    } finally {
      setConnecting(false);
    }
  }, [eth, publishAccount]);

  const switchChain = useCallback(async () => {
    if (!eth) return false;
    setError("");
    try {
      await ensureChain(eth);
      return true;
    } catch (err) {
      setError(readableError(err));
      return false;
    }
  }, [eth]);

  const getSigner = useCallback(
    () => new BrowserProvider(eth).getSigner(),
    [eth],
  );

  const value = useMemo(
    () => ({
      hasProvider: Boolean(eth),
      account,
      chainId,
      wrongChain: chainId !== null && chainId !== CHAIN_ID,
      ready,
      connecting,
      error,
      connect,
      switchChain,
      getSigner,
      onAccountChange,
    }),
    [
      eth,
      account,
      chainId,
      ready,
      connecting,
      error,
      connect,
      switchChain,
      getSigner,
      onAccountChange,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
