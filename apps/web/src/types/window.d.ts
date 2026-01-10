// Window type extensions for wallet providers

interface CasperLabsHelper {
  isConnected: () => Promise<boolean>;
  requestConnection: () => Promise<void>;
  disconnectFromSite: () => Promise<void>;
  getActivePublicKey: () => Promise<string>;
  sign: (
    deployJson: string,
    signingPublicKey: string
  ) => Promise<{ signature: string }>;
}

interface CasperWalletProviderInstance {
  isConnected: () => Promise<boolean>;
  requestConnection: () => Promise<boolean>;
  disconnectFromSite: () => Promise<boolean>;
  getActivePublicKey: () => Promise<string>;
  sign: (
    deployJson: string,
    signingPublicKey: string
  ) => Promise<{ signature: string }>;
}

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
}

declare global {
  interface Window {
    casperlabsHelper?: CasperLabsHelper;
    CasperWalletProvider?: () => CasperWalletProviderInstance;
    ethereum?: EthereumProvider;
  }
}

export {};
