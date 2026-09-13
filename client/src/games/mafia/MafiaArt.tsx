import type { MafiaRole } from "../../../../functions/src/shared/mafia";
const tiles: Record<MafiaRole | "box" | "open" | "diamond" | "joker", number> =
  {
    box: 0,
    open: 1,
    diamond: 2,
    joker: 3,
    GODFATHER: 4,
    LOYAL_HENCHMAN: 5,
    AGENT_FBI: 6,
    AGENT_CIA: 7,
    DRIVER: 8,
    THIEF: 9,
    STREET_URCHIN: 10,
    CLEANER: 11,
  };
export function MafiaArt({
  kind,
  className = "",
}: {
  kind: keyof typeof tiles;
  className?: string;
}) {
  const index = tiles[kind];
  const column = index % 4;
  const frame =
    index < 4
      ? `${column * 362 + (kind === "open" ? 22 : 0)} 0 362 310`
      : `${column * 362 + 10} ${index < 8 ? 315 : 665} 342 342`;
  return (
    <svg
      aria-hidden="true"
      className={`mafia-art ${className}`}
      viewBox={frame}
    >
      <image href="/art/mafia-atlas.png" width="1448" height="1086" />
    </svg>
  );
}
