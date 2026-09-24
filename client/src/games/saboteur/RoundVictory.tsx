import { useEffect, useState } from "react";
import type { MineRoundResult } from "../../../../functions/src/shared/saboteur";
import { GameDialog } from "../../components/GameDialog";
import { GoldArt, CrystalArt, RolePortrait } from "./MineIllustrations";
import { roundPresentation, ROUND_REVEAL_MS } from "./roundPresentation";

export function RoundVictory({
  result,
  round,
  onContinue,
}: {
  result: MineRoundResult;
  round: number;
  onContinue: () => void;
}) {
  const [finished, setFinished] = useState(false);
  const presentation = roundPresentation(result);
  useEffect(() => {
    const timer = setTimeout(() => setFinished(true), ROUND_REVEAL_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <GameDialog
      title={`第 ${round} 輪勝負揭曉`}
      className={`mine-dialog mine-victory mine-victory-${presentation.tone}`}
      onClose={() => {}}
      dismissible={false}
    >
      <div className="mine-victory-rays" aria-hidden="true" />
      <div className="mine-victory-particles" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${8 + i * 7.5}%`,
              animationDelay: `${(i % 4) * 0.25 + 0.5}s`,
            }}
          >
            {i % 3 === 0 ? <CrystalArt size={22} /> : <GoldArt size={24} />}
          </span>
        ))}
      </div>
      <div className="mine-victory-content">
        <p className="mine-victory-round">第 {round} 輪 · 勝負揭曉</p>
        <div className="mine-victory-portraits" aria-hidden="true">
          {presentation.roles.length ? (
            presentation.roles.map((role) => (
              <RolePortrait key={role} role={role} />
            ))
          ) : (
            <GoldArt size={120} />
          )}
        </div>
        <h2>{presentation.title}</h2>
        <p>{presentation.detail}</p>
        <div className="mine-victory-loot">
          <GoldArt size={37} />
          <span>接著查看本輪分金與偷竊</span>
          <CrystalArt size={35} />
        </div>
        <button
          className="mine-primary"
          disabled={!finished}
          onClick={onContinue}
        >
          {finished ? "查看本輪結算" : "正在揭曉勝方…"}
        </button>
      </div>
    </GameDialog>
  );
}
