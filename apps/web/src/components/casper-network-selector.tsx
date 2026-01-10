"use client";

import { useCasperWallet, type CasperNetwork } from "@/providers/casper-wallet-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Server, Wifi, Check } from "lucide-react";

const networkConfig: Record<CasperNetwork, { label: string; icon: typeof Globe; color: string; disabled?: boolean }> = {
  localnet: { label: "Localnet", icon: Server, color: "text-yellow-500" },
  testnet: { label: "Testnet", icon: Wifi, color: "text-blue-500", disabled: true },
  mainnet: { label: "Mainnet", icon: Globe, color: "text-green-500", disabled: true },
};

export function CasperNetworkSelector() {
  const { network, setNetwork } = useCasperWallet();

  const currentNetwork = networkConfig[network];
  const Icon = currentNetwork.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Icon className={`h-4 w-4 ${currentNetwork.color}`} />
          <span className="hidden sm:inline">{currentNetwork.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {(Object.keys(networkConfig) as CasperNetwork[]).map((net) => {
          const config = networkConfig[net];
          const NetworkIcon = config.icon;
          const isSelected = net === network;
          const isDisabled = config.disabled;

          return (
            <DropdownMenuItem
              key={net}
              onClick={() => !isDisabled && setNetwork(net)}
              disabled={isDisabled}
              className={`cursor-pointer ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <NetworkIcon className={`mr-2 h-4 w-4 ${isDisabled ? "text-muted-foreground" : config.color}`} />
              {config.label}
              {isSelected && <Check className="ml-auto h-4 w-4" />}
              {isDisabled && !isSelected && <span className="ml-auto text-xs text-muted-foreground">Soon</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
