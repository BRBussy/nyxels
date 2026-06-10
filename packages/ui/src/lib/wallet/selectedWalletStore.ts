// selectedWalletStore — localStorage persistence for WHICH wallet is selected,
// so the selection survives a page reload.
//
// A wallet's `id` (unshielded address) is network-dependent and only known once
// the wallet is online, so the selection is stored as a stable reference
// instead: seed wallets by their normalised seed hex, the browser wallet by its
// source alone (only one can be connected). A persisted browser-wallet
// selection only resolves again once the user reconnects the extension.
import { WalletSource } from "@/lib/wallet/Wallet";

const STORAGE_KEY = "nyxels:selected-wallet";

/** A reload-stable reference to a wallet. */
export type SelectedWalletRef =
  | { source: typeof WalletSource.Seed; seedHex: string }
  | { source: typeof WalletSource.BrowserWallet };

export function loadSelectedWalletRef(): SelectedWalletRef | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const ref = parsed as SelectedWalletRef;
    if (ref.source === WalletSource.Seed && typeof ref.seedHex === "string") return ref;
    if (ref.source === WalletSource.BrowserWallet) return ref;
    return null;
  } catch {
    return null;
  }
}

export function saveSelectedWalletRef(ref: SelectedWalletRef | null): void {
  if (typeof window === "undefined") return;
  try {
    if (ref === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ref));
  } catch {
    // Storage unavailable — selection just won't survive the reload.
  }
}
