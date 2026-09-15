import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Castle, Check, Crown, Gem } from "lucide-react";
import { CARD_BY_ID } from "../../../../functions/src/shared/splendor";
import { CardScene, GemIcon } from "./SplendorArt";

import {
  findTransferTarget,
  transferCenter,
  visibleTransferPoint,
  type TransferPlayback,
} from "./splendorTransferGeometry";

export function SplendorTransfer({
  playback,
  boardRef,
  onComplete,
}: {
  playback: TransferPlayback;
  boardRef: RefObject<HTMLDivElement | null>;
  onComplete: () => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layer = layerRef.current;
    const board = boardRef.current;
    if (!layer || !board) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animations: Animation[] = [];
    const inventory = board.querySelector(".sp-dock");
    const dock = inventory?.getBoundingClientRect().height ? inventory : board.querySelector(".sp-bank");
    const receipt = layer.querySelector<HTMLElement>(".sp-transfer-receipt")!;
    // A manual popover keeps the visual above any follow-up game dialog without
    // taking focus or blocking its controls. Older browsers use the fixed layer.
    layer.showPopover?.();
    const positionReceipt = () => {
      const rect = dock?.getBoundingClientRect();
      receipt.style.left = `${Math.max(12, Math.min(window.innerWidth - receipt.offsetWidth - 12, rect?.left ?? 12))}px`;
      receipt.style.top = `${Math.max(12, Math.min(window.innerHeight - receipt.offsetHeight - 12, (rect?.top ?? window.innerHeight - 140) - receipt.offsetHeight - 10))}px`;
    };
    positionReceipt();
    const arrivals = new Map<HTMLElement, number>();
    layer
      .querySelectorAll<HTMLElement>(".sp-transfer-item")
      .forEach((node, index) => {
        const item = playback.items[index];
        const target = findTransferTarget(
          board,
          "data-sp-destination",
          item.destination,
        ) ?? findTransferTarget(board, "data-sp-source", item.destination);
        const to = visibleTransferPoint(transferCenter(target ?? dock));
        const source = findTransferTarget(board, "data-sp-source", item.source) ??
          findTransferTarget(board, "data-sp-destination", item.source) ??
          board.querySelector(".sp-market");
        const from = visibleTransferPoint(transferCenter(source), item.color ? 30 : 52);
        const delay = reduce ? 0 : index * 110;
        if (target) arrivals.set(target, delay);
        if (reduce) {
          node.hidden = true;
          return;
        }
        const at = (x: number, y: number, scale: number, angle: number) =>
          `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale}) rotate(${angle}deg)`;
        animations.push(
          node.animate(
            [
              { transform: at(from.x, from.y, 1, -8), opacity: 0, offset: 0 },
              {
                transform: at(from.x, from.y - 20, 1.12, 4),
                opacity: 1,
                offset: 0.18,
              },
              {
                transform: at(
                  from.x + (to.x - from.x) * 0.5,
                  Math.max(36, Math.min(from.y, to.y) - 65),
                  0.95,
                  -4,
                ),
                opacity: 1,
                offset: 0.52,
              },
              {
                transform: at(to.x, to.y, item.color ? 0.42 : 0.22, 0),
                opacity: 1,
                offset: 0.9,
              },
              { transform: at(to.x, to.y, 0.12, 0), opacity: 0, offset: 1 },
            ],
            {
              duration: 850,
              delay,
              easing: "cubic-bezier(.22,.7,.25,1)",
              fill: "both",
            },
          ),
        );
      });
    arrivals.forEach((delay, target) =>
      animations.push(
        target.animate(
          reduce
            ? [{ opacity: 0.65 }, { opacity: 1 }]
            : [
                { transform: "scale(1)", boxShadow: "0 0 0 0 #efd58c00" },
                {
                  transform: "scale(1.16)",
                  boxShadow: "0 0 0 7px #efd58c55",
                  offset: 0.45,
                },
                { transform: "scale(1)", boxShadow: "0 0 0 12px #efd58c00" },
              ],
          { duration: reduce ? 180 : 550, delay: reduce ? 0 : 740 + delay },
        ),
      ),
    );
    animations.push(
      receipt.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 180,
        fill: "both",
      }),
    );
    const timer = window.setTimeout(
      onComplete,
      2600 + playback.items.length * 110,
    );
    // Scrolling or resizing must not leave flying items pointing at stale positions.
    const settle = () => {
      layer
        .querySelectorAll<HTMLElement>(".sp-transfer-item")
        .forEach((node) => {
          node.hidden = true;
        });
      positionReceipt();
    };
    window.addEventListener("resize", settle);
    window.addEventListener("scroll", settle, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", settle);
      window.removeEventListener("scroll", settle, true);
      animations.forEach((animation) => animation.cancel());
      if (
        typeof layer.hidePopover === "function" &&
        layer.matches(":popover-open")
      )
        layer.hidePopover();
    };
  }, [playback, boardRef, onComplete]);
  return createPortal(
    <div className="sp-transfer-layer" ref={layerRef} popover="manual">
      <div aria-hidden="true">
        {playback.items.map((item, index) => (
          <div
            key={index}
            className={`sp-transfer-item ${item.color ? "sp-transfer-gem" : "sp-transfer-card"}`}
          >
            {item.color ? (
              <span className={`sp-token-${item.color}`}>
                <span className="sp-chip">
                  <span className="sp-chip-face">
                    <GemIcon color={item.color} size={40} />
                  </span>
                </span>
              </span>
            ) : item.symbol ? (
              <span className="sp-transfer-symbol">{item.symbol === "noble" ? <Crown size={40} /> : <Castle size={40} />}</span>
            ) : item.cardId ? (
              <>
                <CardScene card={CARD_BY_ID[item.cardId]} />
                <span className="sp-transfer-card-bonus">
                  <GemIcon color={CARD_BY_ID[item.cardId].bonusColor} />
                </span>
                <small>{CARD_BY_ID[item.cardId].name}</small>
              </>
            ) : (
              <span className={`sp-deck tier-${item.tier}`}>
                <Gem size={32} />
                <span>{"•".repeat(item.tier ?? 1)}</span>
              </span>
            )}
          </div>
        ))}
      </div>
      <div
        className="sp-transfer-receipt"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <Check size={22} />
        <span>
          <strong>{playback.title}</strong>
          <small>{playback.detail}</small>
        </span>
      </div>
    </div>,
    document.body,
  );
}
