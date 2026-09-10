import type { CSSProperties } from "react";
import type { DecorObject } from "../../../../functions/src/shared/decorum";
import { paintColors } from "./constants";
export function FurnitureArt({ object }: { object: DecorObject }) {
  const unusual = object.style === "unusual", antique = object.style === "antique", retro = object.style === "retro";
  return <svg className="furniture-art" viewBox="0 0 100 100" fill="none" aria-hidden="true" style={{ "--furniture-color": paintColors[object.color] } as CSSProperties}>
    <ellipse cx="50" cy="87" rx="31" ry="5" fill="#544331" opacity=".12" />
    {object.type === "lamp" ? <>
      <path d="M50 42V82M35 83H65" stroke="#735947" strokeWidth="5" strokeLinecap="round" />
      <path d={unusual ? "M50 10L80 48H20L50 10Z" : retro ? "M20 46C20 6 80 6 80 46H20Z" : "M34 15H66L77 48H23L34 15Z"} fill="var(--furniture-color)" stroke="#735947" strokeWidth="2" />
      <path d="M30 43H70" stroke="#fff6de" strokeWidth="2" opacity=".6" />
      {antique && <><path d="M40 18L35 44M60 18L65 44M50 16V44" stroke="#fff6de" opacity=".5" /><path d="M39 66Q50 55 61 66" stroke="#735947" strokeWidth="3" /></>}
    </> : object.type === "curio" ? <>
      {unusual ? <><path d="M50 12L77 40L65 78H35L23 40L50 12Z" fill="var(--furniture-color)" stroke="#735947" strokeWidth="2" /><path d="M23 40H77M50 12V78M23 40L65 78M77 40L35 78" stroke="#fff6de" opacity=".5" /></>
        : <><path d={antique ? "M36 37Q17 65 38 81H62Q83 65 64 37Z" : "M28 42H72L65 81H35Z"} fill="var(--furniture-color)" stroke="#735947" strokeWidth="2" /><path d="M50 43V18M50 32Q23 10 26 31Q31 43 50 39M50 27Q77 9 75 30Q64 39 50 35" fill="#729575" stroke="#486d55" strokeWidth="2" />{retro && <path d="M31 52H69M33 64H67" stroke="#fff6de" strokeWidth="4" opacity=".65" />}</>}
    </> : <>
      <rect x="17" y="12" width="66" height="70" rx={unusual ? 22 : antique ? 3 : 0} fill={antique ? "#b79152" : "#84654b"} />
      <rect x="23" y="18" width="54" height="58" rx={unusual ? 18 : 0} fill="#f9eed6" />
      <circle cx={retro ? 50 : 58} cy="37" r={retro ? 17 : 10} fill="var(--furniture-color)" />
      <path d="M25 70L43 40L58 63L68 47L75 70Z" fill="var(--furniture-color)" opacity=".72" />
      {antique && <rect x="20" y="15" width="60" height="64" stroke="#efd592" />}
    </>}
  </svg>;
}
