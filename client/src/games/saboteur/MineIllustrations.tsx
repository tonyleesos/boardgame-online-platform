import { useId } from "react";
import type {
  ActionCard,
  DwarfRole,
} from "../../../../functions/src/shared/saboteur";
import { DWARF_ROLE_NAMES } from "../../../../functions/src/shared/saboteur";

/** Original vector illustrations. Tunnel topology stays a separate, readable layer. */
export function GoldArt({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 54"
      width={size}
      height={(size * 54) / 64}
      className="mine-gold-art"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="47" rx="29" ry="5" fill="#34220b" opacity=".5" />
      <path
        d="M3 36 10 23 28 21 36 34 30 47 8 46Z"
        fill="#e5a628"
        stroke="#774710"
        strokeWidth="2"
      />
      <path d="m10 23 18-2 8 13-17 2Z" fill="#ffe594" />
      <path d="m19 36 17-2-6 13H18Z" fill="#bb7116" />
      <path
        d="m28 30 9-15 18 6 6 19-19 8Z"
        fill="#f7bf38"
        stroke="#774710"
        strokeWidth="2"
      />
      <path d="m37 15 18 6-11 12-16-3Z" fill="#fff0a0" />
      <path d="m44 33 17 7-19 8Z" fill="#c98418" />
      <path
        d="m13 10 3-8 3 8 8 3-8 3-3 8-3-8-8-3ZM47 6l2-5 2 5 5 2-5 2-2 5-2-5-5-2Z"
        fill="#fff4b8"
      />
    </svg>
  );
}
export function CrystalArt({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 60"
      width={size}
      height={(size * 60) / 64}
      className="mine-crystal-art"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="53" rx="27" ry="5" fill="#123e4c" opacity=".6" />
      <path
        d="m9 29 8-13 12 7 8 27-17 5Z"
        fill="#58b7d6"
        stroke="#17394c"
        strokeWidth="2"
      />
      <path d="m17 16 5 18 15 16-8-27Z" fill="#b4f4ff" />
      <path
        d="m23 18 12-16 12 17-6 34-12 3Z"
        fill="#65dbef"
        stroke="#17394c"
        strokeWidth="2"
      />
      <path d="m35 2-1 24-11-8Z" fill="#e4ffff" />
      <path d="m34 26 13-7-6 34-7 3Z" fill="#207cbd" />
      <path
        d="m40 36 11-12 9 10-7 19-13 3Z"
        fill="#5996e3"
        stroke="#17394c"
        strokeWidth="2"
      />
      <path d="m51 24-2 17-9-5Z" fill="#c5ebff" />
      <path
        d="M8 5v12M2 11h12M54 4v10m-5-5h10"
        stroke="#dcffff"
        strokeWidth="2"
      />
    </svg>
  );
}
export function StoneFrame({ warm = false }: { warm?: boolean }) {
  return (
    <>
      <rect
        x="1"
        y="1"
        width="62"
        height="82"
        rx="5"
        fill={warm ? "#755333" : "#486064"}
        stroke="#d9cfae"
        strokeWidth="1.5"
      />
      <g
        stroke={warm ? "#3e3026" : "#22373c"}
        strokeWidth="1.1"
        strokeLinejoin="round"
      >
        <path d="M3 3h18l-4 13-13 4Z" fill={warm ? "#987044" : "#7f9594"} />
        <path d="m22 3 17 1-4 10-14 3Z" fill={warm ? "#bd8b48" : "#607b7e"} />
        <path d="m42 3 18 1-2 15-18-4Z" fill={warm ? "#85643f" : "#91a39c"} />
        <path d="m3 24 11-6 4 17L3 43Z" fill={warm ? "#956332" : "#697f7e"} />
        <path d="m50 23 10-2 1 24-14-8Z" fill={warm ? "#ae8047" : "#5c7476"} />
        <path d="m3 48 15-8-2 19L3 67Z" fill={warm ? "#b88950" : "#83928a"} />
        <path d="m49 43 12 7-1 15-15-8Z" fill={warm ? "#8b613a" : "#819a96"} />
        <path d="m3 70 16-9 8 18H4Z" fill={warm ? "#825b32" : "#5b7577"} />
        <path d="m31 67 14-6 15 9v10H28Z" fill={warm ? "#a77b44" : "#7b918b"} />
      </g>
      <path
        d="m8 7 8-1m28 2 9 1M5 53l8-7m37 5 8 3m-23 20 14-5"
        stroke="#e4e4c7"
        opacity=".35"
        strokeWidth="1.5"
      />
    </>
  );
}
function Pick({ broken = false }: { broken?: boolean }) {
  return (
    <g transform="rotate(28 32 43)" strokeLinejoin="round">
      <path
        d={broken ? "M30 28h6v15l-6 3Zm0 27 6-5v24h-6Z" : "M30 25h6v49h-6Z"}
        fill="#ba854b"
        stroke="#4d3020"
        strokeWidth="2"
      />
      <path
        d="M9 25Q32 4 56 24l-3 7Q31 19 10 31Z"
        fill="#b6ced1"
        stroke="#293d42"
        strokeWidth="2"
      />
      <path d="M17 22q15-9 31 1" stroke="#eff6d8" fill="none" strokeWidth="2" />
    </g>
  );
}
function Lantern() {
  return (
    <g stroke="#4c3319" strokeWidth="2">
      <path d="M23 32v-9q9-12 18 0v9" fill="none" stroke="#e2b568" />
      <path d="m21 31-3 30 14 7 15-7-4-30Z" fill="#b48138" />
      <path d="m24 35-2 23 10 5 11-5-3-23Z" fill="#ffdf79" />
      <path d="M32 35v28" />
      <path d="M28 56q-3-8 4-15 9 10 4 15Z" fill="#fffbe3" stroke="none" />
    </g>
  );
}
function Door({ open }: { open: boolean }) {
  return (
    <g strokeLinejoin="round">
      <path
        d="M12 76V32Q32 5 53 32v44Z"
        fill="#111b1c"
        stroke="#a2ada2"
        strokeWidth="5"
      />
      <path
        d={open ? "m16 30 24-15v57L16 81Z" : "M17 72V33q15-19 30 0v39Z"}
        fill="#a56a34"
        stroke="#462c1c"
        strokeWidth="2"
      />
      <path
        d={open ? "m24 29 0 45m8-49v45" : "M24 29v40m8-44v44m8-40v40"}
        stroke="#5e3b24"
        strokeWidth="1.5"
      />
      <path
        d={open ? "m17 40 22-12m-22 36 22-10" : "M17 41h30M17 63h30"}
        stroke="#c5a979"
        strokeWidth="4"
      />
      {!open && (
        <>
          <path
            d="M28 51v-5a5 5 0 0 1 10 0v5"
            stroke="#ffd67e"
            fill="none"
            strokeWidth="3"
          />
          <rect
            x="25"
            y="51"
            width="16"
            height="13"
            rx="2"
            fill="#ecb947"
            stroke="#624720"
          />
          <circle cx="33" cy="57" r="2" fill="#58371c" />
        </>
      )}
      {open && <path d="M43 37 58 28v44L43 78Z" fill="#ffdb7e" opacity=".25" />}
    </g>
  );
}
export function ActionIllustration({ card }: { card: ActionCard }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 64 84"
      className="mine-tile-art mine-action-illustration"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={id}>
          <stop stopColor="#856840" />
          <stop offset="1" stopColor="#162527" />
        </radialGradient>
      </defs>
      <StoneFrame />
      <path d="M11 77V33Q15 12 33 13q20 1 21 20v44Z" fill={`url(#${id})`} />
      <path d="m12 73 19-9 23 10-23 5Z" fill="#a8a28b" opacity=".45" />
      {(card.action === "TRAPPED" || card.action === "FREEDOM") && (
        <Door open={card.action === "FREEDOM"} />
      )}
      {(card.action === "BREAK" || card.action === "REPAIR") && (
        <>
          {card.tools?.[0] === "LANTERN" ? (
            <Lantern />
          ) : card.tools?.[0] === "CART" ? (
            <g stroke="#392c20" strokeWidth="2">
              <path d="m12 38 39 3-7 19-24-1Z" fill="#b07c42" />
              <path d="m16 38 3-12 12-5 11 8 8 12" fill="#a1aba0" />
              <path d="M21 44h26m-25 7h22" stroke="#674828" />
              <circle cx="23" cy="65" r="6" fill="#d3c29b" />
              <circle cx="41" cy="65" r="6" fill="#d3c29b" />
            </g>
          ) : (
            <Pick broken={card.action === "BREAK"} />
          )}
          <circle
            cx="48"
            cy="61"
            r="11"
            fill={card.action === "BREAK" ? "#a43e30" : "#34856a"}
            stroke="#fff0b1"
            strokeWidth="1.5"
          />
          <path
            d={
              card.action === "BREAK"
                ? "m43 56 10 10m-10 0 10-10"
                : "m42 61 4 5 8-10"
            }
            stroke="#fff6d9"
            strokeWidth="3"
            fill="none"
          />
        </>
      )}
      {card.action === "ROCKFALL" && (
        <>
          <path
            d="M15 23 26 16l9 12-10 9-13-4Zm19 19 10-10 13 13-4 18-21-2ZM9 53l15-15 17 21-5 16-24-3Z"
            fill="#94a39d"
            stroke="#263c40"
            strokeWidth="2"
          />
          <path
            d="m19 46 7 17-14 8m26-25 6 7 10-7"
            stroke="#dae1c6"
            fill="none"
          />
          <path d="M10 41 48 71M11 65l38-46" stroke="#a4683c" strokeWidth="5" />
          <path
            d="m33 12 3 7m17 7 3 5m-44 7 2 4"
            stroke="#ffdf8b"
            strokeWidth="2"
          />
        </>
      )}
      {card.action === "MAP" && (
        <>
          <path
            d="m12 31 14-5 13 5 13-6-4 39-14 7-14-7-11 4Z"
            fill="#e7d2a1"
            stroke="#84633d"
            strokeWidth="2"
          />
          <path d="m26 28-6 34m19-30-5 36" stroke="#af9163" />
          <path
            d="m17 49q10-20 18 0t12-1"
            stroke="#8c5840"
            strokeWidth="2"
            strokeDasharray="3 3"
            fill="none"
          />
          <path d="m37 41 9 9m-9 0 9-9" stroke="#aa4935" strokeWidth="3" />
        </>
      )}
      {(card.action === "THEFT" || card.action === "HANDS_OFF") && (
        <>
          <path
            d="m16 52 32 0 6 22H10Z"
            fill="#7f532e"
            stroke="#3e2d20"
            strokeWidth="2"
          />
          <svg x="13" y="40" width="39" height="31" viewBox="0 0 64 54">
            <GoldArt size={64} />
          </svg>
          <path
            d="m56 26-14 5-8 12-9 3 2 6 14-3 9-12 10-2Z"
            fill="#d5a16e"
            stroke="#543625"
            strokeWidth="2"
          />
          <path d="m51 22 11 8-5 10-10-9Z" fill="#75447e" />
          {card.action === "HANDS_OFF" && (
            <path
              d="M10 23 55 67M55 23 10 67"
              stroke="#ed7660"
              strokeWidth="5"
            />
          )}
        </>
      )}
      {card.action === "SWAP_HANDS" && (
        <>
          <g transform="rotate(-14 23 49)">
            <rect
              x="10"
              y="32"
              width="22"
              height="33"
              rx="3"
              fill="#b68543"
              stroke="#eed3a0"
              strokeWidth="2"
            />
            <path
              d="m15 41 12 16m-12 0 12-16"
              stroke="#f0ce8d"
              strokeWidth="2"
            />
          </g>
          <g transform="rotate(14 43 51)">
            <rect
              x="33"
              y="39"
              width="22"
              height="33"
              rx="3"
              fill="#538888"
              stroke="#d5e4c4"
              strokeWidth="2"
            />
            <path
              d="m38 48 12 16m-12 0 12-16"
              stroke="#d0e5cd"
              strokeWidth="2"
            />
          </g>
          <path
            d="M13 24q19-17 37 4l-1-10m1 10-11-1M48 77Q27 85 12 68l1 10"
            fill="none"
            stroke="#ffe39a"
            strokeWidth="3"
          />
        </>
      )}
      {(card.action === "INSPECTION" || card.action === "CHANGE_HATS") && (
        <>
          <path
            d="M15 55Q30 5 43 25l5 27Z"
            fill={card.action === "INSPECTION" ? "#b5533c" : "#49836a"}
            stroke="#472c25"
            strokeWidth="2"
          />
          <path d="M12 55q20-8 40 0l-4 7H16Z" fill="#e4b365" stroke="#71502d" />
          {card.action === "INSPECTION" ? (
            <>
              <circle
                cx="40"
                cy="52"
                r="11"
                fill="#b3dadd"
                fillOpacity=".65"
                stroke="#f4d895"
                strokeWidth="4"
              />
              <path d="m47 61 10 12" stroke="#b58042" strokeWidth="6" />
              <path d="m36 47 6-3" stroke="white" strokeWidth="2" />
            </>
          ) : (
            <path
              d="M9 28q20-25 43-1l-2-10m2 10-11-2M49 68Q29 84 12 68l1 10"
              fill="none"
              stroke="#ffe39a"
              strokeWidth="3"
            />
          )}
        </>
      )}
      <circle
        cx="9"
        cy="10"
        r="6"
        fill={
          ["BREAK", "TRAPPED", "ROCKFALL"].includes(card.action)
            ? "#a24a3b"
            : "#427d6b"
        }
        stroke="#eee0b5"
      />
    </svg>
  );
}
const roleColors: Record<DwarfRole, [string, string, string]> = {
  BLUE_DIGGER: ["#397dbc", "#a8c7d8", "#244259"],
  GREEN_DIGGER: ["#428664", "#c1d5ac", "#2d493c"],
  SABOTEUR: ["#a74f41", "#a9a0a0", "#4d3031"],
  BOSS: ["#cf9d46", "#e7d5b0", "#59452c"],
  PROFITEER: ["#825b9c", "#bea9a0", "#46354d"],
  GEOLOGIST: ["#399293", "#d7dbce", "#275157"],
};
export function RolePortrait({ role }: { role: DwarfRole }) {
  const id = useId(),
    [coat, beard, shade] = roleColors[role];
  return (
    <svg
      viewBox="0 0 180 220"
      className="mine-role-portrait"
      role="img"
      aria-label={`${DWARF_ROLE_NAMES[role]}角色圖案`}
    >
      <defs>
        <radialGradient id={id}>
          <stop stopColor={shade} />
          <stop offset="1" stopColor="#142324" />
        </radialGradient>
      </defs>
      <rect
        x="3"
        y="3"
        width="174"
        height="214"
        rx="20"
        fill={`url(#${id})`}
        stroke="#bba678"
        strokeWidth="3"
      />
      <path
        d="m12 42 22-27 27 3-14 21-26 12Zm111-25 36 4 10 31-33-11ZM9 113l20-20 11 18-17 24-15 6Zm150-39 13 18-5 45-20-20ZM9 167l27-9 12 23-21 25-17-9Zm129-5 30-18 2 43-26 22-20-11Z"
        fill="#78918b"
        opacity=".24"
        stroke="#c7c8a1"
      />
      <ellipse cx="90" cy="201" rx="59" ry="9" fill="#071a1b" opacity=".7" />
      <path
        d="M56 174v24l-24 6q-3-17 11-24m64-6v25l27 5q6-16-12-25"
        fill="#6b4931"
        stroke="#211d19"
        strokeWidth="3"
      />
      <path
        d="M55 105Q21 124 26 161l25-5 3 31q37 14 75-1l-4-29 29 7q-1-43-33-58Z"
        fill={coat}
        stroke="#1e2c2e"
        strokeWidth="3"
      />
      <path
        d="M52 145v40m74-42 2 39M40 124l-6 23m104-18 9 18"
        fill="none"
        stroke="#e1e0b8"
        opacity=".35"
        strokeWidth="3"
      />
      <path d="M52 163q37 9 75 0v11q-37 10-75 0Z" fill="#533c2c" />
      <rect
        x="81"
        y="164"
        width="19"
        height="13"
        rx="2"
        fill="#dab35d"
        stroke="#634624"
        strokeWidth="2"
      />
      <ellipse cx="46" cy="83" rx="10" ry="15" fill="#cb9978" />
      <ellipse cx="132" cy="83" rx="10" ry="15" fill="#cb9978" />
      <path
        d="M49 69q39-22 80 0l-5 38-13 27-24 16-23-17-14-27Z"
        fill="#e7b890"
        stroke="#6b4938"
        strokeWidth="2"
      />
      <path
        d="M49 93q9 19 21 12l18 13 21-13q14 5 21-15l-2 43-17 26-20-9-13 10-24-31Z"
        fill={beard}
        stroke="#546062"
        strokeWidth="2"
      />
      <path
        d="m59 119 11 24m5-18 4 25m26-27-8 23m20-30-9 24"
        stroke="#fff3d5"
        opacity=".45"
        strokeWidth="2"
      />
      <ellipse cx="89" cy="99" rx="15" ry="11" fill="#dc9d7f" />
      <path
        d="M53 96q14-4 24 12-18 9-27-4m74-8q-15-4-24 12 18 9 28-4"
        fill={beard}
        stroke="#546062"
        strokeWidth="1.5"
      />
      <path
        d="m62 80 13-3m28 0 13 3"
        stroke="#47382e"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="70" cy="86" r="3" fill="#172529" />
      <circle cx="107" cy="86" r="3" fill="#172529" />
      <path
        d="M44 69q4-29 39-48 21 7 33 1l-8 21q23 8 26 28Z"
        fill={coat}
        stroke="#243335"
        strokeWidth="3"
      />
      <path
        d="M43 65q43-12 94 0l-4 13q-47-11-90 0Z"
        fill={coat}
        stroke="#1f3234"
        strokeWidth="3"
      />
      <path
        d="m61 48 21-16m-17 26 17-8"
        stroke="#faf1c5"
        opacity=".3"
        strokeWidth="3"
      />
      {role === "BOSS" && (
        <>
          <path
            d="m72 66 3-23 13 8 13-11 9 26Z"
            fill="#ecc76c"
            stroke="#745625"
            strokeWidth="2"
          />
          <circle cx="89" cy="57" r="4" fill="#fef4c3" />
        </>
      )}
      {(role === "GEOLOGIST" || role === "PROFITEER") && (
        <g fill="none" stroke="#d9c28b" strokeWidth="2">
          <circle cx="69" cy="86" r="9" />
          <circle cx="108" cy="86" r="9" />
          <path d="M78 85h21" />
        </g>
      )}
      {(role === "BLUE_DIGGER" ||
        role === "GREEN_DIGGER" ||
        role === "SABOTEUR") && (
        <g transform="translate(113 111) scale(.65)">
          <Pick broken={role === "SABOTEUR"} />
        </g>
      )}
      {role === "GEOLOGIST" && (
        <svg x="110" y="133" width="51" height="53" viewBox="0 0 64 60">
          <CrystalArt size={64} />
        </svg>
      )}
      {role === "PROFITEER" && (
        <>
          <path
            d="m120 145 17-5 15 31q-12 13-31 0Z"
            fill="#ad8047"
            stroke="#513d27"
            strokeWidth="2"
          />
          <svg x="108" y="133" width="52" height="46" viewBox="0 0 64 54">
            <GoldArt size={64} />
          </svg>
        </>
      )}
      {role === "BOSS" && (
        <g transform="translate(109 110) scale(.65)">
          <Lantern />
        </g>
      )}
      <ellipse
        cx="37"
        cy="158"
        rx="12"
        ry="9"
        fill="#e2b089"
        stroke="#704e3b"
        strokeWidth="2"
      />
      <ellipse
        cx="136"
        cy="157"
        rx="11"
        ry="9"
        fill="#e2b089"
        stroke="#704e3b"
        strokeWidth="2"
      />
    </svg>
  );
}
export function HandCount({ count }: { count: number }) {
  return (
    <span className="mine-hand-count" role="img" aria-label={`${count} 張手牌`}>
      <svg viewBox="0 0 77 27" aria-hidden="true">
        {Array.from({ length: Math.min(count, 7) }, (_, i) => (
          <g key={i} transform={`translate(${i * 8 + 2} 2)`}>
            <rect
              width="19"
              height="23"
              rx="2"
              fill="#69482e"
              stroke="#f2d59b"
              strokeWidth="1.3"
            />
            <rect x="3" y="3" width="13" height="17" rx="1" fill="#aa773e" />
            <path d="m5 7 9 9m-9 0 9-9" stroke="#ffe5a9" strokeWidth="1.5" />
          </g>
        ))}
        {count === 0 && (
          <rect
            x="2"
            y="2"
            width="19"
            height="23"
            rx="2"
            fill="none"
            stroke="#a9aa91"
            strokeDasharray="3 2"
          />
        )}
      </svg>
      <b aria-hidden="true">{count}</b>
    </span>
  );
}
export function MineCover() {
  const id = useId();
  return (
    <svg
      viewBox="0 0 360 240"
      className="mine-cover"
      role="img"
      aria-label="矮人礦坑：礦洞、十字鎬與黃金"
    >
      <defs>
        <radialGradient id={id}>
          <stop stopColor="#ddaf54" />
          <stop offset=".45" stopColor="#466364" />
          <stop offset="1" stopColor="#102326" />
        </radialGradient>
      </defs>
      <rect width="360" height="240" fill={`url(#${id})`} />
      <g transform="translate(73 -9) scale(3.35 3)">
        <StoneFrame />
        <path d="M12 82V36Q32 7 53 36v46Z" fill="#152627" />
        <path d="m15 78 17-37 17 37Z" fill="#e8c873" opacity=".15" />
      </g>
      <path d="M144 240 174 150h16l38 90" fill="#615441" />
      <path
        d="m148 227 70 0m-64-20h53m-48-18h43m-38-16h32"
        stroke="#b09765"
        strokeWidth="5"
      />
      <path d="m152 240 28-88m36 88-30-88" stroke="#c3b893" strokeWidth="3" />
      <g transform="translate(73 85) scale(1.45)">
        <Pick />
      </g>
      <g transform="translate(199 74) scale(1.1)">
        <Lantern />
      </g>
      <svg x="221" y="170" width="91" height="69" viewBox="0 0 64 54">
        <GoldArt size={64} />
      </svg>
      <svg x="40" y="169" width="64" height="64" viewBox="0 0 64 60">
        <CrystalArt size={64} />
      </svg>
      <path d="m177 83 4-10 4 10 10 4-10 4-4 10-4-10-10-4Z" fill="#ffe7a1" />
    </svg>
  );
}
