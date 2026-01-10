"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { CONTRACTS, VEIL_VERIFIER_ABI, type VerifiedIdentity, Tier } from "@/lib/contracts";

const contractConfig = {
  address: CONTRACTS.baseSepolia.VeilVerifier as `0x${string}`,
  abi: VEIL_VERIFIER_ABI,
  chainId: baseSepolia.id,
} as const;

// Check if user is verified
export function useIsVerified(address: `0x${string}` | undefined) {
  return useReadContract({
    ...contractConfig,
    functionName: "isVerified",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

// Get user's tier
export function useGetTier(address: `0x${string}` | undefined) {
  return useReadContract({
    ...contractConfig,
    functionName: "getTier",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

// Get user's stake
export function useGetStake(address: `0x${string}` | undefined) {
  return useReadContract({
    ...contractConfig,
    functionName: "getStake",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

// Get full verified identity
export function useGetVerifiedIdentity(address: `0x${string}` | undefined) {
  const result = useReadContract({
    ...contractConfig,
    functionName: "getVerifiedIdentity",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Transform the tuple result into a typed object
  const identity: VerifiedIdentity | null = result.data
    ? {
        casperAddressHash: result.data.casperAddressHash,
        tier: result.data.tier as Tier,
        stake: result.data.stake,
        accountAgeDays: Number(result.data.accountAgeDays),
        verifiedAt: Number(result.data.verifiedAt) * 1000, // Convert to ms
        expiresAt: Number(result.data.expiresAt), // Already in ms from Casper
      }
    : null;

  return {
    ...result,
    identity,
  };
}

// Check if attestation is used
export function useIsAttestationUsed(attestationId: `0x${string}` | undefined) {
  return useReadContract({
    ...contractConfig,
    functionName: "usedAttestations",
    args: attestationId ? [attestationId] : undefined,
    query: {
      enabled: !!attestationId,
    },
  });
}

// Verify attestation (read-only check)
export function useVerifyAttestation(
  attestation: `0x${string}` | undefined,
  signature: `0x${string}` | undefined
) {
  return useReadContract({
    ...contractConfig,
    functionName: "verify",
    args: attestation && signature ? [attestation, signature] : undefined,
    query: {
      enabled: !!attestation && !!signature,
    },
  });
}

// Verify and store attestation (write)
export function useVerifyAndStore() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const verifyAndStore = async (attestation: `0x${string}`, signature: `0x${string}`) => {
    writeContract({
      ...contractConfig,
      functionName: "verifyAndStore",
      args: [attestation, signature],
    });
  };

  return {
    verifyAndStore,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    receipt,
    reset,
  };
}

// Get casper signer address
export function useCasperSigner() {
  return useReadContract({
    ...contractConfig,
    functionName: "casperSigner",
  });
}
