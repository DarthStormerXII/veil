"use client";

import Link from "next/link";
import Image from "next/image";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useCasperWallet } from "@/providers/casper-wallet-provider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Menu, Wallet, LogOut, ExternalLink, Copy, Check, Droplets, Loader2 } from "lucide-react";
import { useState } from "react";
import { CasperNetworkSelector } from "./casper-network-selector";

const LOCALNET_EXPLORER_URL = "http://localhost:8080";

const casperWalletDisplayNames: Record<string, string> = {
  "casper-wallet": "Casper Wallet",
  "casper-signer": "Casper Signer",
  "metamask-snap": "MetaMask (Casper Snap)",
};

export function Navbar() {
  // EVM Wallet
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { connect: evmConnect, isPending: evmPending } = useConnect();
  const { disconnect: evmDisconnect } = useDisconnect();

  // Casper Wallet
  const {
    isConnected: casperConnected,
    isConnecting: casperConnecting,
    publicKey: casperPublicKey,
    truncatedAddress: casperTruncatedAddress,
    balance: casperBalance,
    walletType: casperWalletType,
    hasWalletExtension: hasCasperWallet,
    availableWallets: casperWallets,
    connect: casperConnect,
    disconnect: casperDisconnect,
    network: casperNetwork,
    refreshBalance: casperRefreshBalance,
  } = useCasperWallet();

  const [copiedEvm, setCopiedEvm] = useState(false);
  const [copiedCasper, setCopiedCasper] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCasperWalletSelect, setShowCasperWalletSelect] = useState(false);
  const [isDripping, setIsDripping] = useState(false);

  const handleEvmConnect = () => {
    evmConnect({ connector: injected() });
  };

  const handleCasperConnect = async (type?: "casper-signer" | "casper-wallet" | "metamask-snap" | null) => {
    setShowCasperWalletSelect(false);
    await casperConnect(type);
  };

  const handleCopyEvmAddress = () => {
    if (evmAddress) {
      navigator.clipboard.writeText(evmAddress);
      setCopiedEvm(true);
      setTimeout(() => setCopiedEvm(false), 2000);
    }
  };

  const handleCopyCasperAddress = () => {
    if (casperPublicKey) {
      navigator.clipboard.writeText(casperPublicKey);
      setCopiedCasper(true);
      setTimeout(() => setCopiedCasper(false), 2000);
    }
  };

  const handleFaucetDrip = async () => {
    if (!casperPublicKey || isDripping) return;

    setIsDripping(true);
    try {
      const response = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: casperPublicKey, amount: 1000 }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Faucet drip successful!", {
          description: `Received ${data.amount} CSPR`,
          action: {
            label: "View Tx",
            onClick: () => window.open(`${LOCALNET_EXPLORER_URL}/deploy/${data.deployHash}`, "_blank"),
          },
        });
        // Refresh balance after a short delay
        setTimeout(() => casperRefreshBalance(), 2000);
      } else {
        toast.error("Faucet drip failed", {
          description: data.error || "Unknown error",
        });
      }
    } catch (err) {
      toast.error("Faucet drip failed", {
        description: "Could not connect to faucet",
      });
    } finally {
      setIsDripping(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/attest", label: "Attest" },
    { href: "/verify", label: "Verify" },
    { href: "/explorer", label: "Explorer" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative h-8 w-8">
            <Image
              src="/veil.png"
              alt="Veil"
              fill
              className="object-contain transition-transform group-hover:scale-110"
            />
          </div>
          <span className="font-archivo text-xl font-bold tracking-tight hidden sm:block">
            VEIL
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground obsidian-edge"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Side - Network, Wallets & Mobile Menu */}
        <div className="flex items-center gap-2">
          {/* Casper Network Selector */}
          <CasperNetworkSelector />

          {/* Casper Wallet Connection */}
          {casperConnected && casperPublicKey ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 font-mono text-xs"
                >
                  {casperBalance && (
                    <span className="text-muted-foreground">{casperBalance} CSPR</span>
                  )}
                  <span>{casperTruncatedAddress}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={handleCopyCasperAddress}
                  className="cursor-pointer"
                >
                  {copiedCasper ? (
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copiedCasper ? "Copied!" : "Copy Address"}
                </DropdownMenuItem>
                {casperNetwork === "localnet" && (
                  <DropdownMenuItem
                    onClick={handleFaucetDrip}
                    disabled={isDripping}
                    className="cursor-pointer"
                  >
                    {isDripping ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Droplets className="mr-2 h-4 w-4" />
                    )}
                    {isDripping ? "Dripping..." : "Faucet"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={casperDisconnect}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu open={showCasperWalletSelect} onOpenChange={setShowCasperWalletSelect}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={casperConnecting}
                  className="gap-1"
                  onClick={() => {
                    if (casperWallets.length === 1) {
                      handleCasperConnect();
                    } else if (casperWallets.length > 1) {
                      setShowCasperWalletSelect(true);
                    }
                  }}
                >
                  <Image src="/casper.png" alt="Casper" width={16} height={16} />
                  <span className="hidden sm:inline">
                    {casperConnecting ? "..." : hasCasperWallet ? "Casper" : "Install"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {hasCasperWallet ? (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Connect Casper Wallet
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {casperWallets.map((wallet) => (
                      <DropdownMenuItem
                        key={wallet}
                        onClick={() => handleCasperConnect(wallet)}
                        className="cursor-pointer"
                      >
                        <Wallet className="mr-2 h-4 w-4" />
                        {wallet ? casperWalletDisplayNames[wallet] : "Unknown"}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Install a Casper wallet
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="https://www.casperwallet.io/" target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Casper Wallet
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        MetaMask (Casper Snap)
                      </a>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* EVM Wallet Connection */}
          {evmConnected && evmAddress ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 font-mono text-xs"
                >
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="hidden sm:inline">EVM</span>
                  {formatAddress(evmAddress)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Base Sepolia
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleCopyEvmAddress}
                  className="cursor-pointer"
                >
                  {copiedEvm ? (
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copiedEvm ? "Copied!" : "Copy Address"}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={`https://sepolia.basescan.org/address/${evmAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View on Explorer
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => evmDisconnect()}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect EVM
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={handleEvmConnect}
              disabled={evmPending}
              size="sm"
              className="gap-1 obsidian-button"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">
                {evmPending ? "..." : "EVM"}
              </span>
            </Button>
          )}

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Image
                    src="/veil.png"
                    alt="Veil"
                    width={24}
                    height={24}
                  />
                  VEIL
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-medium text-muted-foreground transition-colors hover:text-foreground py-2"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
