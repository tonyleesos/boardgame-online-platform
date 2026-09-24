import { useMemo, useRef, useState, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize, Flag, Home } from "lucide-react";
import {
  MINE_CARD_BY_ID,
  cellKey,
} from "../../../../functions/src/shared/saboteur";
import type { MineGame } from "../../../../functions/src/shared/saboteur";
import {
  frontier,
  validatePathPlacement,
} from "../../../../functions/src/shared/mineTopology";
import { TunnelArt } from "./MineArt";
export function MineBoard({
  game: g,
  uid,
  cardId,
  rotation,
  chosen,
  onChoose,
  onInspect,
}: {
  game: MineGame;
  uid: string;
  cardId?: string;
  rotation: 0 | 180;
  chosen: { x: number; y: number } | null;
  onChoose: (p: { x: number; y: number }) => void;
  onInspect: (key: string) => void;
}) {
  const ref = useRef<SVGSVGElement>(null),
    drag = useRef(new Map<number, { x: number; y: number }>()),
    moved = useRef(false),
    interacted = useRef(false);
  const [aspect, setAspect] = useState(1.7),
    [view, setView] = useState({ x: 320, y: 42, width: 880 });
  const height = view.width / aspect;
  useEffect(() => {
    const el = ref.current!;
    const o = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height) {
        const ratio = entry.contentRect.width / entry.contentRect.height;
        setAspect(ratio);
        if (!interacted.current)
          setView({ x: 320, y: 42, width: Math.max(880, 570 * ratio) });
      }
    });
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const card = cardId ? MINE_CARD_BY_ID[cardId] : null;
  const legal = useMemo(
    () =>
      card?.kind === "path"
        ? frontier(g.board).filter(
            (p) =>
              !validatePathPlacement(
                g.board,
                card,
                p.x,
                p.y,
                rotation,
                g.players[uid],
              ),
          )
        : [],
    [card, g.board, g.players, uid, rotation],
  );
  function fit() {
    const cells = Object.values(g.board),
      xs = cells.map((c) => c.x * 72),
      ys = cells.map((c) => c.y * 92);
    const minX = Math.min(...xs) - 80,
      maxX = Math.max(...xs) + 144,
      minY = Math.min(...ys) - 100,
      maxY = Math.max(...ys) + 180;
    setView({
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      width: Math.max(maxX - minX, (maxY - minY) * aspect),
    });
  }
  const zoom = (factor: number) => (
    (interacted.current = true),
    setView((v) => ({
      ...v,
      width: Math.max(260, Math.min(2400, v.width * factor)),
    }))
  );
  return (
    <section className="mine-map" aria-label="礦道棋盤">
      <div className="mine-map-controls">
        <button aria-label="放大棋盤" onClick={() => zoom(0.8)}>
          <ZoomIn size={18} />
        </button>
        <button aria-label="縮小棋盤" onClick={() => zoom(1.25)}>
          <ZoomOut size={18} />
        </button>
        <button aria-label="查看完整礦道" onClick={fit}>
          <Maximize size={18} />
        </button>
        <button
          aria-label="移至入口"
          onClick={() => setView((v) => ({ ...v, x: 32, y: 42 }))}
        >
          <Home size={18} />
        </button>
        <button
          aria-label="移至目標"
          onClick={() => setView((v) => ({ ...v, x: 8 * 72, y: 42 }))}
        >
          <Flag size={18} />
        </button>
      </div>
      <svg
        ref={ref}
        viewBox={`${view.x - view.width / 2} ${view.y - height / 2} ${view.width} ${height}`}
        role="group"
        aria-label="拖曳移動礦道，雙指縮放；點亮起位置蓋路"
        onPointerDown={(e) => {
          interacted.current = true;
          drag.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          moved.current = false;
        }}
        onPointerMove={(e) => {
          const old = drag.current.get(e.pointerId);
          if (!old) return;
          const other = [...drag.current.entries()].find(
              ([id]) => id !== e.pointerId,
            )?.[1],
            next = { x: e.clientX, y: e.clientY };
          const dx = next.x - old.x,
            dy = next.y - old.y;
          if (Math.abs(dx) + Math.abs(dy) > 2) {
            moved.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          const w = ref.current!.getBoundingClientRect().width;
          setView((v) => ({
            ...v,
            x: v.x - (dx * v.width) / w / (other ? 2 : 1),
            y: v.y - (dy * v.width) / w / (other ? 2 : 1),
            width: other
              ? Math.max(
                  260,
                  Math.min(
                    2400,
                    (v.width * Math.hypot(old.x - other.x, old.y - other.y)) /
                      Math.max(
                        1,
                        Math.hypot(next.x - other.x, next.y - other.y),
                      ),
                  ),
                )
              : v.width,
          }));
          drag.current.set(e.pointerId, next);
        }}
        onPointerUp={(e) => {
          drag.current.delete(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current.clear();
        }}
        onClickCapture={(e) => {
          if (moved.current) {
            e.stopPropagation();
            moved.current = false;
          }
        }}
      >
        {Object.entries(g.board).map(([key, t]) => (
          <g
            key={key}
            transform={`translate(${t.x * 72} ${t.y * 92})`}
            data-mine-cell={key}
            role="button"
            tabIndex={0}
            aria-label={
              t.type === "start"
                ? "礦坑入口"
                : t.type === "goal"
                  ? `${["8_-2", "8_0", "8_2"].indexOf(key) + 1} 號目標${t.revealed === "GOLD" ? "：黃金" : t.revealed === "ROCK" ? "：岩石" : "：未揭開"}`
                  : `${MINE_CARD_BY_ID[t.cardId].name}，座標 ${t.x},${t.y}`
            }
            onClick={() => onInspect(key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onInspect(key);
              }
            }}
          >
            <foreignObject
              width="64"
              height="84"
              className={t.revealed ? "mine-tile-revealed" : undefined}
            >
              <TunnelArt tile={t} />
            </foreignObject>
          </g>
        ))}
        {legal.map((pos) => {
          const selected = chosen?.x === pos.x && chosen.y === pos.y;
          return (
            <g
              key={cellKey(pos.x, pos.y)}
              transform={`translate(${pos.x * 72} ${pos.y * 92})`}
              role="button"
              tabIndex={0}
              aria-label={`放置道路 ${pos.x},${pos.y}`}
              onClick={() => onChoose(pos)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChoose(pos);
                }
              }}
            >
              <rect
                x="1"
                y="1"
                width="62"
                height="82"
                rx="8"
                fill={selected ? "#e3c27644" : "#84c99d18"}
                stroke={selected ? "#ffda87" : "#85cea4"}
                strokeWidth={selected ? 3 : 1.5}
                strokeDasharray={selected ? "" : "5 5"}
              />
              {selected && card ? (
                <foreignObject width="64" height="84" opacity=".8">
                  <TunnelArt
                    tile={{ ...pos, type: "path", cardId: card.id, rotation }}
                  />
                </foreignObject>
              ) : (
                <text
                  x="32"
                  y="50"
                  textAnchor="middle"
                  fontSize="28"
                  fill="#9bdeb3"
                >
                  ＋
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <span className="mine-map-hint">
        {card
          ? `亮起 ${legal.length} 個合法位置 · 可旋轉 180°`
          : "拖曳移動 · 雙指縮放 · 點道路查看"}
      </span>
    </section>
  );
}
