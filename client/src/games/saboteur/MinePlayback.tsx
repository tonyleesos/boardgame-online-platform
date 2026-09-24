import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HardHat, Pickaxe, ArrowRight, Sparkles } from "lucide-react";
import {
  MINE_MOTION_MS,
  MINE_CARD_BY_ID,
} from "../../../../functions/src/shared/saboteur";
import type {
  MineActivity,
  MineGame,
} from "../../../../functions/src/shared/saboteur";
import { TunnelArt } from "./MineArt";
import { ActionIllustration, GoldArt } from "./MineIllustrations";
function Playback({
  event,
  game,
  done,
}: {
  event: MineActivity;
  game: MineGame;
  done: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showPopover?.();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const player = (id: string) =>
      document.querySelector(`[data-mine-player="${CSS.escape(id)}"]`);
    const cell = event.cell
      ? document.querySelector(`[data-mine-cell="${CSS.escape(event.cell)}"]`)
      : null;
    const target =
      event.kind === "THEFT"
        ? player(event.uid)
        : (cell ?? player(event.target ?? event.uid));
    const source = player(
      event.kind === "THEFT" ? (event.target ?? event.uid) : event.uid,
    );
    const s = source?.getBoundingClientRect(),
      t = target?.getBoundingClientRect();
    const chip = el.querySelector<HTMLElement>(".mine-flight")!;
    const startX = Math.max(
      35,
      Math.min(innerWidth - 35, s ? s.left + s.width / 2 : innerWidth / 2),
    );
    const endX = Math.max(
      35,
      Math.min(innerWidth - 35, t ? t.left + t.width / 2 : innerWidth / 2),
    );
    const top = Math.max(
      65,
      Math.min(innerHeight - 200, s ? s.bottom + 30 : innerHeight / 2),
    );
    const endY = Math.max(
      65,
      Math.min(innerHeight - 130, t ? t.top + t.height / 2 : innerHeight / 2),
    );
    chip.style.left = `${startX}px`;
    chip.style.top = `${top}px`;
    const animation = reduced
      ? null
      : chip.animate(
          [
            { transform: "translate(-50%,0) scale(.7)", opacity: 0 },
            {
              transform: "translate(-50%,30px) scale(1.15)",
              opacity: 1,
              offset: 0.2,
            },
            {
              transform: `translate(calc(-50% + ${endX - startX}px),${endY - top}px) scale(1)`,
              opacity: 1,
              offset: 0.75,
            },
            {
              transform: `translate(calc(-50% + ${endX - startX}px),${endY - top}px) scale(.7)`,
              opacity: 0,
            },
          ],
          { duration: 2600, fill: "both", easing: "ease-in-out" },
        );
    if (reduced) chip.hidden = true;
    const pulse = target?.animate(
      reduced
        ? [{ opacity: 1 }, { opacity: 1 }]
        : [
            { boxShadow: "0 0 0 0 #efc96d00" },
            { boxShadow: "0 0 0 5px #efc96d88" },
            { boxShadow: "0 0 0 0 #efc96d00" },
          ],
      { duration: 1800, delay: 700 },
    );
    const timer = setTimeout(done, MINE_MOTION_MS);
    return () => {
      clearTimeout(timer);
      animation?.cancel();
      pulse?.cancel();
      if (el.matches(":popover-open")) el.hidePopover?.();
    };
  }, [event, done]);
  const card = event.cardId ? MINE_CARD_BY_ID[event.cardId] : undefined;
  return createPortal(
    <div className="mine-playback" ref={ref} popover="manual">
      <div className="mine-flight" aria-hidden="true">
        {card?.kind === "path" ? (
          <TunnelArt
            tile={{
              x: 0,
              y: 0,
              type: "path",
              cardId: card.id,
              rotation: event.rotation ?? 0,
            }}
          />
        ) : event.kind === "THEFT" ? (
          <GoldArt size={58} />
        ) : card?.kind === "action" ? (
          <ActionIllustration card={card} />
        ) : event.kind === "mineNext" ? (
          <HardHat size={46} />
        ) : (
          <Pickaxe size={46} />
        )}
      </div>
      <div className="mine-receipt" role="status">
        <Sparkles size={22} />
        <span>
          <b>
            {game.players[event.uid]?.nickname ?? "矮人"}{" "}
            <ArrowRight size={13} />
          </b>
          <strong>{event.text}</strong>
        </span>
      </div>
    </div>,
    document.body,
  );
}
export function MinePlayback({ game }: { game: MineGame }) {
  const [state, setState] = useState<{
    revision: number;
    queue: MineActivity[];
  }>({ revision: game.revision, queue: [] });
  if (game.revision > state.revision)
    setState({
      revision: game.revision,
      queue: [
        ...state.queue,
        ...game.activities.filter((a) => a.revision > state.revision),
      ],
    });
  const done = useCallback(
    () => setState((v) => ({ ...v, queue: v.queue.slice(1) })),
    [],
  );
  return state.queue.length ? (
    <Playback
      key={state.queue[0].revision}
      event={state.queue[0]}
      game={game}
      done={done}
    />
  ) : null;
}
