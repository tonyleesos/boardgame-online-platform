import type { CSSProperties } from "react";
import { GEM_NAMES } from "../../../../functions/src/shared/splendor";
import type {
  TokenColor,
  DevelopmentCard,
} from "../../../../functions/src/shared/splendor";
const GEM_PALETTE: Record<TokenColor, string> = {
  white: "#deeff3",
  blue: "#3d9deb",
  green: "#37bf99",
  red: "#ed6575",
  black: "#9297b2",
  gold: "#edc36f",
};
const shapes: Record<TokenColor, string> = {
  white: "12,3 27,3 36,14 20,36 4,14",
  blue: "20,2 31,8 35,23 27,35 13,35 5,23 9,8",
  green: "10,4 30,4 36,12 36,28 30,36 10,36 4,28 4,12",
  red: "20,2 36,14 31,31 20,38 9,31 4,14",
  black: "13,2 27,2 33,9 33,31 27,38 13,38 7,31 7,9",
  gold: "20,2 33,7 38,20 33,33 20,38 7,33 2,20 7,7",
};
export function GemIcon({
  color,
  size = 24,
}: {
  color: TokenColor;
  size?: number;
}) {
  return (
    <svg
      className="sp-gem"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={GEM_NAMES[color]}
      style={{ "--gem": GEM_PALETTE[color] } as CSSProperties}
    >
      <polygon
        points={shapes[color]}
        fill="var(--gem)"
        stroke="#fff8"
        strokeWidth="1"
      />
      <path d="M12 12L28 12L30 25L20 32L10 25Z" fill="#fff3" />
      <path d="M12 12L20 4L28 12L20 20Z" fill="#fff8" />
      <path d="M20 20L30 25L20 36L10 25Z" fill="#0004" />
      <path d="M12 12L20 20L10 25L5 14Z" fill="#fff4" />
      {color === "gold" && (
        <path
          d="M20 11L22 17L29 18L24 22L25 29L20 25L15 29L16 22L11 18L18 17Z"
          fill="#865017"
        />
      )}
    </svg>
  );
}
export function GemAmount({
  color,
  count,
}: {
  color: TokenColor;
  count: number;
}) {
  return (
    <span className={`sp-amount sp-${color}`}>
      <GemIcon color={color} />
      <b>{count}</b>
    </span>
  );
}
/** Project-owned geometric landscapes, drawn as vectors for crisp small screens. */
export function CardScene({ card }: { card: DevelopmentCard }) {
  const tint = GEM_PALETTE[card.bonusColor];
  return (
    <svg
      className="sp-scene"
      viewBox="0 0 160 200"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="160" height="200" fill="#172e40" />
      <path d="M0 0H160V118L0 154Z" fill={tint} opacity=".4" />
      <circle
        cx={card.tier === 2 ? 115 : 42}
        cy="48"
        r="24"
        fill="#ffe4a3"
        opacity=".72"
      />
      <path d="M0 106L48 65L79 92L124 58L160 108V200H0Z" fill="#243d49" />
      {card.tier === 1 ? (
        <>
          <path
            d="M0 137L44 103L65 135L107 113L160 149V200H0Z"
            fill={tint}
            opacity=".7"
          />
          <path
            d="M63 200L97 142L89 122L99 120L111 142L90 200Z"
            fill="#c9d9c5"
            opacity=".6"
          />
          <path d="M15 140V108L35 86L57 107V144Z" fill="#c5b18a" />
          <path d="M11 109L35 83L60 109Z" fill="#645449" />
          <path d="M27 140V121Q35 107 44 121V140" fill="#233638" />
          <path
            d="M120 164V114M107 132L120 105L135 133M105 148L120 119L138 148"
            fill="#254c40"
            stroke="#294f42"
            strokeWidth="5"
          />
        </>
      ) : card.tier === 2 ? (
        <>
          <path d="M0 136H160V200H0Z" fill="#457985" />
          <path
            d="M0 147L160 162M0 172L160 185"
            stroke="#8cc2c0"
            opacity=".4"
          />
          <path d="M15 144V89H51V144M25 88V73H41V88" fill="#c3ac85" />
          <path d="M10 90L34 64L57 90" fill="#e2c894" />
          <path d="M26 118V103Q34 94 42 103V118" fill="#35414a" />
          <path d="M67 151L135 151L120 167H81Z" fill="#513f37" />
          <path
            d="M104 151V70M106 77L137 141H106Z"
            fill="#efdab1"
            stroke="#c6ac7d"
            strokeWidth="2"
          />
          <path d="M99 90L71 141H99Z" fill={tint} />
        </>
      ) : (
        <>
          <path d="M22 168V82H137V168Z" fill="#bfa783" />
          <path d="M33 89V57H61V89M96 89V57H124V89" fill="#dfcca8" />
          <path d="M28 60L47 35L66 60M91 60L110 35L129 60" fill={tint} />
          <path d="M61 89V65Q80 33 99 65V89Z" fill="#d7ba7e" />
          <path
            d="M64 168V112Q80 90 96 112V168M32 114V100H46V114M113 114V100H127V114"
            fill="#3b4850"
          />
          <path
            d="M10 170H150M4 180H156M0 192H160"
            stroke="#dec69b"
            strokeWidth="7"
          />
        </>
      )}
      <path d="M5 0V195H155V0" fill="none" stroke="#ffe8ba" opacity=".25" />
      <path d="M0 179H160V200H0Z" fill="#0b1726" opacity=".55" />
    </svg>
  );
}
