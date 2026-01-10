"use client";

import { Badge } from "@/components/ui/badge";
import { Tier, TIER_LABELS, TIER_BADGES } from "@/lib/contracts";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  tier: Tier;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function TierBadge({ tier, size = "md", showLabel = true }: TierBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-0.5",
    lg: "text-base px-3 py-1",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        TIER_BADGES[tier],
        sizeClasses[size]
      )}
    >
      {showLabel ? TIER_LABELS[tier] : tier}
    </Badge>
  );
}
