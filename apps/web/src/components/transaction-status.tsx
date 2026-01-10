"use client";

import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TransactionState = "idle" | "pending" | "confirming" | "success" | "error";

interface TransactionStatusProps {
  state: TransactionState;
  hash?: string;
  error?: string;
  explorerUrl?: string;
  onReset?: () => void;
  successMessage?: string;
  pendingMessage?: string;
  confirmingMessage?: string;
}

export function TransactionStatus({
  state,
  hash,
  error,
  explorerUrl,
  onReset,
  successMessage = "Transaction confirmed!",
  pendingMessage = "Waiting for wallet...",
  confirmingMessage = "Confirming transaction...",
}: TransactionStatusProps) {
  if (state === "idle") return null;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        state === "error" && "border-red-500/50 bg-red-500/10",
        state === "success" && "border-green-500/50 bg-green-500/10",
        (state === "pending" || state === "confirming") && "border-yellow-500/50 bg-yellow-500/10"
      )}
    >
      <div className="flex items-start gap-3">
        {state === "pending" && (
          <Loader2 className="h-5 w-5 text-yellow-500 animate-spin mt-0.5" />
        )}
        {state === "confirming" && (
          <Loader2 className="h-5 w-5 text-yellow-500 animate-spin mt-0.5" />
        )}
        {state === "success" && (
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
        )}
        {state === "error" && (
          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {state === "pending" && pendingMessage}
            {state === "confirming" && confirmingMessage}
            {state === "success" && successMessage}
            {state === "error" && "Transaction failed"}
          </p>

          {error && state === "error" && (
            <p className="text-sm text-red-400 mt-1 break-words">{error}</p>
          )}

          {hash && (
            <div className="flex items-center gap-2 mt-2">
              <code className="text-xs text-muted-foreground font-mono truncate">
                {hash.slice(0, 10)}...{hash.slice(-8)}
              </code>
              {explorerUrl && (
                <a
                  href={`${explorerUrl}/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View
                </a>
              )}
            </div>
          )}

          {(state === "success" || state === "error") && onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="mt-2 h-7 text-xs"
            >
              {state === "error" ? "Try Again" : "Done"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
