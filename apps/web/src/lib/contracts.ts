// Contract addresses and ABIs

export const CONTRACTS = {
  baseSepolia: {
    VeilVerifier: "0x0a3A0d3407acb40D11af9539a1c016E44deca4A0",
  },
  casperTestnet: {
    VeilAttestation: "", // To be deployed
    rpc: "https://rpc.testnet.casperlabs.io/rpc",
  },
} as const;

// Tier enum matching both contracts
export enum Tier {
  None = 0,
  Bronze = 1,
  Silver = 2,
  Gold = 3,
  Platinum = 4,
  Validator = 5,
}

export const TIER_LABELS: Record<Tier, string> = {
  [Tier.None]: "None",
  [Tier.Bronze]: "Bronze",
  [Tier.Silver]: "Silver",
  [Tier.Gold]: "Gold",
  [Tier.Platinum]: "Platinum",
  [Tier.Validator]: "Validator",
};

export const TIER_COLORS: Record<Tier, string> = {
  [Tier.None]: "text-muted-foreground",
  [Tier.Bronze]: "text-orange-400",
  [Tier.Silver]: "text-slate-300",
  [Tier.Gold]: "text-yellow-400",
  [Tier.Platinum]: "text-cyan-400",
  [Tier.Validator]: "text-purple-400",
};

export const TIER_BADGES: Record<Tier, string> = {
  [Tier.None]: "bg-muted text-muted-foreground",
  [Tier.Bronze]: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  [Tier.Silver]: "bg-slate-400/20 text-slate-300 border-slate-400/30",
  [Tier.Gold]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  [Tier.Platinum]: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  [Tier.Validator]: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

// VeilVerifier ABI (EVM)
export const VEIL_VERIFIER_ABI = [
  {
    inputs: [{ name: "_casperSigner", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  { inputs: [], name: "AttestationAlreadyUsed", type: "error" },
  { inputs: [], name: "AttestationExpired", type: "error" },
  { inputs: [], name: "AttestationIsRevoked", type: "error" },
  { inputs: [], name: "InvalidSignature", type: "error" },
  { inputs: [], name: "TargetAddressMismatch", type: "error" },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "attestationId", type: "bytes32" },
    ],
    name: "AttestationRevoked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "casperAddressHash", type: "bytes32" },
      { indexed: false, name: "tier", type: "uint8" },
      { indexed: false, name: "stake", type: "uint256" },
    ],
    name: "IdentityVerified",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, name: "newSigner", type: "address" }],
    name: "SignerUpdated",
    type: "event",
  },
  {
    inputs: [],
    name: "casperSigner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getStake",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getTier",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getVerifiedIdentity",
    outputs: [
      {
        components: [
          { name: "casperAddressHash", type: "bytes32" },
          { name: "tier", type: "uint8" },
          { name: "stake", type: "uint256" },
          { name: "accountAgeDays", type: "uint64" },
          { name: "verifiedAt", type: "uint64" },
          { name: "expiresAt", type: "uint64" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isVerified",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "attestation", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    name: "verify",
    outputs: [
      { name: "valid", type: "bool" },
      { name: "tier", type: "uint8" },
      { name: "stake", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "attestation", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    name: "verifyAndStore",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "bytes32" }],
    name: "usedAttestations",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "bytes32" }],
    name: "revokedAttestations",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Attestation data structure
export interface Attestation {
  id: string; // hex string
  casperAddress: string;
  targetChain: string;
  targetAddress: string;
  stakeAmount: string;
  tier: Tier;
  accountAgeDays: number;
  createdAt: number;
  expiresAt: number;
  nonce: number;
  revoked: boolean;
}

export interface VerifiedIdentity {
  casperAddressHash: string;
  tier: Tier;
  stake: bigint;
  accountAgeDays: number;
  verifiedAt: number;
  expiresAt: number;
}

// Helper to format stake amounts
export function formatStake(motes: bigint | string): string {
  const value = typeof motes === "string" ? BigInt(motes) : motes;
  const cspr = Number(value) / 1_000_000_000;
  return cspr.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Helper to check if attestation/identity is expired
export function isExpired(expiresAtMs: number): boolean {
  return Date.now() >= expiresAtMs;
}

// Helper to format expiry time
export function formatExpiry(expiresAtMs: number): string {
  const date = new Date(expiresAtMs);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Helper to get time remaining
export function getTimeRemaining(expiresAtMs: number): string {
  const now = Date.now();
  const diff = expiresAtMs - now;

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h remaining`;

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes}m remaining`;
}
