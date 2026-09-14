import { canTakeDifferentGems, canTakeDoubleGem } from "../../../../functions/src/shared/splendor";
import type { GemColor, SplendorAction, SplendorPlayerState, SplendorPublicState } from "../../../../functions/src/shared/splendor";

/** Cycle a single color 0 → 1 → 2 → 0; mixed colors toggle individually. */
export function nextGemSelection(game: SplendorPublicState, selected: GemColor[], color: GemColor): GemColor[] {
  if (selected.includes(color)) {
    if (selected.length === 1 && canTakeDoubleGem(game, color)) return [color, color];
    return selected.filter((item) => item !== color);
  }
  if (game.bank[color] <= 0 || new Set(selected).size !== selected.length || selected.length >= 3) return selected;
  return [...selected, color];
}

export function gemSelectionAction(game: SplendorPublicState, player: SplendorPlayerState, selected: GemColor[]): SplendorAction | null {
  if (selected.length === 2 && selected[0] === selected[1]) return canTakeDoubleGem(game, selected[0]) ? { type: "splendorDouble", color: selected[0] } : null;
  return canTakeDifferentGems(game, player, selected) ? { type: "splendorTake", colors: selected } : null;
}
