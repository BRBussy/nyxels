import { useState } from "react";
import { DicesIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateMnemonic } from "@nyxels/lib";
import { useWallets } from "@/contexts/WalletContext";

interface AddSeedWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for loading a seed wallet: paste a seed (12/24-word mnemonic or hex)
 * or generate a fresh random one. On add, the wallet is brought online via the
 * wallet context and becomes the selected wallet.
 */
export function AddSeedWalletDialog({ open, onOpenChange }: AddSeedWalletDialogProps) {
  const { getSeedWallet, selectWallet } = useWallets();

  const [seed, setSeed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset transient state whenever the dialog closes (cancel, escape, add).
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSeed("");
      setError(null);
      setBusy(false);
    }
    onOpenChange(next);
  };

  const handleGenerate = () => {
    setSeed(generateMnemonic());
    setError(null);
  };

  const handleAdd = async () => {
    setBusy(true);
    setError(null);
    try {
      // Resolves once the wallet is started (addresses + name known).
      const wallet = await getSeedWallet(seed);
      selectWallet(wallet);
      handleOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add seed wallet</DialogTitle>
          <DialogDescription>
            Paste a 12 or 24-word mnemonic, or a hex seed — or generate a fresh one. Seeds are kept in this
            browser's local storage.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="seed-input">Seed</Label>
          <Textarea
            id="seed-input"
            value={seed}
            placeholder="word1 word2 … word12  ·  or 64 hex characters"
            rows={3}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
            onChange={(e) => {
              setSeed(e.target.value);
              setError(null);
            }}
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" disabled={busy} onClick={handleGenerate}>
            <DicesIcon /> Generate random
          </Button>
          <Button type="button" disabled={busy || seed.trim() === ""} onClick={handleAdd}>
            {busy && <Loader2Icon className="animate-spin" />}
            {busy ? "Starting wallet…" : "Add wallet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
