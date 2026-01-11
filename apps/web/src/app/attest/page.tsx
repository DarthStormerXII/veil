"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useCasperWallet } from "@/providers/casper-wallet-provider";
import { useAttestationStore } from "@/hooks/use-attestation-store";
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
  getTimeRemaining,
} from "@/lib/contracts";
import {
  Fingerprint,
  ArrowRight,
  Check,
  Copy,
  Wallet,
  Shield,
  Clock,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Link2,
  Zap,
} from "lucide-react";
import Link from "next/link";

// Demo mode - simulates attestation creation
// In production, this would call the actual Casper contract
const DEMO_MODE = true;

export default function AttestPage() {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const {
    isConnected: casperConnected,
    publicKey: casperPublicKey,
    balance: casperBalance,
    accountHash,
  } = useCasperWallet();

  const { saveAttestation, getPendingAttestations } = useAttestationStore();

  const [txState, setTxState] = useState<TransactionState>("idle");
  const [error, setError] = useState<string>("");
  const [createdAttestation, setCreatedAttestation] = useState<{
    id: string;
    attestationData: string;
    signature: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Check for pending attestations
  const pendingAttestations = evmAddress
    ? getPendingAttestations(evmAddress)
    : [];

  // Simulated tier based on balance (demo)
  const estimatedTier = (() => {
    if (!casperBalance) return Tier.None;
    const balance = parseFloat(casperBalance);
    if (balance >= 100000) return Tier.Platinum;
    if (balance >= 10000) return Tier.Gold;
    if (balance >= 1000) return Tier.Silver;
    if (balance >= 100) return Tier.Bronze;
    return Tier.None;
  })();

  const handleCreateAttestation = async () => {
    if (!casperPublicKey || !evmAddress) return;

    setTxState("pending");
    setError("");
    setCreatedAttestation(null);

    try {
      if (DEMO_MODE) {
        // Demo mode - simulate attestation creation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Generate mock attestation data
        const now = Date.now();
        const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
        const mockId = `0x${Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("")}`;

        // Mock ABI-encoded attestation (in reality this comes from Casper contract)
        const mockAttestationData = `0x${Array.from({ length: 512 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("")}`;

        // Mock signature (65 bytes)
        const mockSignature = `0x${Array.from({ length: 130 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("")}`;

        setTxState("confirming");
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Save to local storage
        const attestation = {
          id: mockId,
          attestationData: mockAttestationData,
          signature: mockSignature,
          casperAddress: casperPublicKey,
          targetChain: "base-sepolia",
          targetAddress: evmAddress,
          tier: estimatedTier,
          createdAt: now,
          expiresAt,
          submittedToEvm: false,
        };

        saveAttestation(attestation);
        setCreatedAttestation({
          id: mockId,
          attestationData: mockAttestationData,
          signature: mockSignature,
        });

        setTxState("success");
      } else {
        // Production mode - would call Casper contract
        // This requires building a deploy with casper-js-sdk
        throw new Error("Production mode not yet implemented");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create attestation");
      setTxState("error");
    }
  };

  const handleCopyData = () => {
    if (createdAttestation) {
      navigator.clipboard.writeText(
        JSON.stringify(
          {
            attestationData: createdAttestation.attestationData,
            signature: createdAttestation.signature,
          },
          null,
          2
        )
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setTxState("idle");
    setError("");
    setCreatedAttestation(null);
  };

  return (
    <div className="container px-4 md:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[calc(100vh-12rem)]">
        {/* Left Side - Main Content (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Demo Mode Banner */}
          {DEMO_MODE && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-yellow-500">Demo Mode Active</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Attestations are simulated locally. In production, this creates real on-chain attestations on Casper Network.
                  </p>
                </div>
              </div>
            </div>
          )}

          <WalletRequired requireCasper requireEvm>
            {/* Main Attestation Card */}
            <Card className="obsidian-card flex-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Fingerprint className="h-5 w-5" />
                      Create Attestation
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Generate a cryptographic proof linking your Casper identity to EVM
                    </CardDescription>
                  </div>
                  {estimatedTier !== Tier.None && (
                    <TierBadge tier={estimatedTier} />
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Source and Target */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Casper Identity */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="h-2 w-2 rounded-full bg-cyan-500" />
                      Casper Identity (Source)
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Address</span>
                        <code className="text-xs font-mono truncate max-w-[140px]">
                          {casperPublicKey?.slice(0, 10)}...{casperPublicKey?.slice(-6)}
                        </code>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Balance</span>
                        <span className="text-sm font-medium">{casperBalance} CSPR</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Tier</span>
                        <TierBadge tier={estimatedTier} size="sm" />
                      </div>
                    </div>
                  </div>

                  {/* EVM Target */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      EVM Address (Target)
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Address</span>
                        <code className="text-xs font-mono">
                          {evmAddress?.slice(0, 10)}...{evmAddress?.slice(-6)}
                        </code>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Network</span>
                        <Badge variant="outline" className="text-xs">
                          Base Sepolia
                        </Badge>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Validity</span>
                        <span className="text-sm">7 days</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Link Visual */}
                <div className="flex items-center justify-center gap-4 py-2">
                  <div className="h-px flex-1 bg-border" />
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Transaction Status */}
                <TransactionStatus
                  state={txState}
                  error={error}
                  successMessage="Attestation created successfully!"
                  pendingMessage="Creating attestation on Casper..."
                  confirmingMessage="Signing and storing attestation..."
                  onReset={handleReset}
                />

                {/* Created Attestation Data */}
                {createdAttestation && txState === "success" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Attestation Created</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyData}
                        className="gap-1 h-7 text-xs"
                      >
                        {copied ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        {copied ? "Copied" : "Copy Data"}
                      </Button>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <code className="text-xs font-mono text-muted-foreground break-all">
                        ID: {createdAttestation.id.slice(0, 24)}...
                      </code>
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                {txState === "success" ? (
                  <Link href="/verify" className="w-full">
                    <Button className="w-full obsidian-button gap-2">
                      Continue to Verification
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={handleCreateAttestation}
                    disabled={txState === "pending" || txState === "confirming"}
                    className="w-full obsidian-button gap-2"
                  >
                    {txState === "pending" || txState === "confirming" ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Fingerprint className="h-4 w-4" />
                        Create Attestation
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </WalletRequired>
        </div>

        {/* Right Side - Sidebar (1 col) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Wallet Status Card */}
          <Card className="obsidian-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4" />
                Wallet Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-sm">Casper</span>
                {casperConnected ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-500">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Not connected</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-sm">EVM</span>
                {evmConnected ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-500">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Not connected</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Attestations */}
          {pendingAttestations.length > 0 && (
            <Card className="obsidian-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  Pending
                </CardTitle>
                <CardDescription className="text-xs">
                  Waiting to be verified on EVM
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingAttestations.slice(0, 3).map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <TierBadge tier={att.tier as Tier} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        {getTimeRemaining(att.expiresAt)}
                      </span>
                    </div>
                    <Link href="/verify">
                      <Button size="sm" variant="ghost" className="h-6 px-2">
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* How It Works */}
          <Card className="obsidian-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
                  <span className="text-muted-foreground">Connect both Casper and EVM wallets</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">2</span>
                  <span className="text-muted-foreground">Create attestation linking identities</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">3</span>
                  <span className="text-muted-foreground">Verify on EVM to complete the bridge</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Tier Info */}
          <Card className="obsidian-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Tier Requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <TierBadge tier={Tier.Bronze} size="sm" />
                  <span className="text-muted-foreground">100+ CSPR</span>
                </div>
                <div className="flex items-center justify-between">
                  <TierBadge tier={Tier.Silver} size="sm" />
                  <span className="text-muted-foreground">1,000+ CSPR</span>
                </div>
                <div className="flex items-center justify-between">
                  <TierBadge tier={Tier.Gold} size="sm" />
                  <span className="text-muted-foreground">10,000+ CSPR</span>
                </div>
                <div className="flex items-center justify-between">
                  <TierBadge tier={Tier.Platinum} size="sm" />
                  <span className="text-muted-foreground">100,000+ CSPR</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
