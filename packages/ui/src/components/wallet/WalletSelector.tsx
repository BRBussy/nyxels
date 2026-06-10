import { useState } from "react";
import { CheckIcon, ChevronDownIcon, Loader2Icon, PlusIcon, WalletIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWallets } from "@/contexts/WalletContext";
import { BrowserWallet, type BrowserWalletInfo } from "@/lib/wallet/BrowserWallet";
import { WalletSource } from "@/lib/wallet/Wallet";
import { AddSeedWalletDialog } from "./AddSeedWalletDialog";

/** Shorten a bech32m address for display: prefix…suffix. */
const shortAddress = (addr: string) => (addr.length <= 16 ? addr : `${addr.slice(0, 10)}…${addr.slice(-4)}`);

/**
 * The app's wallet picker. Shows which wallet is selected and drops down to:
 *  - the injected browser wallet(s) (e.g. Lace), with live connected state —
 *    selecting a seed wallet later does NOT disconnect them;
 *  - the named seed wallets loaded in the wallet context;
 *  - "Add seed wallet", which opens {@link AddSeedWalletDialog}.
 */
export function WalletSelector() {
  const { seedWallets, browserWallet, selectedWallet, selectWallet, connectBrowserWallet } = useWallets();

  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // walletKey currently being connected (drives the row's spinner), or null.
  const [connectingKey, setConnectingKey] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Re-enumerated every render — opening the menu re-renders, so the list picks
  // up extensions that finished injecting after first paint.
  const available = BrowserWallet.available();

  const handleBrowserWallet = async (info: BrowserWalletInfo) => {
    setConnectError(null);
    // Already connected → just point the selection at it.
    if (browserWallet && browserWallet.info.walletKey === info.walletKey) {
      selectWallet(browserWallet);
      return;
    }
    setConnectingKey(info.walletKey);
    try {
      const wallet = await connectBrowserWallet(info.walletKey);
      selectWallet(wallet);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnectingKey(null);
    }
  };

  const triggerLabel = selectedWallet ? selectedWallet.name : "Select wallet";

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              {selectedWallet?.source === WalletSource.BrowserWallet && browserWallet ? (
                <img src={browserWallet.info.icon} alt="" className="size-4 rounded-sm" />
              ) : (
                <WalletIcon />
              )}
              <span className="max-w-40 truncate">{triggerLabel}</span>
              <ChevronDownIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Browser wallet</DropdownMenuLabel>
            {available.length === 0 && (
              <DropdownMenuItem disabled>No Midnight wallet extension found</DropdownMenuItem>
            )}
            {available.map((info) => {
              const isConnected = browserWallet?.info.walletKey === info.walletKey;
              const isSelected = isConnected && selectedWallet === browserWallet;
              const isConnecting = connectingKey === info.walletKey;
              return (
                <DropdownMenuItem key={info.walletKey} onClick={() => void handleBrowserWallet(info)}>
                  <img src={info.icon} alt="" className="size-4 rounded-sm" />
                  <span className="truncate">{info.name}</span>
                  {isConnected && (
                    <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      connected
                    </span>
                  )}
                  {isConnecting && <Loader2Icon className="ml-auto animate-spin" />}
                  {isSelected && <CheckIcon className={isConnected ? "" : "ml-auto"} />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Seed wallets</DropdownMenuLabel>
            {seedWallets.length === 0 && <DropdownMenuItem disabled>No seed wallets yet</DropdownMenuItem>}
            {seedWallets.map((wallet) => (
              <DropdownMenuItem key={wallet.id} onClick={() => selectWallet(wallet)}>
                <WalletIcon />
                <span className="truncate">{wallet.name}</span>
                <span className="text-muted-foreground ml-auto font-mono text-xs">{shortAddress(wallet.id)}</span>
                {selectedWallet === wallet && <CheckIcon />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Add seed wallet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {connectError && <p className="text-destructive max-w-72 text-right text-xs">{connectError}</p>}

      <AddSeedWalletDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
