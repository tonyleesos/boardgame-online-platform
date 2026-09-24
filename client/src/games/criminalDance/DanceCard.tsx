import type { CSSProperties } from "react";
import {
  DANCE_CARD_BY_ID,
  DANCE_DEFINITIONS,
  type DanceCardType,
} from "../../../../functions/src/shared/criminalDance";
export function DanceDrawing({ type }: { type: DanceCardType | "BACK" }) {
  return (
    <svg viewBox="0 0 140 110" className="cd-drawing" aria-hidden="true">
      <g
        fill="none"
        stroke="#263333"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {type === "BACK" ? (
          <>
            <path
              d="m41 20 10 8-10 16-9-8Zm39 32 11 8-9 16-11-8Zm-33 22 10 8-9 15-11-8Z"
              fill="#ecdcb9"
            />
            <circle cx="95" cy="24" r="17" stroke="#ecdcb9" />
            <path d="m105 38 18 18" stroke="#ecdcb9" />
          </>
        ) : type === "POLICE_CHIEF" ? (
          <>
            <path d="M33 98V72q36-27 73 0v26" fill="#d2dbdf" />
            <path d="M47 32v22q22 23 43 0V32" fill="#f2dfb8" />
            <path d="m36 24 12-17h41l14 17-6 12H42Z" fill="#a8bddd" />
            <path d="M40 34h58" />
            <path
              d="m68 11 4 6 7 1-5 6 1 7-7-3-6 3 1-7-5-6 7-1Z"
              fill="#f2d485"
            />
            <path d="m76 72 20-5 15 8-3 20-13 9-15-9Z" fill="#f2d485" />
            <path d="m86 84 7 7 10-15M55 42h6m14 0h6M59 55q10 5 19-1" />
          </>
        ) : type === "CRIMINAL" ? (
          <>
            <path d="M30 95q0-42 40-41t40 41" fill="#ece1c3" />
            <path d="M45 39q1-31 24-32 28 1 28 32v22H44Z" fill="#263333" />
            <path d="M39 42q32-14 63 0l-7 18-17-4-16 1-17 5Z" fill="#f3e8c9" />
            <path d="m52 46 8 2m19 0 8-2M62 72q9 7 19-1" />
            <path d="m27 96 20-14 46 3 23 15" />
          </>
        ) : type === "DETECTIVE" ? (
          <>
            <path d="M28 84q3-40 37-40t37 40" fill="#efdfba" />
            <path d="M39 27 48 9l29 3 9 18m-58 2q39-8 68 2" fill="#d4b876" />
            <path d="M45 38v13q21 20 40-2V38" />
            <circle cx="100" cy="63" r="20" fill="#b9ded2" />
            <path d="m112 80 13 20M89 60l8-7" />
            <circle cx="59" cy="43" r="2" />
            <path d="m48 78 13 13 16-17" />
          </>
        ) : type === "DOG" ? (
          <>
            <path
              d="m44 38-20-8 4 42 15-9m53-24 20-9-5 42-14-9"
              fill="#b78750"
            />
            <path d="M41 30q30-17 57 4v41Q73 107 42 76Z" fill="#f2dfb8" />
            <ellipse cx="69" cy="69" rx="12" ry="9" fill="#263333" />
            <circle cx="54" cy="53" r="3" />
            <circle cx="86" cy="53" r="3" />
            <path d="M69 79v14l12 4 4-12M37 35q34-12 66 3" />
            <path d="m45 28 8-20 30 3 12 19" fill="#c9dbaa" />
          </>
        ) : type === "ALIBI" ? (
          <>
            <path
              d="M24 16h78v79l-10-5-10 5-10-5-10 5-10-5-10 5-18-5Z"
              fill="#f6e8c8"
            />
            <circle cx="72" cy="47" r="22" />
            <path d="M72 33v16l13 7M36 74h29m-29 9h17m49-6 8 9 16-23" />
          </>
        ) : type === "WITNESS" ? (
          <>
            <path d="M25 12h92v87H25Zm45 0v87M25 54h92" fill="#e9d6b2" />
            <path d="M33 22q13 15 0 25m75-26q-12 13 0 26" />
            <path
              d="M40 75q12-16 24 0-12 16-24 0Zm40 0q12-16 24 0-12 16-24 0Z"
              fill="#fff3d2"
            />
            <circle cx="52" cy="75" r="4" fill="#263333" />
            <circle cx="92" cy="75" r="4" fill="#263333" />
          </>
        ) : type === "TRADE" || type === "INFORMATION_EXCHANGE" ? (
          <>
            <path d="M17 45h40v43H17Zm66-23h39v44H83Z" fill="#efdfbb" />
            <path d="m17 46 20 20 20-20m26-23 19 20 20-20M29 30Q69-1 104 13l-10-9m10 9-12 7M111 83Q66 117 36 96l5 10m-5-10 13-6" />
            {type === "INFORMATION_EXCHANGE" && (
              <path d="M65 40v31m-10-11 10 11 10-11" />
            )}
          </>
        ) : type === "RUMOR" ? (
          <>
            <path d="M15 22q30-19 52 1v30H43L24 68V51H15Z" fill="#f4e4c2" />
            <path d="M73 47q31-18 54 2v31h-14l-1 18-22-18H73Z" fill="#dcc4a1" />
            <path d="M27 33h25m-25 10h16m41 16h27m-27 10h15" />
          </>
        ) : (
          <>
            {type === "ACCOMPLICE" && (
              <g transform="translate(42 2) scale(.85)">
                <circle cx="65" cy="32" r="17" fill="#d0b276" />
                <path d="M42 95V71q23-33 46 0v24" fill="#d0b276" />
              </g>
            )}
            <circle
              cx={type === "ACCOMPLICE" ? 49 : 68}
              cy="36"
              r="20"
              fill="#f2ddb2"
            />
            <path
              d={
                type === "ACCOMPLICE"
                  ? "M21 98V76q28-34 56 0v22"
                  : "M34 99V77q34-33 67 0v22"
              }
              fill="#efe2c1"
            />
            <path
              d={
                type === "ACCOMPLICE"
                  ? "m35 33 9 3m12 0 9-3"
                  : "m54 35 8 1m15 0 8-1"
              }
            />
            {type === "FIRST_DISCOVERER" ? (
              <>
                <ellipse cx="69" cy="48" rx="5" ry="7" />
                <path d="M110 13v26m0 10v2M19 12l12 14M8 40l16 2" />
              </>
            ) : type === "BOY" ? (
              <>
                <path d="M46 21 51 8l20-6 21 19-49 1m42 0h17M56 53q12 8 23-1" />
                <path d="m108 68 12-17m-13 17 11 9" />
              </>
            ) : (
              <path
                d={type === "ACCOMPLICE" ? "m43 49 12 0" : "M58 51q11 8 22-1"}
              />
            )}
            {type === "ORDINARY_PERSON" && (
              <path d="m40 79-16 20m71-18 20 17" />
            )}
          </>
        )}
      </g>
    </svg>
  );
}
export function DanceCard({
  id,
  back = false,
  compact = false,
}: {
  id?: string;
  back?: boolean;
  compact?: boolean;
}) {
  const card = id ? DANCE_CARD_BY_ID[id] : undefined,
    def = card ? DANCE_DEFINITIONS[card.type] : null;
  return (
    <div
      className={`cd-card ${back ? "cd-card-back" : ""} ${compact ? "cd-card-compact" : ""}`}
      style={
        def ? ({ "--cd-card-color": def.color } as CSSProperties) : undefined
      }
    >
      {back || !card || !def ? (
        <>
          <DanceDrawing type="BACK" />
          <strong>犯人在跳舞</strong>
          <span>每一步，都藏著線索</span>
        </>
      ) : (
        <>
          <div className="cd-card-upper">
            <strong>{def.name}</strong>
            <DanceDrawing type={card.type} />
          </div>
          <p className="cd-card-rule">{def.rule}</p>
        </>
      )}
    </div>
  );
}
