import {
  Castle,
  Trees,
  Mountain,
  Waves,
  Crown,
  ThumbsUp,
  ThumbsDown,
  Trophy,
  Skull,
} from "lucide-react";
import type { Game, Role } from "../../../../functions/src/shared/model";
import { ROLE_NAMES } from "../../../../functions/src/shared/model";
import {
  getMissionTeamSize,
  requiresTwoFails,
} from "../../../../functions/src/shared/rules";

export function RolePortrait({ role }: { role: Role }) {
  return (
    <div
      className={`avalon-portrait portrait-${role}`}
      role="img"
      aria-label={`${ROLE_NAMES[role]}角色插畫`}
    />
  );
}

export function VoteArt({
  kind,
}: {
  kind: "approve" | "reject" | "success" | "fail";
}) {
  const Icon = {
    approve: ThumbsUp,
    reject: ThumbsDown,
    success: Trophy,
    fail: Skull,
  }[kind];
  const ballot = kind === "approve" || kind === "reject";
  return (
    <span
      className={`vote-art ${ballot ? "team-ballot-art" : "quest-card-art"} vote-art-${kind}`}
      aria-hidden="true"
    >
      <span className="vote-ornament">
        {ballot ? "隊伍表決" : "秘密任務牌"}
      </span>
      <Icon strokeWidth={ballot ? 1.8 : 1.2} />
      <span className="vote-seal">{ballot ? "公開" : "秘密"}</span>
    </span>
  );
}

import { ExpeditionParty } from "./ExpeditionScene";

const destinations = ["卡美洛", "迷霧森林", "巨龍山隘", "聖湖", "聖杯之城"];
const landmarks = [Castle, Trees, Mountain, Waves, Crown];
export function QuestMap({
  game,
  concealLatest = false,
  travelling = false,
}: {
  game: Game;
  concealLatest?: boolean;
  travelling?: boolean;
}) {
  return (
    <section className="quest-map" aria-label="遠征任務版">
      <div className="quest-caption">
        <span>THE QUEST FOR AVALON</span>
        <span>遠征 {game.round} / 5</span>
      </div>
      <svg
        className="quest-landscape"
        viewBox="0 0 800 180"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 120 80 25 135 88 220 5 310 98 400 28 465 85 535 12 640 105 730 36 800 95V180H0Z"
          fill="#718779"
          opacity=".16"
        />
        <path
          d="M0 140Q100 80 200 135T400 130T600 138T800 120V180H0Z"
          fill="#bda573"
          opacity=".12"
        />
        <path
          d="M70 100Q170 45 240 90T400 95T565 85T730 100"
          fill="none"
          stroke="#d9b980"
          strokeWidth="2"
          strokeDasharray="6 7"
          opacity=".65"
        />
      </svg>
      <div className="quest-stops">
        {landmarks.map((Icon, i) => {
          const result =
            concealLatest && i === game.missionResults.length - 1
              ? undefined
              : game.missionResults[i]?.result;
          const doubleFail = requiresTwoFails(game.order.length, i + 1);
          return (
            <div
              key={i}
              className={`quest-stop ${result ?? ""} ${game.round === i + 1 ? "current" : ""}`}
              aria-label={`第 ${i + 1} 輪 ${destinations[i]}，${getMissionTeamSize(game.order.length, i + 1)} 人${doubleFail ? "，需兩張失敗票" : ""}，${result === "success" ? "成功" : result === "fail" ? "失敗" : "未完成"}`}
              aria-current={game.round === i + 1 ? "step" : undefined}
            >
              <span className="quest-medallion">
                {result === "success" ? (
                  <Trophy />
                ) : result === "fail" ? (
                  <Skull />
                ) : (
                  <Icon />
                )}
              </span>
              <strong>{destinations[i]}</strong>
              <small>
                {getMissionTeamSize(game.order.length, i + 1)} 人
                {doubleFail && " · 雙敗"}
              </small>
            </div>
          );
        })}
      </div>
      <div
        className={`quest-route ${travelling ? "marching" : ""}`}
        aria-label={`探險隊${travelling ? "正在前往" : "目前位於"}${destinations[game.round - 1]}`}
      >
        <span
          className="quest-party-marker"
          style={{ left: `${10 + (game.round - 1) * 20}%` }}
        >
          <ExpeditionParty compact />
        </span>
      </div>
    </section>
  );
}
