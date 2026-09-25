import { useId } from "react";
import {
  ROSE_CARDS,
  roseFaction,
  type RoseCardType,
} from "../../../../functions/src/shared/bladesRose";
/** Original vector artwork: cloaks, cathedral arches, silver blades and rose vines. */
export function RoseArt({
  type = "WHITE_ROSE",
  back = false,
}: {
  type?: RoseCardType;
  back?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const blood = roseFaction(type) === "BLOOD_BLADE";
  const rose = (x: number, y: number, r: number) => (
    <g transform={`translate(${x} ${y}) scale(${r})`}>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path
          key={a}
          transform={`rotate(${a})`}
          d="M0 0C-20-8-19-28-2-31C17-35 25-15 8-3Z"
          fill="#d7d1b7"
          stroke="#8e8972"
          strokeWidth="1.5"
        />
      ))}
      <path
        d="M-9 3Q-15-14 2-15Q17-12 10 2Q-1 13-7 1Q-6-8 3-6Q10-2 2 3"
        fill="#eae4d1"
        stroke="#847b5c"
        strokeWidth="2"
      />
    </g>
  );
  const blade = (
    <g>
      <path
        d="M0-106L9-80 5 49 0 66-5 49-9-80Z"
        fill={`url(#${id}-steel)`}
        stroke="#c5c4b8"
      />
      <path d="M-23 45Q0 34 23 45L23 52Q0 43-23 52Z" fill="#a99059" />
      <path d="M-4 49H4V79H-4Z" fill="#564339" stroke="#bfa16b" />
      <circle cy="82" r="6" fill="#bca472" />
    </g>
  );
  return (
    <svg viewBox="0 0 260 400" aria-hidden="true" className="br-art">
      <defs>
        <radialGradient id={`${id}-bg`}>
          <stop stopColor={blood ? "#663732" : "#62685a"} />
          <stop offset="1" stopColor="#101515" />
        </radialGradient>
        <linearGradient id={`${id}-cloak`} x2="1" y2="1">
          <stop stopColor="#e1d7b8" />
          <stop offset=".35" stopColor={blood ? "#79786e" : "#929786"} />
          <stop offset=".6" stopColor="#2f3633" />
          <stop offset="1" stopColor="#101515" />
        </linearGradient>
        <linearGradient id={`${id}-steel`}>
          <stop stopColor="#414e50" />
          <stop offset=".48" stopColor="#eaf0e8" />
          <stop offset=".53" stopColor="#9da9a4" />
          <stop offset="1" stopColor="#465654" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor="#d4c799" stopOpacity=".45" />
          <stop offset="1" stopColor="#d4c799" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="260" height="400" fill={`url(#${id}-bg)`} />
      <g fill="none" stroke="#a18b5d" opacity=".22">
        <path d="M30 360V118Q130-55 230 118V360M46 360V130Q130-10 214 130V360M63 355V145Q130 31 197 145V355" />
        <path d="M130 24V112M52 85L208 85M28 176H232" />
        {[85, 130, 175].map((x) => (
          <path key={x} d={`M${x} 85V350`} />
        ))}
      </g>
      <ellipse cx="130" cy="151" rx="112" ry="119" fill={`url(#${id}-halo)`} />
      {back ? (
        <g fill="none" stroke="#b8a174" strokeWidth="1.5">
          <path d="M130 42C218 68 227 137 209 201S223 312 130 357C37 312 51 259 51 201S42 68 130 42Z" />
          <path d="M130 65C196 93 201 148 185 201S202 288 130 330C58 288 75 249 75 201S64 93 130 65Z" />
          <ellipse cx="130" cy="200" rx="70" ry="105" />
          <path d="M130 141L171 200 130 259 89 200ZM130 156L160 200 130 244 100 200" />
          {rose(65, 61, 0.62)}
          {rose(200, 325, 0.62)}
          {rose(202, 75, 0.38)}
          {rose(48, 320, 0.4)}
        </g>
      ) : (
        <>
          <g opacity={type === "GHOST" ? 0.65 : 1}>
            <path
              d="M28 356Q39 255 76 226L83 139Q89 93 130 77Q169 102 180 148L184 226Q224 265 235 356Z"
              fill={`url(#${id}-cloak)`}
              stroke="#bdb59a"
              strokeOpacity=".35"
            />
            <path
              d="M83 188Q88 120 130 95Q175 129 180 188L158 229 105 229Z"
              fill="#111817"
            />
            <path
              d="M130 95Q101 142 97 177L113 213 90 250 74 220 83 159Q86 115 130 95Z"
              fill="#b8b6a1"
              opacity=".7"
            />
            <path
              d="M130 95Q165 163 162 207L181 237 196 252 175 166Q167 117 130 95Z"
              fill="#85897a"
            />
            <path d="M91 235Q132 272 177 231L216 347H48Z" fill="#252e2b" />
            <path
              d="M86 237L60 327 130 272 181 244M112 255L88 341 152 285M150 259L177 343"
              fill="none"
              stroke="#8e9481"
              strokeOpacity=".48"
              strokeWidth="3"
            />
            <path
              d="M45 298Q84 275 119 294L148 278Q163 279 155 294L125 316Q76 330 45 318"
              fill="#656b5d"
              stroke="#94947b"
            />
            <path
              d="M192 281Q163 280 144 310L128 320Q117 335 140 333L171 317 208 313"
              fill="#414c44"
              stroke="#8d937b"
            />
          </g>
          {type === "WHITE_ROSE" && (
            <>
              {rose(83, 130, 0.42)}
              {rose(102, 116, 0.4)}
              {rose(132, 111, 0.45)}
              {rose(157, 119, 0.38)}
              {rose(179, 139, 0.4)}
              {rose(81, 261, 0.46)}
              {rose(179, 272, 0.56)}
              {rose(137, 311, 0.4)}
            </>
          )}
          {type === "BISHOP" && (
            <>
              <path
                d="M188 165V346M171 186H205M188 158L201 177 188 197 175 177Z"
                fill="none"
                stroke="#c6b27d"
                strokeWidth="5"
              />
              {rose(90, 263, 0.5)}
              <circle
                cx="139"
                cy="253"
                r="13"
                fill="#a08d61"
                stroke="#ddd1a9"
              />
            </>
          )}
          {type === "FOLLOWER" && (
            <>
              <path d="M132 259H145V308H132Z" fill="#cfcaac" />
              <path
                d="M139 231Q154 251 139 260Q125 251 139 231"
                fill="#eadba5"
              />
              {rose(81, 257, 0.45)}
              {rose(178, 292, 0.32)}
            </>
          )}
          {type === "GHOST" && (
            <g fill="none" stroke="#aeb8a6" opacity=".65">
              <path
                d="M30 312Q192 360 203 257Q200 222 157 238Q110 257 173 288Q211 319 110 349"
                strokeWidth="4"
              />
              <path
                d="M46 278Q5 333 114 334Q250 330 199 217M90 150Q128 218 162 157"
                strokeWidth="2"
              />
            </g>
          )}
          {type === "DOUBLE_BLADE" && (
            <>
              <g transform="translate(112 234) rotate(-31) scale(.8)">
                {blade}
              </g>
              <g transform="translate(155 234) rotate(31) scale(.8)">{blade}</g>
            </>
          )}
          {type === "GREAT_BLADE" && (
            <g transform="translate(160 219) rotate(19) scale(1.15)">{blade}</g>
          )}
          {type === "DARK_BLADE" && (
            <g transform="translate(153 287) rotate(59) scale(.62)">{blade}</g>
          )}
        </>
      )}
      <g fill="none" stroke="#baaa7b" opacity=".7">
        <rect x="9" y="9" width="242" height="382" rx="8" />
        <path d="M15 62V16H62M198 16H245V62M245 338V384H198M62 384H15V338M15 22L27 15M245 22L233 15" />
        <path d="M20 347Q50 324 28 288Q11 250 24 214M240 347Q210 324 232 288Q249 250 236 214" />
      </g>
      {!back && (
        <path
          d="M23 13H56V66L39 80 23 66Z"
          fill={blood ? "#72272b" : "#313e37"}
          stroke="#a19470"
        />
      )}
      <g fill="#dbcf9d" opacity=".5">
        {Array.from({ length: 20 }, (_, i) => (
          <circle
            key={i}
            cx={21 + ((i * 47) % 220)}
            cy={40 + ((i * 71) % 300)}
            r={i % 3 === 0 ? 1.5 : 0.7}
          />
        ))}
      </g>
    </svg>
  );
}
export function BladesRoseCard({
  type,
  selected = false,
  onClick,
  disabled = false,
}: {
  type?: RoseCardType;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      <RoseArt type={type} back={!type} />
      {type && (
        <>
          <span className="br-card-glyph">{ROSE_CARDS[type].glyph}</span>
          <span className="br-card-label">
            <strong>{ROSE_CARDS[type].name}</strong>
            <small>{ROSE_CARDS[type].english}</small>
          </span>
        </>
      )}
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={`br-card ${selected ? "is-selected" : ""}`}
      aria-label={`查看手牌：${type ? ROSE_CARDS[type].name : "背面"}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <div
      className="br-card"
      role="img"
      aria-label={type ? ROSE_CARDS[type].name : "蓋牌"}
    >
      {content}
    </div>
  );
}
