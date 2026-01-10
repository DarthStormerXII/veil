"use client";

import { useState, useCallback, useEffect } from "react";
import type { Attestation } from "@/lib/contracts";

const STORAGE_KEY = "veil_attestations";

interface StoredAttestation {
  id: string;
  attestationData: string; // hex encoded
  signature: string; // hex encoded
  casperAddress: string;
  targetChain: string;
  targetAddress: string;
  tier: number;
  createdAt: number;
  expiresAt: number;
  submittedToEvm: boolean;
}

// Local storage for attestations created on Casper
// In production, this would query the Casper chain directly
export function useAttestationStore() {
  const [attestations, setAttestations] = useState<StoredAttestation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setAttestations(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load attestations from storage:", e);
    }
    setIsLoading(false);
  }, []);

  // Save attestation
  const saveAttestation = useCallback((attestation: StoredAttestation) => {
    setAttestations((prev) => {
      const updated = [...prev.filter((a) => a.id !== attestation.id), attestation];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Mark as submitted to EVM
  const markAsSubmitted = useCallback((id: string) => {
    setAttestations((prev) => {
      const updated = prev.map((a) =>
        a.id === id ? { ...a, submittedToEvm: true } : a
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Get attestations for a specific EVM address
  const getAttestationsForAddress = useCallback(
    (evmAddress: string) => {
      return attestations.filter(
        (a) => a.targetAddress.toLowerCase() === evmAddress.toLowerCase()
      );
    },
    [attestations]
  );

  // Get pending attestations (not yet submitted to EVM)
  const getPendingAttestations = useCallback(
    (evmAddress: string) => {
      return attestations.filter(
        (a) =>
          a.targetAddress.toLowerCase() === evmAddress.toLowerCase() &&
          !a.submittedToEvm &&
          a.expiresAt > Date.now()
      );
    },
    [attestations]
  );

  // Remove attestation
  const removeAttestation = useCallback((id: string) => {
    setAttestations((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear all attestations
  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAttestations([]);
  }, []);

  return {
    attestations,
    isLoading,
    saveAttestation,
    markAsSubmitted,
    getAttestationsForAddress,
    getPendingAttestations,
    removeAttestation,
    clearAll,
  };
}

export type { StoredAttestation };
