"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Link2 } from "lucide-react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useCasperWallet } from "@/providers/casper-wallet-provider";

interface WalletRequiredProps {
  requireCasper?: boolean;
  requireEvm?: boolean;
  children: React.ReactNode;
}

export function WalletRequired({
  requireCasper = false,
  requireEvm = false,
  children,
}: WalletRequiredProps) {
  const { isConnected: evmConnected } = useAccount();
  const { connect: evmConnect, isPending: evmPending } = useConnect();
  const { isConnected: casperConnected, connect: casperConnect, isConnecting: casperConnecting, hasWalletExtension } = useCasperWallet();

  const needsCasper = requireCasper && !casperConnected;
  const needsEvm = requireEvm && !evmConnected;

  if (!needsCasper && !needsEvm) {
    return <>{children}</>;
  }

  return (
    <Card className="obsidian-card max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Wallet className="h-6 w-6" />
        </div>
        <CardTitle>Connect Wallet</CardTitle>
        <CardDescription>
          {needsCasper && needsEvm
            ? "Connect both wallets to continue"
            : needsCasper
            ? "Connect your Casper wallet to continue"
            : "Connect your EVM wallet to continue"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {needsCasper && (
          <Button
            onClick={() => casperConnect()}
            disabled={casperConnecting || !hasWalletExtension}
            className="w-full gap-2"
            variant="outline"
          >
            <Link2 className="h-4 w-4" />
            {casperConnecting
              ? "Connecting..."
              : hasWalletExtension
              ? "Connect Casper Wallet"
              : "Install Casper Wallet"}
          </Button>
        )}
        {needsEvm && (
          <Button
            onClick={() => evmConnect({ connector: injected() })}
            disabled={evmPending}
            className="w-full gap-2 obsidian-button"
          >
            <Wallet className="h-4 w-4" />
            {evmPending ? "Connecting..." : "Connect EVM Wallet"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
