// seedWalletStore — localStorage persistence for the set of seed wallets the
// user has loaded, so they survive a page reload.
//
// The live SeedWallet (facade, keys, WASM handles) can't be serialised, so we
// persist only what's needed to re-derive it on next mount: the seed itself,
// plus the user's custom name when they've set one. The default name is derived
// from the address (see {@link defaultSeedWalletName}) and so is recomputed on
// restore rather than stored.
//
// Dedup is by the normalised hex form of the seed (see {@link SeedWallet.seedHex})
// so the same seed supplied as a mnemonic and as hex never persists twice.
import { parseSeed } from "@nyxels/lib";

const STORAGE_KEY = "nyxels:seed-wallets";

/** One persisted seed wallet — enough to re-derive the live wallet on reload. */
export interface StoredSeedWallet {
  /** The seed as supplied (mnemonic or hex). Re-derives the whole wallet. */
  seed: string;
  /** The user's custom name, if set. Absent → the default name is recomputed. */
  name?: string;
}

/** Normalised hex for dedup; mirrors {@link SeedWallet.seedHex}. */
function seedKey(seed: string): string {
  return parseSeed(seed).source.seedHex;
}

/** Like {@link seedKey} but never throws — a corrupt stored entry yields null. */
function safeSeedKey(seed: string): string | null {
  try {
    return seedKey(seed);
  } catch {
    return null;
  }
}

function read(): StoredSeedWallet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is StoredSeedWallet =>
        typeof e === "object" && e !== null && typeof (e as StoredSeedWallet).seed === "string",
    );
  } catch {
    return [];
  }
}

function write(entries: StoredSeedWallet[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full / unavailable — nothing actionable; in-memory state stands.
  }
}

/** Every persisted seed wallet, in stored order. */
export function loadStoredSeedWallets(): StoredSeedWallet[] {
  return read();
}

/** Persist `seed` if not already stored (dedup by normalised seed). No-op otherwise. */
export function addStoredSeedWallet(seed: string): void {
  const key = seedKey(seed);
  const entries = read();
  if (entries.some((e) => safeSeedKey(e.seed) === key)) return;
  entries.push({ seed });
  write(entries);
}

/** Drop the stored seed whose normalised form equals `seedHex`. */
export function removeStoredSeedWallet(seedHex: string): void {
  write(read().filter((e) => safeSeedKey(e.seed) !== seedHex));
}

/** Set (or clear, when blank) the stored custom name for `seedHex`. */
export function renameStoredSeedWallet(seedHex: string, name: string): void {
  const entries = read();
  const entry = entries.find((e) => safeSeedKey(e.seed) === seedHex);
  if (!entry) return;
  entry.name = name.trim() || undefined;
  write(entries);
}
