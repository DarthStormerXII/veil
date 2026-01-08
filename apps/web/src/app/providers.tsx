"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";
import { CasperWalletProvider } from "@/providers/casper-wallet-provider";
import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <CasperWalletProvider>
          {children}
          <Toaster position="bottom-right" />
        </CasperWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
