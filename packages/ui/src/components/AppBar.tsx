import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWallets } from "@/contexts/WalletContext";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { WalletSelector } from "./wallet/WalletSelector.tsx";

/** Which tool the canvas is in. (Const object + union — see lib/network.ts.) */
export const Mode = {
  Draw: "draw",
  View: "view",
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

interface AppBarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

/** The app icon — the favicon's freehand stroke, inlined. */
function Logo() {
  return (
    <svg viewBox="0 0 16 16" className="app-logo" aria-hidden="true">
      <rect width="16" height="16" rx="3" fill="#3b82f6" />
      <path d="M4 11 Q6 4 8 8 T12 6" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The global app bar: brand on the left, the View/Draw mode switcher centred,
 * and the wallet selector + theme toggle on the right.
 *
 * Drawing means committing strokes as the selected wallet, so Draw is disabled
 * until a wallet is selected — a tooltip on the disabled button says why.
 */
export function AppBar({ mode, onModeChange }: AppBarProps) {
  const { selectedWallet } = useWallets();
  const canDraw = selectedWallet !== null;

  const drawButton = (
    <button
      type="button"
      className="mode-btn"
      aria-pressed={mode === Mode.Draw}
      disabled={!canDraw}
      onClick={() => onModeChange(Mode.Draw)}
    >
      Draw
    </button>
  );

  return (
    <header className="app-bar">
      <div className="app-bar-side">
        <Logo />
        <span className="app-name">Nyxels</span>
      </div>

      <div className="modes" role="group" aria-label="Mode">
        <button
          type="button"
          className="mode-btn"
          aria-pressed={mode === Mode.View}
          onClick={() => onModeChange(Mode.View)}
        >
          View
        </button>
        {canDraw ? (
          drawButton
        ) : (
          // A disabled button swallows pointer events, so the span is the
          // hoverable tooltip trigger around it.
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>{drawButton}</TooltipTrigger>
            <TooltipContent>Select a Wallet to enter Draw Mode</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="app-bar-side app-bar-side--end">
        <WalletSelector />
        <ThemeToggle />
      </div>
    </header>
  );
}
