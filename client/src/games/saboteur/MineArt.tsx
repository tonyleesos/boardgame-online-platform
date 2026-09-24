import {
  Pickaxe,
  Lamp,
  CarFront,
  LockKeyhole,
  UnlockKeyhole,
  Hand,
  ArrowLeftRight,
  Eye,
  HardHat,
  Map,
  Mountain,
  ShieldCheck,
} from "lucide-react";
import {
  EFFECT_NAMES,
  MINE_CARD_BY_ID,
} from "../../../../functions/src/shared/saboteur";
import type {
  ActionKind,
  Effect,
  MineCard,
  MineTile,
} from "../../../../functions/src/shared/saboteur";
import { tileChannels } from "../../../../functions/src/shared/mineTopology";
import {
  ActionIllustration,
  GoldArt,
  CrystalArt,
  StoneFrame,
} from "./MineIllustrations";
export function MineIcon({
  kind,
  size = 22,
}: {
  kind: ActionKind | Effect | "path";
  size?: number;
}) {
  const Icon = {
    PICKAXE: Pickaxe,
    LANTERN: Lamp,
    CART: CarFront,
    BREAK: Pickaxe,
    REPAIR: ShieldCheck,
    TRAPPED: LockKeyhole,
    FREEDOM: UnlockKeyhole,
    THEFT: Hand,
    HANDS_OFF: ShieldCheck,
    SWAP_HANDS: ArrowLeftRight,
    INSPECTION: Eye,
    CHANGE_HATS: HardHat,
    MAP: Map,
    ROCKFALL: Mountain,
    path: Pickaxe,
  }[kind];
  return <Icon size={size} aria-hidden="true" />;
}
export function EffectIcons({ effects }: { effects: Effect[] }) {
  return (
    <span className="mine-effects">
      {effects.map((e) => (
        <span
          key={e}
          className={e === "THEFT" ? "mine-effect-gold" : "mine-effect-bad"}
          role="img"
          aria-label={EFFECT_NAMES[e]}
          title={EFFECT_NAMES[e]}
        >
          <MineIcon kind={e} size={17} />
          {e !== "THEFT" && <i />}
        </span>
      ))}
    </span>
  );
}
const PORTS = { N: [32, 0], E: [64, 42], S: [32, 84], W: [0, 42] };
export function TunnelArt({ tile }: { tile: MineTile }) {
  const c = MINE_CARD_BY_ID[tile.cardId],
    path = c?.kind === "path" ? c : null;
  if (tile.type === "goal" && !tile.revealed)
    return (
      <svg viewBox="0 0 64 84" className="mine-tile-art" aria-hidden="true">
        <StoneFrame warm />
        <rect
          x="10"
          y="12"
          width="44"
          height="53"
          rx="5"
          fill="#6b4529"
          stroke="#f2d494"
        />
        <path d="m18 24 28 28M18 52l28-28" stroke="#ebc273" strokeWidth="5" />
        <circle cx="32" cy="38" r="12" fill="#533d29" stroke="#d5af69" />
        <text x="32" y="46" textAnchor="middle" fill="#fff0c7" fontSize="24">
          ?
        </text>
        <text x="32" y="77" textAnchor="middle" fill="#fff0c7" fontSize="10">
          {tile.y === -2 ? "1" : tile.y === 0 ? "2" : "3"} 號目標
        </text>
      </svg>
    );
  const channels = tileChannels(tile);
  return (
    <svg viewBox="0 0 64 84" className="mine-tile-art" aria-hidden="true">
      <StoneFrame />
      {channels.map((ch, i) => {
        const middle =
          channels.length > 1 && path?.special === "DOUBLE_BEND"
            ? [ch.includes("E") ? 48 : 16, ch.includes("N") ? 21 : 63]
            : ch.length === 1 && channels.length > 1
              ? [
                  32 + (PORTS[ch[0]][0] - 32) * 0.55,
                  42 + (PORTS[ch[0]][1] - 42) * 0.55,
                ]
              : [32, 42];
        const lines =
          ch.length === 1
            ? `M${PORTS[ch[0]].join(" ")} L${middle.join(" ")}`
            : ch
                .map(
                  (e) =>
                    `M${PORTS[e].join(" ")} Q${middle.join(" ")} ${middle.join(" ")}`,
                )
                .join(" ");
        const curved =
          ch.length === 2 && path?.special === "DOUBLE_BEND"
            ? `M${PORTS[ch[0]].join(" ")} Q${middle.join(" ")} ${PORTS[ch[1]].join(" ")}`
            : lines;
        return (
          <g key={i} fill="none" strokeLinecap="butt">
            <path d={curved} stroke="#203438" strokeWidth="23" />
            <path
              d={curved}
              stroke={i === 1 ? "#dfd1ad" : "#c7b998"}
              strokeWidth="15"
            />
            <path
              d={curved}
              stroke="#f5e7c5"
              strokeWidth="1"
              strokeDasharray="2 7"
            />
            {ch.length === 1 && (
              <path
                d={`M${middle[0] - 6} ${middle[1] - 5}l12 10m-12 0l12-10`}
                stroke="#835b42"
                strokeWidth="5"
              />
            )}
          </g>
        );
      })}
      {path?.door && (
        <g transform="translate(23 27)">
          <rect
            width="18"
            height="30"
            rx="3"
            fill={path.door === "BLUE" ? "#357abd" : "#39835c"}
            stroke="#efe1bd"
            strokeWidth="2"
          />
          <circle cx="13" cy="17" r="2" fill="#ffdc6a" />
          <path
            d="M5 2v26m6-26v26"
            stroke="#132d38"
            strokeWidth="1"
            opacity=".6"
          />
          <path d="M1 14h16M1 26h16" stroke="#d1c294" strokeWidth="2" />
          <text x="9" y="11" textAnchor="middle" fontSize="8" fill="white">
            {path.door === "BLUE" ? "藍" : "綠"}
          </text>
        </g>
      )}
      {path?.ladder && (
        <g stroke="#b88955" strokeWidth="4">
          <ellipse
            cx="32"
            cy="44"
            rx="14"
            ry="25"
            fill="#182426"
            stroke="#999d82"
            strokeWidth="2"
          />
          <path d="M24 18v48m16-48v48M24 25h16M24 36h16M24 47h16M24 58h16" />
          <path d="M23 20v43m16-43v43" stroke="#f3d398" strokeWidth="1" />
        </g>
      )}
      {path?.crystalCount && (
        <g transform="translate(32 51)">
          <circle cx="15" cy="16" r="17" fill="#0c394dcc" />
          <CrystalArt size={29} />
          <circle cx="-1" cy="23" r="7" fill="#163d4c" stroke="#a9f4ff" />
          <text
            x="-1"
            y="27"
            fill="#eaffff"
            fontSize="10"
            textAnchor="middle"
            fontWeight="bold"
          >
            {path.crystalCount}
          </text>
        </g>
      )}
      {path?.special === "BRIDGE" && (
        <g>
          <path d="M20 31h24v22H20Z" fill="#312b20" />
          <path
            d="M22 34h20m-20 5h20m-20 5h20m-20 5h20"
            stroke="#cba771"
            strokeWidth="3"
          />
          <path d="M20 29v27m24-27v27" stroke="#71482b" strokeWidth="3" />
        </g>
      )}
      {tile.type === "start" && (
        <g transform="translate(21 27)">
          <HardHat size={23} color="#ffda87" />
          <text x="11" y="36" textAnchor="middle" fill="#fff0ba" fontSize="11">
            入口
          </text>
        </g>
      )}
      {tile.revealed && (
        <g
          transform={
            tile.revealed === "GOLD" ? "translate(8 22)" : "translate(19 28)"
          }
        >
          {tile.revealed === "GOLD" ? (
            <GoldArt size={49} />
          ) : (
            <Mountain size={26} color="#e4d9c2" />
          )}
        </g>
      )}
    </svg>
  );
}
export function HandCard({ card }: { card: MineCard }) {
  return (
    <>
      <div
        className={`mine-hand-art ${card.kind === "action" ? `mine-action-${card.action}` : ""}`}
      >
        {card.kind === "path" ? (
          <TunnelArt
            tile={{ x: 0, y: 0, type: "path", cardId: card.id, rotation: 0 }}
          />
        ) : (
          <div className="mine-action-face">
            <ActionIllustration card={card} />
            <span className="mine-card-tools">
              {card.tools?.map((t) => (
                <MineIcon key={t} kind={t} size={16} />
              ))}
            </span>
          </div>
        )}
      </div>
      <strong>{card.name}</strong>
    </>
  );
}
