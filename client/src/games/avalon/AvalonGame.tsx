import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Eye, Shield, Skull, Swords, X } from "lucide-react";
import type {
  GameAction,
  PrivateRole,
  Room,
} from "../../../../functions/src/shared/model";
import { ROLE_NAMES } from "../../../../functions/src/shared/model";
import {
  getMissionTeamSize,
  requiresTwoFails,
} from "../../../../functions/src/shared/rules";
import { gameAction } from "../../firebase/api";
import { useAction } from "../../hooks/useAction";
const phaseNames = {
  ROLE_REVEAL: "身份揭曉",
  TEAM_SELECTION: "選擇任務成員",
  TEAM_VOTE: "表決提案",
  MISSION_VOTE: "執行任務",
  MISSION_RESULT: "任務結果",
  ASSASSINATION: "刺殺梅林",
  GAME_OVER: "終局揭曉",
};
export function AvalonGame({
  room,
  role,
  uid,
  connected,
  onRematch,
  roomPending,
}: {
  room: Room;
  role: PrivateRole | null;
  uid: string;
  connected: boolean;
  onRematch: () => void;
  roomPending: boolean;
}) {
  const game = room.game!;
  const { pending, error, run } = useAction();
  const [showRole, setShowRole] = useState(false);
  const name = (id: string) => room.players[id]?.nickname ?? "已離開的玩家";
  const act = (action: GameAction) =>
    void run(() => gameAction(room.code, game, action));
  const disabled = pending || !connected;
  const leader = uid === game.leaderId;
  const submitted = game.submitted?.[uid];
  const teamSize = getMissionTeamSize(game.order.length, game.round);
  return (
    <>
      <div className="mission-track" aria-label="任務進度">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            className={`mission-dot ${game.missionResults[i]?.result ?? ""} ${game.round === i + 1 ? "current" : ""}`}
            key={i}
          >
            <span>
              {game.missionResults[i]?.result === "success" ? (
                <Check size={19} />
              ) : game.missionResults[i]?.result === "fail" ? (
                <X size={19} />
              ) : (
                i + 1
              )}
            </span>
            <small>
              {getMissionTeamSize(game.order.length, i + 1)} 人
              {requiresTwoFails(game.order.length, i + 1) ? " · 雙敗" : ""}
            </small>
          </div>
        ))}
      </div>
      <div className="game-phase-heading">
        <h2>{phaseNames[game.phase]}</h2>
        <span className="tag">
          第 {game.round} 輪 · 提案 {game.proposalAttempt}/5
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${game.id}:${game.phase}:${game.round}`}
          className="panel game-stage"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {game.phase === "ROLE_REVEAL" && (
            <>
              <p className="eyebrow">A SECRET TO KEEP</p>
              <h2>命運，已為你選好身份。</h2>
              <p className="muted">請確認旁邊沒有其他玩家，再翻開身份卡。</p>
              <button
                className="primary"
                onClick={() => setShowRole(true)}
                disabled={!role}
              >
                <Eye size={18} />
                查看你的身份
              </button>
              <p className="fine">
                {Object.keys(game.revealed).length} / {game.order.length}{" "}
                位已確認{game.revealed[uid] ? " · 等待其他玩家" : ""}
              </p>
            </>
          )}
          {game.phase === "TEAM_SELECTION" && (
            <>
              <p className="eyebrow">BUILD YOUR TRUST</p>
              <h2>
                {leader
                  ? "由你組建這次的遠征隊。"
                  : `${name(game.leaderId)} 正在組隊`}
              </h2>
              <p className="muted">
                請選擇 {teamSize} 位任務成員。
                {requiresTwoFails(game.order.length, game.round) &&
                  "本輪需要兩張失敗票才會失敗。"}
              </p>
              <div className="team-picker">
                {game.order.map((id) => (
                  <button
                    key={id}
                    className={
                      game.selectedPlayerIds.includes(id) ? "selected" : ""
                    }
                    aria-pressed={game.selectedPlayerIds.includes(id)}
                    disabled={disabled || !leader}
                    onClick={() =>
                      act({
                        type: "select",
                        players: game.selectedPlayerIds.includes(id)
                          ? game.selectedPlayerIds.filter((p) => p !== id)
                          : [...game.selectedPlayerIds, id],
                      })
                    }
                  >
                    <span className="avatar">{name(id).slice(0, 1)}</span>
                    {name(id)}
                    {game.selectedPlayerIds.includes(id) && <Check size={16} />}
                  </button>
                ))}
              </div>
              {leader && (
                <button
                  className="primary"
                  disabled={
                    disabled || game.selectedPlayerIds.length !== teamSize
                  }
                  onClick={() => act({ type: "propose" })}
                >
                  提交隊伍（{game.selectedPlayerIds.length}/{teamSize}）
                </button>
              )}
            </>
          )}
          {game.phase === "TEAM_VOTE" && (
            <>
              <Swords className="gold" size={38} />
              <h2>你信任這支隊伍嗎？</h2>
              <p className="team-names">
                {game.selectedPlayerIds.map(name).join(" · ")}
              </p>
              <p className="muted">
                過半贊成即通過；五次連續否決，邪惡陣營獲勝。
                <br />
                所有人投完後才會公開結果。
              </p>
              {submitted ? (
                <p className="success-text">已投票，等待其他玩家。</p>
              ) : (
                <div className="actions">
                  <button
                    className="primary"
                    disabled={disabled}
                    onClick={() => act({ type: "teamVote", vote: "approve" })}
                  >
                    <Check size={18} />
                    贊成
                  </button>
                  <button
                    disabled={disabled}
                    onClick={() => act({ type: "teamVote", vote: "reject" })}
                  >
                    <X size={18} />
                    反對
                  </button>
                </div>
              )}
              <p className="fine">
                {Object.keys(game.submitted).length} / {game.order.length}{" "}
                位已投票
              </p>
            </>
          )}
          {game.phase === "MISSION_VOTE" && (
            <>
              <Shield className="gold" size={42} />
              <h2>遠征的命運，在你手中。</h2>
              <p className="team-names">
                {game.selectedPlayerIds.map(name).join(" · ")}
              </p>
              <p className="muted">任務票保持匿名。正義陣營只能選擇成功。</p>
              {!game.selectedPlayerIds.includes(uid) ? (
                <p>等待任務成員做出選擇…</p>
              ) : submitted ? (
                <p className="success-text">已提交任務票，等待結果。</p>
              ) : (
                <div className="actions">
                  <button
                    className="primary"
                    disabled={disabled || !role}
                    onClick={() =>
                      act({ type: "missionVote", vote: "success" })
                    }
                  >
                    任務成功
                  </button>
                  {role?.side === "evil" && (
                    <button
                      className="danger"
                      disabled={disabled}
                      onClick={() => act({ type: "missionVote", vote: "fail" })}
                    >
                      任務失敗
                    </button>
                  )}
                </div>
              )}
              <p className="fine">
                {Object.keys(game.submitted).length} /{" "}
                {game.selectedPlayerIds.length} 位已提交
              </p>
            </>
          )}
          {game.phase === "MISSION_RESULT" && (
            <>
              <div
                className={`result-symbol ${game.missionResults.at(-1)?.result}`}
              >
                {game.missionResults.at(-1)?.result === "success" ? (
                  <Shield size={52} />
                ) : (
                  <Skull size={52} />
                )}
              </div>
              <h2>
                {game.missionResults.at(-1)?.result === "success"
                  ? "任務成功，曙光仍在。"
                  : "任務失敗，暗影漸深。"}
              </h2>
              <p className="muted">
                本輪共有 {game.missionResults.at(-1)?.fails} 張失敗票。
                {requiresTwoFails(game.order.length, game.round) &&
                  "本輪需兩張失敗票才會失敗。"}
              </p>
              {leader ? (
                <button
                  className="primary"
                  disabled={disabled}
                  onClick={() => act({ type: "continue" })}
                >
                  繼續遊戲
                </button>
              ) : (
                <p>等待隊長 {name(game.leaderId)} 繼續…</p>
              )}
            </>
          )}
          {game.phase === "ASSASSINATION" && (
            <>
              <Skull size={42} className="gold" />
              <h2>最後一劍，能否改寫命運？</h2>
              <p className="muted">
                三次任務成功。刺客仍有最後一次機會找出梅林。
              </p>
              {role?.role === "assassin" ? (
                <>
                  <p>選擇你認為是梅林的玩家，送出後立即結算。</p>
                  <div className="team-picker">
                    {game.order
                      .filter(
                        (id) => id !== uid && !role.knowledge.includes(id),
                      )
                      .map((id) => (
                        <button
                          disabled={disabled}
                          key={id}
                          onClick={() =>
                            act({ type: "assassinate", target: id })
                          }
                        >
                          <Swords size={17} />
                          刺殺 {name(id)}
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <p>等待刺客做出最後的選擇…</p>
              )}
            </>
          )}
          {game.phase === "GAME_OVER" && (
            <>
              <p className="eyebrow">THE STORY IS TOLD</p>
              <div
                className={`result-symbol ${game.winner === "good" ? "success" : "fail"}`}
              >
                <CrownResult />
              </div>
              <h2>
                {game.winner === "good"
                  ? "正義陣營獲勝"
                  : game.winner === "evil"
                    ? "邪惡陣營獲勝"
                    : "本局中止"}
              </h2>
              <p className="muted">{game.winReason}</p>
              <div className="role-results">
                {Object.entries(game.roles ?? {}).map(([id, r]) => (
                  <div key={id}>
                    <span>{name(id)}</span>
                    <strong>{ROLE_NAMES[r]}</strong>
                  </div>
                ))}
              </div>
              {room.hostId === uid ? (
                <button
                  className="primary"
                  disabled={roomPending || !connected}
                  onClick={onRematch}
                >
                  再玩一局
                </button>
              ) : (
                <p>等待房主開啟下一局，或從左側離開房間。</p>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
      {game.lastTeamVote && (
        <details className="panel vote-history" open>
          <summary>
            上一輪組隊表決 · {game.lastTeamVote.approved ? "通過" : "否決"}
          </summary>
          <div className="vote-chips">
            {Object.entries(game.lastTeamVote.votes).map(([id, v]) => (
              <span
                key={id}
                className={v === "approve" ? "success-text" : "fail-text"}
              >
                {name(id)} {v === "approve" ? "贊成" : "反對"}
              </span>
            ))}
          </div>
        </details>
      )}
      {game.missionResults.length > 0 && (
        <details className="panel vote-history">
          <summary>任務紀錄</summary>
          {game.missionResults.map((m, i) => (
            <p key={i}>
              第 {i + 1} 輪：{m.result === "success" ? "成功" : "失敗"} ·{" "}
              {m.fails} 張失敗票
              <br />
              <small>{m.team.map(name).join("、")}</small>
            </p>
          ))}
        </details>
      )}
      {game.phase !== "GAME_OVER" && game.phase !== "ROLE_REVEAL" && (
        <button className="quiet" onClick={() => setShowRole(true)}>
          <Eye size={16} />
          查看我的身份
        </button>
      )}
      <AnimatePresence>
        {showRole && role && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              className={`panel role-card ${role.side}`}
              role="dialog"
              aria-modal="true"
              aria-label="你的身份"
              initial={{ rotateY: 80, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
            >
              <p className="eyebrow">YOUR SECRET IDENTITY</p>
              {role.side === "good" ? (
                <Shield size={66} strokeWidth={1} />
              ) : (
                <Skull size={66} strokeWidth={1} />
              )}
              <h2>{ROLE_NAMES[role.role]}</h2>
              <p className="tag">
                {role.side === "good" ? "正義陣營" : "邪惡陣營"}
              </p>
              <p>
                {role.knowledgeType === "candidates"
                  ? "以下兩人之中，一位是梅林，一位是莫甘娜。"
                  : role.knowledgeType === "evil"
                    ? "你知道以下玩家屬於邪惡陣營："
                    : "你沒有額外情報，請從討論中找出可信任的人。"}
              </p>
              <p className="team-names">
                {role.knowledge.map(name).join(" · ")}
              </p>
              {role.role === "assassin" && (
                <p className="fine">
                  三次任務成功後，你可以刺殺梅林，扭轉結局。
                </p>
              )}
              <button
                className="primary"
                onClick={() => {
                  if (game.phase === "ROLE_REVEAL" && !game.revealed[uid])
                    act({ type: "reveal" });
                  setShowRole(false);
                }}
                disabled={disabled}
              >
                收起身份{game.phase === "ROLE_REVEAL" ? "，確認準備" : ""}
              </button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
function CrownResult() {
  return <Swords size={52} />;
}
