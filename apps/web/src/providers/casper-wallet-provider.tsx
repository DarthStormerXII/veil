"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { CLPublicKey } from "casper-js-sdk";

// Casper Network RPC endpoints
export const CASPER_RPC_URLS = {
  localnet: "http://localhost:11101/rpc",
  testnet: "https://node.testnet.casper.network/rpc",
  mainnet: "https://node.mainnet.casper.network/rpc",
} as const;

export type CasperNetwork = keyof typeof CASPER_RPC_URLS;

const STORAGE_KEY = "veil_casper_wallet_connection";
const NETWORK_STORAGE_KEY = "veil_casper_network";
const CASPER_SNAP_ID = "npm:casper-manager";

type CasperWalletType = "casper-signer" | "casper-wallet" | "metamask-snap" | null;

interface CasperWalletState {
  isConnected: boolean;
  isConnecting: boolean;
  publicKey: string | null;
  accountHash: string | null;
  balance: string | null;
  walletType: CasperWalletType;
  error: string | null;
}

interface CasperWalletContextType extends CasperWalletState {
  connect: (type?: CasperWalletType) => Promise<void>;
  disconnect: () => void;
  sign: (deployJson: string) => Promise<string>;
  refreshBalance: () => Promise<void>;
  availableWallets: CasperWalletType[];
  hasMetaMask: boolean;
  truncatedAddress: string | null;
  hasWalletExtension: boolean;
  network: CasperNetwork;
  setNetwork: (network: CasperNetwork) => void;
}

const initialState: CasperWalletState = {
  isConnected: false,
  isConnecting: false,
  publicKey: null,
  accountHash: null,
  balance: null,
  walletType: null,
  error: null,
};

const CasperWalletContext = createContext<CasperWalletContextType | undefined>(undefined);

// Window type extensions are defined in @/types/window.d.ts

interface CasperWalletProviderProps {
  children: ReactNode;
}

export function CasperWalletProvider({ children }: CasperWalletProviderProps) {
  const [state, setState] = useState<CasperWalletState>(initialState);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  // Default to localnet for development
  const [network, setNetworkState] = useState<CasperNetwork>("localnet");

  // Load saved network on mount
  useEffect(() => {
    const savedNetwork = localStorage.getItem(NETWORK_STORAGE_KEY) as CasperNetwork | null;
    if (savedNetwork && CASPER_RPC_URLS[savedNetwork]) {
      setNetworkState(savedNetwork);
    }
  }, []);

  const setNetwork = useCallback((newNetwork: CasperNetwork) => {
    setNetworkState(newNetwork);
    localStorage.setItem(NETWORK_STORAGE_KEY, newNetwork);
    // Disconnect wallet when switching networks
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  }, []);

  const getAvailableWallets = useCallback((): CasperWalletType[] => {
    if (typeof window === "undefined") return [];

    const wallets: CasperWalletType[] = [];

    if (window.CasperWalletProvider) {
      wallets.push("casper-wallet");
    }

    if (window.casperlabsHelper) {
      wallets.push("casper-signer");
    }

    if (window.ethereum?.isMetaMask) {
      wallets.push("metamask-snap");
    }

    return wallets;
  }, []);

  const [availableWallets, setAvailableWallets] = useState<CasperWalletType[]>([]);

  useEffect(() => {
    const checkWallets = () => {
      setAvailableWallets(getAvailableWallets());
      setHasMetaMask(!!window.ethereum?.isMetaMask);
    };

    checkWallets();
    const timeout = setTimeout(checkWallets, 1000);

    return () => clearTimeout(timeout);
  }, [getAvailableWallets]);

  const fetchBalance = useCallback(
    async (publicKeyHex: string): Promise<string> => {
      try {
        // Use Next.js API route to proxy RPC calls (avoids CORS issues)
        const balanceResponse = await fetch("/api/rpc", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-casper-network": network,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "query_balance",
            params: {
              purse_identifier: {
                main_purse_under_public_key: publicKeyHex,
              },
            },
          }),
        });
        const balanceData = await balanceResponse.json();
        const balance = balanceData.result?.balance || "0";
        const cspr = (Number(balance) / 1_000_000_000).toFixed(4);
        return cspr;
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        return "0";
      }
    },
    [network]
  );

  const publicKeyToAccountHash = (publicKeyHex: string): string => {
    try {
      const pk = CLPublicKey.fromHex(publicKeyHex);
      return pk.toAccountHashStr();
    } catch (error) {
      console.error("Failed to convert public key to account hash:", error);
      return "";
    }
  };

  const connectWithSigner = useCallback(async () => {
    if (!window.casperlabsHelper) {
      throw new Error("Casper Signer is not installed");
    }

    await window.casperlabsHelper.requestConnection();

    const isConnected = await window.casperlabsHelper.isConnected();
    if (!isConnected) {
      throw new Error("Connection rejected");
    }

    const publicKey = await window.casperlabsHelper.getActivePublicKey();
    return publicKey;
  }, []);

  const connectWithWallet = useCallback(async () => {
    if (!window.CasperWalletProvider) {
      throw new Error("Casper Wallet is not installed");
    }

    const provider = window.CasperWalletProvider();

    const connected = await provider.requestConnection();
    if (!connected) {
      throw new Error("Connection rejected");
    }

    const publicKey = await provider.getActivePublicKey();
    return publicKey;
  }, []);

  const connectWithSnap = useCallback(async () => {
    if (!window.ethereum?.isMetaMask) {
      throw new Error("MetaMask is not installed");
    }

    // Request snap installation/connection
    await window.ethereum.request({
      method: "wallet_requestSnaps",
      params: {
        [CASPER_SNAP_ID]: {},
      },
    });

    // Get account using the correct method name: casper_getAccount
    // The snap returns an object with a publicKey property
    const result = await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: CASPER_SNAP_ID,
        request: {
          method: "casper_getAccount",
          params: {
            addressIndex: 0,
          },
        },
      },
    });

    console.log("MetaMask Snap casper_getAccount result:", result, typeof result);

    // Handle various response formats
    let publicKey: string | undefined;

    if (typeof result === 'string') {
      publicKey = result;
    } else if (result && typeof result === 'object') {
      const resultObj = result as Record<string, unknown>;
      publicKey = (resultObj.publicKey ?? resultObj.public_key ?? resultObj.address) as string | undefined;
      console.log("Extracted publicKey from object:", publicKey);
    }

    if (!publicKey || typeof publicKey !== 'string') {
      console.error("Invalid public key format from snap:", result);
      throw new Error("Failed to get public key from MetaMask Snap");
    }

    return publicKey;
  }, []);

  const connect = useCallback(
    async (preferredType?: CasperWalletType) => {
      setState((prev) => ({ ...prev, isConnecting: true, error: null }));

      try {
        let publicKey: string;
        let walletType: CasperWalletType;

        if (preferredType === "casper-wallet" && window.CasperWalletProvider) {
          publicKey = await connectWithWallet();
          walletType = "casper-wallet";
        } else if (preferredType === "casper-signer" && window.casperlabsHelper) {
          publicKey = await connectWithSigner();
          walletType = "casper-signer";
        } else if (preferredType === "metamask-snap" && window.ethereum?.isMetaMask) {
          publicKey = await connectWithSnap();
          walletType = "metamask-snap";
        } else if (window.CasperWalletProvider) {
          publicKey = await connectWithWallet();
          walletType = "casper-wallet";
        } else if (window.casperlabsHelper) {
          publicKey = await connectWithSigner();
          walletType = "casper-signer";
        } else if (window.ethereum?.isMetaMask) {
          publicKey = await connectWithSnap();
          walletType = "metamask-snap";
        } else {
          throw new Error(
            "No Casper wallet found. Please install Casper Wallet, Casper Signer, or MetaMask."
          );
        }

        const accountHash = publicKeyToAccountHash(publicKey);
        const balance = await fetchBalance(publicKey);

        const connectionData = {
          publicKey,
          accountHash,
          walletType,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(connectionData));

        setState({
          isConnected: true,
          isConnecting: false,
          publicKey,
          accountHash,
          balance,
          walletType,
          error: null,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to connect wallet";
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          error: errorMessage,
        }));
      }
    },
    [connectWithSigner, connectWithWallet, connectWithSnap, fetchBalance]
  );

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState);

    if (state.walletType === "casper-signer" && window.casperlabsHelper) {
      window.casperlabsHelper.disconnectFromSite().catch(console.error);
    } else if (
      state.walletType === "casper-wallet" &&
      window.CasperWalletProvider
    ) {
      const provider = window.CasperWalletProvider();
      provider.disconnectFromSite().catch(console.error);
    }
  }, [state.walletType]);

  const sign = useCallback(
    async (deployJson: string): Promise<string> => {
      if (!state.isConnected || !state.publicKey) {
        throw new Error("Wallet not connected");
      }

      if (state.walletType === "casper-signer" && window.casperlabsHelper) {
        const result = await window.casperlabsHelper.sign(
          deployJson,
          state.publicKey
        );
        return result.signature;
      } else if (
        state.walletType === "casper-wallet" &&
        window.CasperWalletProvider
      ) {
        const provider = window.CasperWalletProvider();
        const result = await provider.sign(deployJson, state.publicKey);
        return result.signature;
      } else if (state.walletType === "metamask-snap" && window.ethereum) {
        // Use casper_sign method with the deploy JSON
        const result = await window.ethereum.request({
          method: "wallet_invokeSnap",
          params: {
            snapId: CASPER_SNAP_ID,
            request: {
              method: "casper_sign",
              params: {
                addressIndex: 0,
                deployJson: deployJson,
              },
            },
          },
        }) as string;

        return result;
      }

      throw new Error("No wallet available for signing");
    },
    [state.isConnected, state.publicKey, state.walletType]
  );

  const refreshBalance = useCallback(async () => {
    if (!state.publicKey) return;

    const balance = await fetchBalance(state.publicKey);
    setState((prev) => ({ ...prev, balance }));
  }, [state.publicKey, fetchBalance]);

  useEffect(() => {
    const restoreConnection = async () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      try {
        const { publicKey, accountHash, walletType } = JSON.parse(stored);

        let isStillConnected = false;

        if (walletType === "casper-signer" && window.casperlabsHelper) {
          isStillConnected = await window.casperlabsHelper.isConnected();
        } else if (
          walletType === "casper-wallet" &&
          window.CasperWalletProvider
        ) {
          const provider = window.CasperWalletProvider();
          isStillConnected = await provider.isConnected();
        } else if (walletType === "metamask-snap" && window.ethereum?.isMetaMask) {
          isStillConnected = true;
        }

        if (isStillConnected) {
          const balance = await fetchBalance(publicKey);
          setState({
            isConnected: true,
            isConnecting: false,
            publicKey,
            accountHash,
            balance,
            walletType,
            error: null,
          });
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.error("Failed to restore connection:", error);
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    const timeout = setTimeout(restoreConnection, 500);
    return () => clearTimeout(timeout);
  }, [fetchBalance]);

  const truncatedAddress = state.publicKey
    ? `${state.publicKey.slice(0, 8)}...${state.publicKey.slice(-6)}`
    : null;

  const hasWalletExtension = availableWallets.length > 0;

  const value: CasperWalletContextType = {
    ...state,
    connect,
    disconnect,
    sign,
    refreshBalance,
    availableWallets,
    hasMetaMask,
    truncatedAddress,
    hasWalletExtension,
    network,
    setNetwork,
  };

  return (
    <CasperWalletContext.Provider value={value}>{children}</CasperWalletContext.Provider>
  );
}

export function useCasperWallet() {
  const context = useContext(CasperWalletContext);
  if (context === undefined) {
    throw new Error("useCasperWallet must be used within a CasperWalletProvider");
  }
  return context;
}
