import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Shield,
  Link2,
  Fingerprint,
  Zap,
  Lock,
  Globe,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 obsidian-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />

        <div className="container relative px-4 md:px-6">
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] py-20 text-center">
            {/* Badge */}
            <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm font-medium">
              <span className="mr-2 h-2 w-2 rounded-full bg-green-500 inline-block animate-pulse" />
              Live on Base Sepolia
            </Badge>

            {/* Main Heading */}
            <h1 className="font-archivo text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl">
              Cross-Chain{" "}
              <span className="text-muted-foreground">Identity</span>{" "}
              Attestation
            </h1>

            {/* Subheading */}
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Bridge your Casper Network identity to EVM chains with cryptographic
              proofs. Secure, verifiable, and trustless.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="obsidian-button px-8">
                <Link href="/attest">
                  Create Attestation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="px-8">
                <Link href="/verify">
                  Verify Identity
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 sm:gap-16">
              <div className="space-y-2">
                <p className="font-archivo text-3xl font-bold sm:text-4xl">100%</p>
                <p className="text-sm text-muted-foreground">On-Chain</p>
              </div>
              <div className="space-y-2">
                <p className="font-archivo text-3xl font-bold sm:text-4xl">2</p>
                <p className="text-sm text-muted-foreground">Networks</p>
              </div>
              <div className="space-y-2">
                <p className="font-archivo text-3xl font-bold sm:text-4xl">&lt;1min</p>
                <p className="text-sm text-muted-foreground">Verification</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-t border-border/40 bg-card/30">
        <div className="container px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="font-archivo text-3xl font-bold tracking-tight sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-muted-foreground">
              Three simple steps to bridge your identity across chains
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background font-archivo font-bold text-sm">
                1
              </div>
              <Card className="obsidian-card h-full pt-6">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <Fingerprint className="h-6 w-6" />
                  </div>
                  <CardTitle>Create Attestation</CardTitle>
                  <CardDescription>
                    Generate a cryptographic proof of your Casper identity on-chain
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background font-archivo font-bold text-sm">
                2
              </div>
              <Card className="obsidian-card h-full pt-6">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <Link2 className="h-6 w-6" />
                  </div>
                  <CardTitle>Bridge Proof</CardTitle>
                  <CardDescription>
                    Your attestation is cryptographically linked to your EVM address
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background font-archivo font-bold text-sm">
                3
              </div>
              <Card className="obsidian-card h-full pt-6">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <Shield className="h-6 w-6" />
                  </div>
                  <CardTitle>Verify On-Chain</CardTitle>
                  <CardDescription>
                    Submit to EVM chain for permanent, verifiable identity proof
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border/40">
        <div className="container px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="font-archivo text-3xl font-bold tracking-tight sm:text-4xl">
              Why Veil?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Built for security, designed for simplicity
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="obsidian-card">
              <CardHeader>
                <Zap className="h-8 w-8 mb-4 text-muted-foreground" />
                <CardTitle className="text-lg">Instant Verification</CardTitle>
                <CardDescription>
                  On-chain verification completes in seconds, not minutes
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="obsidian-card">
              <CardHeader>
                <Lock className="h-8 w-8 mb-4 text-muted-foreground" />
                <CardTitle className="text-lg">Cryptographically Secure</CardTitle>
                <CardDescription>
                  Ed25519 signatures ensure tamper-proof identity proofs
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="obsidian-card">
              <CardHeader>
                <Globe className="h-8 w-8 mb-4 text-muted-foreground" />
                <CardTitle className="text-lg">Cross-Chain Native</CardTitle>
                <CardDescription>
                  Built from the ground up for multi-chain interoperability
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Networks Section */}
      <section className="border-t border-border/40 bg-card/30">
        <div className="container px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="font-archivo text-3xl font-bold tracking-tight sm:text-4xl">
              Supported Networks
            </h2>
            <p className="mt-4 text-muted-foreground">
              Currently live on testnet, mainnet coming soon
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Image
                  src="/casper.png"
                  alt="Casper"
                  width={32}
                  height={32}
                  className="opacity-80"
                />
              </div>
              <span className="text-sm font-medium">Casper Testnet</span>
            </div>
            <div className="text-2xl text-muted-foreground">→</div>
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <div className="h-8 w-8 rounded-full bg-blue-500" />
              </div>
              <span className="text-sm font-medium">Base Sepolia</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/40">
        <div className="container px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-archivo text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to Bridge Your Identity?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Start creating your cross-chain attestation in minutes
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="obsidian-button px-8">
                <Link href="/attest">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="px-8">
                <Link href="/docs">
                  Read the Docs
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
