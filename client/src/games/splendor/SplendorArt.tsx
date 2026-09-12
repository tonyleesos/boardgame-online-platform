import { useId } from "react";
import { GEM_NAMES } from "../../../../functions/src/shared/splendor";
import type {
  TokenColor,
  DevelopmentCard,
} from "../../../../functions/src/shared/splendor";

const PALETTE: Record<TokenColor, [string, string, string]> = {
  white: ["#ffffff", "#dce6e7", "#82999e"],
  blue: ["#89cfff", "#1266b5", "#062853"],
  green: ["#9deac1", "#168459", "#06432f"],
  red: ["#ff9c91", "#bc2633", "#640e20"],
  black: ["#a59a89", "#39342f", "#111211"],
  gold: ["#fff1a1", "#e3b940", "#a96916"],
};
const CUTS: Record<TokenColor, [string, string, string]> = {
  white: [
    "M10 8L27 5L37 17L19 34L3 21Z",
    "M10 8L14 18L3 21M27 5L24 16L37 17M14 18L19 34L24 16Z",
    "M10 8L27 5L24 16L14 18Z",
  ],
  blue: [
    "M5 26C-1 12 22-1 32 8C48 23 13 44 5 26Z",
    "M7 23L13 12L26 9L32 16L26 28L14 31ZM13 12L17 19L7 23M26 9L24 17L32 16M26 28L24 17L17 19L14 31",
    "M9 21Q12 11 24 10L20 13Q14 14 9 21Z",
  ],
  green: [
    "M8 6H31L36 11V29L30 35H8L3 29V12Z",
    "M11 12H28V28H11ZM8 6L11 12M28 12L31 6M3 29L11 28L8 35M28 28L36 29M28 12L36 11",
    "M11 12H28V16H11Z",
  ],
  red: [
    "M13 3L29 7L36 21L27 35L11 33L4 18Z",
    "M15 10L26 12L29 23L23 29L13 26L10 17ZM13 3L15 10L4 18M29 7L26 12L36 21L29 23M27 35L23 29L11 33L13 26",
    "M15 10L26 12L18 17L10 17Z",
  ],
  black: [
    "M7 9L29 4L37 27L14 36L3 27Z",
    "M12 13L26 10L30 24L16 29L9 24ZM7 9L12 13L9 24L3 27M29 4L26 10L30 24L37 27M16 29L14 36",
    "M12 13L26 10L23 14L12 18Z",
  ],
  gold: [
    "M10 7L28 4L37 29L15 36L3 29Z",
    "M10 7L13 31L31 26L28 4M13 31L15 36M31 26L37 29",
    "M10 7L28 4L29 10L11 14Z",
  ],
};
/** Distinct cuts match the familiar physical token silhouettes. */
export function GemIcon({
  color,
  size = 24,
}: {
  color: TokenColor;
  size?: number;
}) {
  const id = useId();
  const [light, mid, dark] = PALETTE[color];
  const [outline, facets, shine] = CUTS[color];
  return (
    <svg
      className={`sp-gem sp-gem-${color}`}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={GEM_NAMES[color]}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="80%" y2="100%">
          <stop stopColor={light} />
          <stop offset=".45" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <path d={outline} fill={`url(#${id})`} stroke={light} strokeWidth="1" />
      <path
        d={facets}
        fill="none"
        stroke={light}
        strokeWidth=".8"
        opacity=".65"
      />
      <path d={shine} fill={light} opacity=".8" />
      {color === "gold" && (
        <path
          d="M16 17L24 15M17 20L25 18M18 25L26 23"
          stroke="#98641e"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
export function GemAmount({
  color,
  count,
  destination,
}: {
  color: TokenColor;
  count: number;
  destination?: string;
}) {
  return (
    <span className={`sp-amount sp-${color}`} data-sp-destination={destination}>
      <GemIcon color={color} />
      <b>{count}</b>
    </span>
  );
}
/** SVG crops one cell of the local atlas without distorting its proportions. */
export function Artwork({
  cell,
  className = "sp-scene",
}: {
  cell: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={`${(cell % 3) * 100} ${Math.floor(cell / 3) * 100} 100 100`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <image href="/art/splendor-atlas.png" width="300" height="300" />
    </svg>
  );
}
export function CardScene({ card }: { card: DevelopmentCard }) {
  const variant = [...card.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const cell =
    card.tier === 1
      ? { white: 0, blue: 0, green: 1, red: 2, black: 1 }[card.bonusColor]
      : card.tier === 2
        ? 3 + (variant % 3)
        : 6 + (variant % 2);
  return <Artwork cell={cell} />;
}
