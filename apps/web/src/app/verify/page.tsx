"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useCasperWallet } from "@/providers/casper-wallet-provider";
import {
  useVerifyAndStore,
  useIsVerified,
  useGetVerifiedIdentity,
} from "@/hooks/use-veil-verifier";
import { useAttestationStore, type StoredAttestation } from "@/hooks/use-attestation-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WalletRequired } from "@/components/wallet-required";
import { TierBadge } from "@/components/tier-badge";
import { TransactionStatus, type TransactionState } from "@/components/transaction-status";
import {
  Tier,
  formatExpiry,
  getTimeRemaining,
  isExpired,
} from "@/lib/contracts";
import {
  Shield,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  ExternalLink,
  Fingerprint,
  RefreshCw,
  Zap,
  Info,
  User,
} from "lucide-react";

export default function VerifyPage() {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();

  // Contract hooks
  const { data: isVerified, refetch: refetchVerified } = useIsVerified(
    evmAddress as `0x${string}`
  );
  const { identity, refetch: refetchIdentity } = useGetVerifiedIdentity(
    evmAddress as `0x${string}`
  );
  const {
    verifyAndStore,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: txError,
    reset,
  } = useVerifyAndStore();

  // Attestation store
  const { getPendingAttestations, markAsSubmitted } = useAttestationStore();

  const [selectedAttestation, setSelectedAttestation] = useState<StoredAttestation | null>(
    null
  );
  const [localError, setLocalError] = useState<string>("");

  // Get pending attestations for connected wallet
  const pendingAttestations = useMemo(() => {
    if (!evmAddress) return [];
    return getPendingAttestations(evmAddress);
  }, [evmAddress, getPendingAttestations]);

  // Determine transaction state
  const txState: TransactionState = useMemo(() => {
    if (isSuccess) return "success";
    if (isConfirming) return "confirming";
    if (isPending) return "pending";
    if (txError || localError) return "error";
    return "idle";
  }, [isPending, isConfirming, isSuccess, txError, localError]);

  const handleVerify = async (attestation: StoredAttestation) => {
    setSelectedAttestation(attestation);
    setLocalError("");

    try {
      await verifyAndStore(
        attestation.attestationData as `0x${string}`,
        attestation.signature as `0x${string}`
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Verification failed");
    }
  };

  const handleSuccess = () => {
    if (selectedAttestation) {
      markAsSubmitted(selectedAttestation.id);
    }
    refetchVerified();
    refetchIdentity();
    reset();
    setSelectedAttestation(null);
  };

  const handleReset = () => {
    reset();
    setSelectedAttestation(null);
    setLocalError("");
  };

  // Already verified state
  if (isVerified && identity && !isExpired(identity.expiresAt)) {
    return (
      <div className="container px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[calc(100vh-12rem)]">
          {/* Left Side - Verified Identity Details (3 cols) */}
          <div className="lg:col-span-3">
            <Card className="obsidian-card h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <CardTitle>Identity Verified</CardTitle>
                      <CardDescription>
                        Your Casper identity is verified on Base Sepolia
                      </CardDescription>
                    </div>
                  </div>
                  <TierBadge tier={identity.tier} />
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Tier</p>
                    <TierBadge tier={identity.tier} />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="font-medium">Active</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Verified</p>
                    <span className="font-medium text-sm">{formatExpiry(identity.verifiedAt)}</span>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Expires</p>
                    <span className="font-medium text-sm">{getTimeRemaining(identity.expiresAt)}</span>
                  </div>
                </div>

                <Separator />

                {/* Identity Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Identity Details</h3>
                  <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Casper Address Hash</span>
                      <code className="font-mono text-xs bg-background px-2 py-1 rounded">
                        {identity.casperAddressHash.slice(0, 16)}...{identity.casperAddressHash.slice(-8)}
                      </code>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">EVM Address</span>
                      <code className="font-mono text-xs bg-background px-2 py-1 rounded">
                        {evmAddress?.slice(0, 10)}...{evmAddress?.slice(-8)}
                      </code>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Network</span>
                      <Badge variant="outline">Base Sepolia</Badge>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`https://sepolia.basescan.org/address/${evmAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full gap-2">
                      View on BaseScan
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                  <Link href="/explorer" className="flex-1">
                    <Button variant="outline" className="w-full">
                      View in Explorer
                    </Button>
                  </Link>
                  <Link href="/attest" className="flex-1">
                    <Button className="w-full obsidian-button gap-2">
                      <RefreshCw className="h-4 w-4" />
                      New Attestation
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Sidebar (1 col) */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* Quick Stats */}
            <Card className="obsidian-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  Your Identity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-500">Verified</span>
                  </div>
                  <TierBadge tier={identity.tier} size="sm" />
                </div>
              </CardContent>
            </Card>

            {/* What You Can Do */}
            <Card className="obsidian-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4" />
                  What You Can Do
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Access tier-gated dApps</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Prove Casper stake on EVM</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Cross-chain reputation</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Expiry Warning */}
            <Card className="obsidian-card border-yellow-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  Expiration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Your identity expires in <span className="font-medium text-foreground">{getTimeRemaining(identity.expiresAt)}</span>.
                  Create a new attestation before expiry to maintain access.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container px-4 md:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[calc(100vh-12rem)]">
        {/* Left Side - Main Content (3 cols) */}
        <div className="lg:col-span-3">
          <WalletRequired requireEvm>
            {pendingAttestations.length === 0 ? (
              // No pending attestations
              <Card className="obsidian-card h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Fingerprint className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle>Verify Identity</CardTitle>
                      <CardDescription>
                        Submit your attestation to verify on Base Sepolia
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col items-center justify-center py-12">
                  <div className="text-center space-y-4 max-w-md">
                    <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-muted">
                      <Shield className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">No Pending Attestations</h3>
                    <p className="text-sm text-muted-foreground">
                      You need to create an attestation on Casper first before you can verify your identity on EVM.
                    </p>
                    <Link href="/attest">
                      <Button className="obsidian-button gap-2 mt-4">
                        Create Attestation
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Has pending attestations
              <Card className="obsidian-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Shield className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle>Verify Identity</CardTitle>
                        <CardDescription>
                          Select an attestation to verify on the EVM chain
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {pendingAttestations.length} pending
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Attestation List */}
                  <div className="grid gap-4">
                    {pendingAttestations.map((attestation) => (
                      <div
                        key={attestation.id}
                        className={`rounded-lg border p-4 transition-colors ${
                          selectedAttestation?.id === attestation.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <TierBadge tier={attestation.tier as Tier} />
                            <Badge variant="outline" className="text-xs">
                              {attestation.targetChain}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {getTimeRemaining(attestation.expiresAt)}
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 text-sm mb-4">
                          <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-muted-foreground text-xs mb-1">Casper Address</p>
                            <code className="font-mono text-xs">
                              {attestation.casperAddress.slice(0, 16)}...
                            </code>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-muted-foreground text-xs mb-1">Created</p>
                            <span className="text-xs">{formatExpiry(attestation.createdAt)}</span>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleVerify(attestation)}
                          disabled={
                            txState === "pending" ||
                            txState === "confirming" ||
                            isExpired(attestation.expiresAt)
                          }
                          className="w-full obsidian-button gap-2"
                        >
                          {selectedAttestation?.id === attestation.id &&
                          (txState === "pending" || txState === "confirming") ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              {txState === "pending"
                                ? "Waiting for wallet..."
                                : "Confirming..."}
                            </>
                          ) : isExpired(attestation.expiresAt) ? (
                            "Expired"
                          ) : (
                            <>
                              <Shield className="h-4 w-4" />
                              Verify on EVM
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Transaction Status */}
                  {txState !== "idle" && (
                    <TransactionStatus
                      state={txState}
                      hash={hash}
                      error={txError?.message || localError}
                      explorerUrl="https://sepolia.basescan.org"
                      successMessage="Identity verified on Base Sepolia!"
                      onReset={txState === "success" ? handleSuccess : handleReset}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </WalletRequired>
        </div>

        {/* Right Side - Sidebar (1 col) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Current Status */}
          <Card className="obsidian-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Current Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Identity</span>
                <Badge variant="outline" className="text-xs">
                  Not Verified
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* How Verification Works */}
          <Card className="obsidian-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
                  <span className="text-muted-foreground">Submit attestation data to the EVM contract</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">2</span>
                  <span className="text-muted-foreground">Contract verifies the Casper signature</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">3</span>
                  <span className="text-muted-foreground">Identity tier stored on-chain</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">4</span>
                  <span className="text-muted-foreground">dApps can verify your identity</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="obsidian-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/attest" className="block">
                <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                  <Fingerprint className="h-4 w-4" />
                  Create Attestation
                </Button>
              </Link>
              <Link href="/explorer" className="block">
                <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                  <Shield className="h-4 w-4" />
                  View Explorer
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Network Info */}
          <Card className="obsidian-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4" />
                Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Target</span>
                  <Badge variant="outline">Base Sepolia</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Source</span>
                  <Badge variant="outline">Casper Testnet</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
