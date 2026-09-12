import { useCallback, useState } from "react";
import type { Game } from "../../../../functions/src/shared/model";
import {
  createAvalonPresentation,
  finishAvalonStage,
  reconcileAvalonPresentation,
} from "./avalonPresentation";

export function useAvalonPresentation(game: Game) {
  const [state, setState] = useState(() => createAvalonPresentation(game));
  // Updating this component's own state before committing prevents a one-frame
  // mission dialog/result flash when the authoritative phase changes.
  if (state.observed !== game)
    setState(reconcileAvalonPresentation(state, game));
  const finish = useCallback(() => setState(finishAvalonStage), []);
  const stage = state.queue[0];
  return { stage, game: stage?.game ?? game, finish };
}
