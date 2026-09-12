import { useEffect, useState, type CSSProperties } from "react";
import {
  Flag,
  Shield,
  Swords,
  Mountain,
  Sparkles,
  Trophy,
  ShieldX,
} from "lucide-react";
import type { ExpeditionStage } from "./avalonPresentation";

export function ExpeditionParty({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`expedition-party ${compact ? "compact" : ""}`}
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="expedition-knight"
          style={{ "--march-delay": `${i * -0.18}s` } as CSSProperties}
        >
          {i === 0 && <Flag className="expedition-flag" size={20} />}
          <svg viewBox="0 0 32 48">
            <circle cx="16" cy="8" r="6" fill="#e9d5a5" />
            <path
              d="M10 15H22L25 32H7Z"
              fill={i === 1 ? "#8da9a4" : "#c6a260"}
            />
            <path d="M12 7H21M19 7V11" stroke="#38463c" strokeWidth="2" />
            <path
              className="knight-leg left"
              d="M12 30V43"
              stroke="#ede0bf"
              strokeWidth="4"
            />
            <path
              className="knight-leg right"
              d="M20 30V43"
              stroke="#ede0bf"
              strokeWidth="4"
            />
            <path d="M9 19L4 29M23 19L28 26" stroke="#e9d5a5" strokeWidth="3" />
          </svg>
          <Shield className="expedition-shield" size={15} />
        </span>
      ))}
    </span>
  );
}

export function ExpeditionScene({
  stage,
  onComplete,
}: {
  stage: ExpeditionStage;
  onComplete: () => void;
}) {
  const duration =
    stage.kind === "battle" ? 5 : stage.kind === "travel" ? 2 : 3;
  const [remaining, setRemaining] = useState(duration);
  useEffect(() => {
    const deadline = performance.now() + duration * 1000;
    const timer = window.setInterval(
      () =>
        setRemaining(
          Math.max(0, Math.ceil((deadline - performance.now()) / 1000)),
        ),
      100,
    );
    const end = window.setTimeout(onComplete, duration * 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(end);
    };
  }, [duration, onComplete]);
  const rejected =
    stage.kind === "ballot" && !stage.game.lastTeamVote?.approved;
  const title =
    stage.kind === "battle"
      ? "探險隊冒險中!!"
      : stage.kind === "travel"
        ? "前往下一個區域"
        : rejected
          ? "隊伍遭到否決"
          : "出任務準備中!!";
  return (
    <div
      className={`expedition-scene expedition-${stage.kind} ${rejected ? "expedition-rejected" : ""}`}
    >
      <div className="expedition-theatre" aria-hidden="true">
        <Mountain className="expedition-mountains" />
        <span className="expedition-ground" />
        <ExpeditionParty />
        {stage.kind === "battle" && (
          <>
            <Swords className="expedition-clash" />
            <Sparkles className="expedition-sparks" />
          </>
        )}
        {rejected && <ShieldX className="expedition-clash" />}
      </div>
      <h3>{title}</h3>
      <p>
        {stage.kind === "battle"
          ? "穿越迷霧、迎戰暗影，等待戰報…"
          : stage.kind === "travel"
            ? "整裝列隊，沿著地圖繼續前進"
            : rejected
              ? "表決已公開，下一位隊長即將組隊"
              : "表決已公開，隊員正在整裝集合"}
      </p>
      <div
        className="expedition-countdown"
        role="timer"
        aria-label={`${title}，剩餘 ${remaining} 秒`}
      >
        <strong>{remaining}</strong>
        <span>秒</span>
      </div>
      <small>
        {stage.kind === "battle"
          ? "倒數結束揭曉成功／失敗"
          : stage.kind === "ballot" && !rejected
            ? "倒數結束後，隊員選擇秘密任務牌"
            : "請稍候"}
      </small>
    </div>
  );
}

export function ExpeditionOutcome({ success }: { success: boolean }) {
  return (
    <div
      className={`expedition-outcome ${success ? "returned-victorious" : "returned-defeated"}`}
      aria-hidden="true"
    >
      <ExpeditionParty />
      <span className="expedition-outcome-seal">
        {success ? <Trophy /> : <ShieldX />}
      </span>
    </div>
  );
}
