"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import {
  useIsVerified,
  useGetVerifiedIdentity,
} from "@/hooks/use-veil-verifier";
import { useAttestationStore } from "@/hooks/use-attestation-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TierBadge } from "@/components/tier-badge";
import {
  Tier,
  formatExpiry,
  getTimeRemaining,
  isExpired,
} from "@/lib/contracts";
import {
  Search,
  Globe,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Fingerprint,
  ArrowRight,
  History,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

// Mock data for the explorer table (will be replaced with real data)
const mockIdentities: {
  address: string;
  casperHash: string;
  tier: Tier;
  stake: string;
  expiresAt: number;
  verified: boolean;
}[] = [];

export default function ExplorerPage() {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Current user's data
  const { data: isVerified } = useIsVerified(evmAddress as `0x${string}`);
  const { identity } = useGetVerifiedIdentity(evmAddress as `0x${string}`);

  // Attestation history
  const { attestations } = useAttestationStore();
  const myAttestations = useMemo(() => {
    if (!evmAddress) return [];
    return attestations.filter(
      (a) => a.targetAddress.toLowerCase() === evmAddress.toLowerCase()
    );
  }, [attestations, evmAddress]);

  // Filter identities based on search
  const filteredIdentities = useMemo(() => {
    if (!searchQuery) return mockIdentities;
    const query = searchQuery.toLowerCase();
    return mockIdentities.filter(
      (identity) =>
        identity.address.toLowerCase().includes(query) ||
        identity.casperHash.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="container px-4 md:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[calc(100vh-12rem)]">
        {/* Left Side - Explorer (3 cols) */}
        <div className="lg:col-span-3 flex flex-col">
          <Card className="obsidian-card flex-1 flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Identity Explorer
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Browse and search verified identities across the network
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {filteredIdentities.length} identities
                </Badge>
              </div>

              {/* Search Bar */}
              <div className="flex gap-2 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by EVM address or Casper hash..."
                    className="pl-9 font-mono text-sm"
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col">
              <div className="rounded-md border flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>EVM Address</TableHead>
                      <TableHead>Casper Hash</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Stake</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIdentities.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-48 text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center gap-3">
                            <Globe className="h-12 w-12 text-muted-foreground/50" />
                            <div>
                              <p className="font-medium">No identities found</p>
                              <p className="text-sm">
                                Verified identities will appear here once data is available
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredIdentities.map((identity) => (
                        <TableRow key={identity.address}>
                          <TableCell className="font-mono text-xs">
                            {identity.address.slice(0, 6)}...
                            {identity.address.slice(-4)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {identity.casperHash.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <TierBadge tier={identity.tier} size="sm" />
                          </TableCell>
                          <TableCell>{identity.stake} CSPR</TableCell>
                          <TableCell className="text-xs">
                            {getTimeRemaining(identity.expiresAt)}
                          </TableCell>
                          <TableCell>
                            {identity.verified && !isExpired(identity.expiresAt) ? (
                              <Badge
                                variant="outline"
                                className="text-xs bg-green-500/10 text-green-500 border-green-500/30"
                              >
                                Verified
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs bg-red-500/10 text-red-500 border-red-500/30"
                              >
                                Expired
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <a
                                href={`https://sepolia.basescan.org/address/${identity.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Sidebar (1 col) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* My Identity Card */}
          <Card className="obsidian-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  My Identity
                </CardTitle>
                {evmConnected && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {evmAddress?.slice(0, 4)}...{evmAddress?.slice(-3)}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {!evmConnected ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm">
                    Connect wallet to view
                  </p>
                </div>
              ) : isVerified && identity && !isExpired(identity.expiresAt) ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-500">Verified</span>
                    </div>
                    <TierBadge tier={identity.tier} size="sm" />
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Casper Hash</span>
                      <code className="font-mono text-xs truncate max-w-[100px]">
                        {identity.casperAddressHash.slice(0, 8)}...
                      </code>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Expires</span>
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {getTimeRemaining(identity.expiresAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm">Not Verified</span>
                  </div>
                  <Link href="/attest">
                    <Button size="sm" className="obsidian-button gap-2 w-full">
                      Get Verified
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Attestations */}
          <Card className="obsidian-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                My Attestations
              </CardTitle>
              <CardDescription className="text-xs">
                Your attestation history
              </CardDescription>
            </CardHeader>

            <CardContent>
              {myAttestations.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm">
                    No attestations yet
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myAttestations.slice(0, 4).map((attestation) => (
                    <div
                      key={attestation.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Fingerprint className="h-3 w-3 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-1">
                            <TierBadge tier={attestation.tier as Tier} size="sm" />
                            {attestation.submittedToEvm ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 bg-green-500/10 text-green-500 border-green-500/30"
                              >
                                Verified
                              </Badge>
                            ) : isExpired(attestation.expiresAt) ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 bg-red-500/10 text-red-500 border-red-500/30"
                              >
                                Expired
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                              >
                                Pending
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatExpiry(attestation.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Protocol Stats */}
          <Card className="obsidian-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Protocol Stats
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xl font-archivo font-bold">2</p>
                  <p className="text-xs text-muted-foreground">Networks</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xl font-archivo font-bold">5</p>
                  <p className="text-xs text-muted-foreground">Tiers</p>
                </div>
              </div>

              <Separator className="my-3" />

              <div className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">Supported Networks:</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">Casper Testnet</Badge>
                  <Badge variant="outline" className="text-xs">Base Sepolia</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
