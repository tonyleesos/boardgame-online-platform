import { useState } from "react";
import {
  Check,
  Eye,
  Crown,
  ShieldX,
  Skull,
  Swords,
  Bot,
  X,
  Trophy,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
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
import { PlayerIdentity } from "../../components/PlayerIdentity";
import { GameDialog } from "../../components/GameDialog";
import { QuestMap, RolePortrait, VoteArt } from "./AvalonArt";
import { useAvalonPresentation } from "./useAvalonPresentation";
import { ExpeditionScene, ExpeditionOutcome } from "./ExpeditionScene";
import "./avalon.css";
const phaseNames = {
  ROLE_REVEAL: "身份揭曉",
  TEAM_SELECTION: "選擇任務成員",
  TEAM_VOTE: "隊伍表決",
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
  const liveGame = room.game!;
  const { game, stage, finish: finishStage } = useAvalonPresentation(liveGame);
  const transitioning = !!stage && stage.kind !== "reveal";
  const { pending, error, run } = useAction();
  const [showRole, setShowRole] = useState(false);
  const [dismissed, setDismissed] = useState("");
  const [seenResult, setSeenResult] = useState("");
  const [seenVictory, setSeenVictory] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const name = (id: string) => room.players[id]?.nickname ?? "已離開的玩家";
  const identity = (id: string) => (
    <PlayerIdentity name={name(id)} index={game.order.indexOf(id)} />
  );
  const act = (action: GameAction) =>
    void run(() => gameAction(room.code, liveGame, action));
  const disabled = pending || !connected || transitioning;
  const leader = uid === game.leaderId;
  const submitted = !!game.submitted[uid];
  const teamSize = getMissionTeamSize(game.order.length, game.round);
  const promptKey = `${game.id}:${game.round}:${game.phase}:${game.proposalAttempt}`;
  const needsVote =
    !stage &&
    !submitted &&
    (game.phase === "TEAM_VOTE" ||
      (game.phase === "MISSION_VOTE" && game.selectedPlayerIds.includes(uid)));
  const showVote = needsVote && dismissed !== promptKey && !showRole;
  const rows = Math.ceil(game.order.length / 2);
  const picking = !stage && game.phase === "TEAM_SELECTION";
  const assassinating =
    !stage && game.phase === "ASSASSINATION" && role?.role === "assassin";
  const last = game.missionResults.at(-1);
  const resultKey = `${game.id}:${game.missionResults.length}`;
  const ended = game.phase === "GAME_OVER";
  const showVictory = ended && !stage && seenVictory !== game.id;
  const victoryTitle =
    game.winner === "good"
      ? "好人陣營勝利"
      : game.winner === "evil"
        ? "壞人陣營勝利"
        : "本局中止";
  const closeVictory = () => {
    setSeenVictory(game.id);
    setSeenResult(resultKey);
    setShowRole(false);
  };
  // Retain the reveal when an AI leader advances before this player dismisses it.
  const unseenResult = !!last && seenResult !== resultKey;
  const showResult =
    unseenResult &&
    !transitioning &&
    (stage?.kind === "reveal" || !showRole || ended) &&
    !showVictory;
  const dismissResult = () => {
    setSeenResult(resultKey);
    if (stage?.kind === "reveal") finishStage();
  };
  const canContinue =
    liveGame.phase === "MISSION_RESULT" &&
    liveGame.missionResults.length === game.missionResults.length &&
    liveGame.leaderId === uid;
  const seatBallot =
    stage?.kind === "ballot" ||
    game.phase === "MISSION_VOTE" ||
    game.phase === "MISSION_RESULT"
      ? game.lastTeamVote
      : undefined;
  const history =
    stage?.kind === "battle"
      ? game.missionResults.slice(0, -1)
      : game.missionResults;
  const rejections = game.lastTeamVote?.approved
    ? 0
    : Math.min(
        5,
        game.proposalAttempt -
          1 +
          (game.phase === "GAME_OVER" &&
          game.lastTeamVote?.approved === false &&
          game.proposalAttempt === 5
            ? 1
            : 0),
      );
  return (
    <div className="avalon-game">
      <div className="game-core avalon-core">
        <QuestMap
          game={game}
          concealLatest={unseenResult && (!ended || !!stage)}
          travelling={stage?.kind === "travel"}
        />
        <section
          className={`rejection-track ${rejections >= 4 ? "at-risk" : ""}`}
          aria-label={`連續否決 ${rejections} / 5 次`}
        >
          <div className="rejection-heading">
            <ShieldX size={19} />
            <strong>連續否決</strong>
            <span>{rejections} / 5 次</span>
          </div>
          <div className="rejection-marks" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < rejections ? "rejected" : ""}>
                {i < rejections ? <X size={16} /> : i + 1}
              </span>
            ))}
          </div>
          <small>
            {rejections === 5
              ? "連續五次否決，邪惡陣營獲勝。"
              : rejections === 4
                ? "最後一次組隊機會！再被否決，邪惡獲勝。"
                : "過半贊成才出發 · 平票否決 · 隊伍通過即歸零"}
          </small>
        </section>
        <div className="game-phase-heading">
          <h2>
            {stage?.kind === "ballot"
              ? "表決結果"
              : stage?.kind === "battle"
                ? "探險隊冒險中"
                : stage?.kind === "travel"
                  ? "遠征隊行進中"
                  : phaseNames[game.phase]}
          </h2>
          <span className="tag">提案 {game.proposalAttempt} / 5</span>
        </div>
        {error && !showVote && !showRole && !target && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <section className="game-stage round-table" aria-label="阿瓦隆圓桌">
          <div
            className="team-picker round-seats"
            style={{ gridTemplateRows: `repeat(${rows}, minmax(60px, 1fr))` }}
          >
            <div
              className="table-message"
              style={{ gridRow: `1 / ${rows + 1}` }}
            >
              {transitioning && stage && (
                <ExpeditionScene
                  key={stage.id}
                  stage={stage}
                  onComplete={finishStage}
                />
              )}
              {!transitioning && (
                <>
                  <div className="table-crest" aria-hidden="true">
                    <Swords strokeWidth={1} />
                  </div>
                  {game.phase === "ROLE_REVEAL" && (
                    <>
                      <h3>
                        你的故事
                        <br />
                        即將開始
                      </h3>
                      <p>查看秘密身份</p>
                      <small>
                        {Object.keys(game.revealed).length} /{" "}
                        {game.order.length} 已確認
                      </small>
                    </>
                  )}
                  {picking && (
                    <>
                      <h3>
                        {leader
                          ? "由你組建這次的遠征隊。"
                          : `${name(game.leaderId)} 正在組隊`}
                      </h3>
                      <p>選擇 {teamSize} 位夥伴</p>
                      <strong className="table-count">
                        {game.selectedPlayerIds.length}
                        <small> / {teamSize}</small>
                      </strong>
                      {requiresTwoFails(game.order.length, game.round) && (
                        <small>本輪需兩張失敗票才失敗</small>
                      )}
                    </>
                  )}
                  {(game.phase === "TEAM_VOTE" ||
                    game.phase === "MISSION_VOTE") && (
                    <>
                      <h3>
                        {game.phase === "TEAM_VOTE"
                          ? "信任這支隊伍？"
                          : "遠征進行中"}
                      </h3>
                      <p>
                        {submitted
                          ? "已提交，等待夥伴"
                          : needsVote
                            ? "輪到你做出選擇"
                            : "等待遠征隊回報"}
                      </p>
                      <strong className="table-count">
                        {Object.keys(game.submitted).length}
                        <small>
                          {" "}
                          /{" "}
                          {game.phase === "TEAM_VOTE"
                            ? game.order.length
                            : teamSize}
                        </small>
                      </strong>
                    </>
                  )}
                  {game.phase === "MISSION_RESULT" && (
                    <>
                      <h3>遠征隊已歸來</h3>
                      <p>開啟戰報，揭曉任務結果</p>
                      {!leader && <small>等待隊長繼續</small>}
                    </>
                  )}
                  {game.phase === "ASSASSINATION" && (
                    <>
                      <Skull className="fail-text" />
                      <h3>最後一擊</h3>
                      <p>
                        {assassinating ? "點選你認為的梅林" : "等待刺客選擇"}
                      </p>
                    </>
                  )}
                  {game.phase === "GAME_OVER" && (
                    <>
                      <Crown className="gold" />
                      <h2>
                        {game.winner === "good"
                          ? "正義陣營獲勝"
                          : game.winner === "evil"
                            ? "邪惡陣營獲勝"
                            : "本局中止"}
                      </h2>
                      <p>{game.winReason}</p>
                    </>
                  )}
                </>
              )}
            </div>
            {game.order.map((id, i) => {
              const selected = game.selectedPlayerIds.includes(id);
              const canSelect =
                picking &&
                leader &&
                (selected || game.selectedPlayerIds.length < teamSize);
              const canAssassinate =
                assassinating && id !== uid && !role.knowledge.includes(id);
              return (
                <button
                  key={id}
                  className={`table-seat ${selected ? "selected" : ""} ${id === game.leaderId ? "is-leader" : ""}`}
                  style={{
                    gridColumn: i < rows ? 1 : 3,
                    gridRow: (i % rows) + 1,
                  }}
                  disabled={disabled || !(canSelect || canAssassinate)}
                  aria-pressed={selected}
                  aria-label={
                    canAssassinate
                      ? `刺殺 ${name(id)}`
                      : `${name(id)}${id === uid ? "（你）" : ""}`
                  }
                  onClick={() =>
                    canAssassinate
                      ? setTarget(id)
                      : act({
                          type: "select",
                          players: selected
                            ? game.selectedPlayerIds.filter((p) => p !== id)
                            : [...game.selectedPlayerIds, id],
                        })
                  }
                >
                  <span className={`avatar color-${i % 4}`}>
                    {name(id).slice(0, 1)}
                    <span className="seat-number">{i + 1}</span>
                    {id === game.leaderId && (
                      <Crown
                        className="seat-crown"
                        size={15}
                        aria-label="隊長"
                      />
                    )}
                    {(selected ||
                      game.submitted[id] ||
                      (game.revealed[id] && game.phase === "ROLE_REVEAL")) && (
                      <Check className="seat-check" size={14} />
                    )}
                  </span>
                  <span className="seat-name">
                    {name(id)}
                    {id === uid && " · 你"}
                  </span>
                  {seatBallot?.votes[id] && (
                    <span
                      className={`seat-ballot ballot-${seatBallot.votes[id]}`}
                    >
                      {seatBallot.votes[id] === "approve" ? (
                        <>
                          <ThumbsUp size={14} />
                          贊成
                        </>
                      ) : (
                        <>
                          <ThumbsDown size={14} />
                          反對
                        </>
                      )}
                    </span>
                  )}
                  <small>
                    {game.roles?.[id] ? (
                      ROLE_NAMES[game.roles[id]]
                    ) : room.players[id]?.isBot ? (
                      <>
                        <Bot size={11} />{" "}
                        {room.players[id]?.isProxy ? "AI 接手" : "AI"}
                      </>
                    ) : selected ? (
                      "遠征隊員"
                    ) : (
                      "圓桌騎士"
                    )}
                  </small>
                </button>
              );
            })}
          </div>
        </section>
        <div className="game-dock">
          {game.phase !== "GAME_OVER" && (
            <button
              className="quiet"
              disabled={!role || transitioning}
              onClick={() => setShowRole(true)}
            >
              <Eye size={18} />
              {game.phase === "ROLE_REVEAL" ? "查看你的身份" : "我的身份"}
            </button>
          )}
          {picking && leader && (
            <button
              className="primary"
              disabled={disabled || game.selectedPlayerIds.length !== teamSize}
              onClick={() => act({ type: "propose" })}
            >
              提交隊伍（{game.selectedPlayerIds.length}/{teamSize}）
            </button>
          )}
          {needsVote && (
            <button className="primary" onClick={() => setDismissed("")}>
              {game.phase === "TEAM_VOTE" ? "開啟投票" : "選擇任務牌"}
            </button>
          )}
          {last && !transitioning && (
            <button className="quiet" onClick={() => setSeenResult("")}>
              查看任務結果
            </button>
          )}
          {canContinue && !stage && !unseenResult && (
            <button
              className="primary"
              disabled={disabled}
              onClick={() => act({ type: "continue" })}
            >
              繼續遊戲
            </button>
          )}
          {ended && !stage && room.hostId === uid && (
            <button
              className="primary"
              disabled={roomPending || !connected}
              onClick={onRematch}
            >
              再玩一局
            </button>
          )}
          {ended && !stage && (
            <button className="quiet" onClick={() => setSeenVictory("")}>
              <Trophy size={18} />
              查看勝負
            </button>
          )}
        </div>
      </div>
      <div className="game-extras">
        {game.lastTeamVote && (
          <details className="panel vote-history">
            <summary>
              上一輪組隊表決 · {game.lastTeamVote.approved ? "通過" : "否決"}
            </summary>
            <div className="vote-chips">
              {Object.entries(game.lastTeamVote.votes).map(([id, v]) => (
                <span
                  key={id}
                  className={`vote-chip ${v === "approve" ? "success-text" : "fail-text"}`}
                >
                  {identity(id)}{" "}
                  {v === "approve" ? (
                    <>
                      <ThumbsUp size={15} />
                      贊成
                    </>
                  ) : (
                    <>
                      <ThumbsDown size={15} />
                      反對
                    </>
                  )}
                </span>
              ))}
            </div>
          </details>
        )}
        {history.length > 0 && (
          <details className="panel vote-history">
            <summary>任務紀錄</summary>
            {history.map((m, i) => (
              <p key={i}>
                第 {i + 1} 輪 · {m.result === "success" ? "成功" : "失敗"} ·{" "}
                {m.fails} 張失敗票
                <br />
                <small>{m.team.map(name).join("、")}</small>
              </p>
            ))}
          </details>
        )}
        <details className="panel vote-history">
          <summary>玩法與圖示說明</summary>
          <p>
            皇冠是隊長，金框是遠征隊員。點選座位組隊；所有人投票過半才出發，平票視為否決，連續五次否決則邪惡獲勝。
          </p>
          <p>
            正義只能選任務成功，邪惡可選成功或失敗。七人以上的第四輪需要兩張失敗票。三次成功後由刺客尋找梅林。
          </p>
        </details>
      </div>
      {showVote && !showResult && (
        <GameDialog
          key={promptKey}
          title={game.phase === "TEAM_VOTE" ? "隊伍表決" : "選擇任務牌"}
          onClose={() => setDismissed(promptKey)}
          className="vote-dialog"
        >
          <p className="eyebrow">
            {game.phase === "TEAM_VOTE"
              ? "MAKE YOUR CHOICE"
              : "THE FATE OF THE QUEST"}
          </p>
          <h2>
            {game.phase === "TEAM_VOTE" ? "讓這支隊伍出發？" : "你將帶回什麼？"}
          </h2>
          <div className="team-names identity-list">
            {game.selectedPlayerIds.map((id) => (
              <span key={id}>{identity(id)}</span>
            ))}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="vote-options">
            {game.phase === "TEAM_VOTE" ? (
              <>
                <button
                  disabled={disabled}
                  aria-label="贊成"
                  onClick={() => act({ type: "teamVote", vote: "approve" })}
                >
                  <VoteArt kind="approve" />
                  <strong>贊成</strong>
                  <small>讓遠征啟程</small>
                </button>
                <button
                  disabled={disabled}
                  aria-label="反對"
                  onClick={() => act({ type: "teamVote", vote: "reject" })}
                >
                  <VoteArt kind="reject" />
                  <strong>反對</strong>
                  <small>重新組建隊伍</small>
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={disabled || !role}
                  aria-label="任務成功"
                  onClick={() => act({ type: "missionVote", vote: "success" })}
                >
                  <VoteArt kind="success" />
                  <strong>任務成功</strong>
                  <small>守護亞瑟的誓言</small>
                </button>
                <button
                  disabled={disabled || role?.side !== "evil"}
                  aria-label="任務失敗"
                  onClick={() => act({ type: "missionVote", vote: "fail" })}
                >
                  <VoteArt kind="fail" />
                  <strong>任務失敗</strong>
                  <small>
                    {role?.side === "evil" ? "讓暗影降臨" : "僅邪惡陣營可選"}
                  </small>
                </button>
              </>
            )}
          </div>
          <p className="fine">
            {game.phase === "TEAM_VOTE"
              ? "全員提交後公開表決；平票即否決。"
              : "任務票保密，只公開失敗票數。"}
          </p>
          <button className="quiet" onClick={() => setDismissed(promptKey)}>
            先看看圓桌
          </button>
        </GameDialog>
      )}
      {showResult && last && (
        <GameDialog
          key={resultKey}
          title="任務結果"
          onClose={dismissResult}
          className={`mission-result-dialog result-${last.result}`}
        >
          <p className="eyebrow">
            QUEST {game.missionResults.length} · 遠征戰報
          </p>
          <ExpeditionOutcome success={last.result === "success"} />
          <div className="mission-result-art">
            <VoteArt kind={last.result} />
          </div>
          <h2>{last.result === "success" ? "任務成功" : "任務失敗"}</h2>
          <p>
            {last.result === "success"
              ? "誓言未滅，曙光仍在。"
              : "暗影蔓延，信任出現裂痕。"}
          </p>
          <div className="mission-ballots">
            <span>
              <Trophy size={17} />
              {last.team.length - last.fails} 張成功票
            </span>
            <span>
              <Skull size={17} />
              {last.fails} 張失敗票
            </span>
          </div>
          <div className="identity-list">
            {last.team.map((id) => (
              <span key={id}>{identity(id)}</span>
            ))}
          </div>
          <p className="fine">
            {requiresTwoFails(game.order.length, game.missionResults.length)
              ? "本輪需兩張失敗票才算任務失敗。"
              : "本輪只要一張失敗票，任務即失敗。"}
            任務票不公開投票者。
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {canContinue ? (
            <button
              className="primary"
              disabled={disabled}
              onClick={() =>
                void run(async () => {
                  await gameAction(room.code, liveGame, { type: "continue" });
                  dismissResult();
                })
              }
            >
              繼續遊戲
            </button>
          ) : (
            <button
              className="primary"
              onClick={dismissResult}
            >
              返回圓桌
            </button>
          )}
        </GameDialog>
      )}
      {showRole && role && !ended && !transitioning && !showResult && (
        <GameDialog
          title="你的身份"
          onClose={() => setShowRole(false)}
          className={`role-card ${role.side}`}
        >
          <RolePortrait role={role.role} />
          <h2>{ROLE_NAMES[role.role]}</h2>
          <p className="tag">
            {role.side === "good" ? "正義陣營" : "邪惡陣營"}
          </p>
          <p>
            {role.knowledgeType === "candidates"
              ? "以下兩人，一位是梅林，一位是莫甘娜。"
              : role.knowledgeType === "evil"
                ? "你知道以下玩家屬於邪惡陣營："
                : "你沒有額外情報，從討論中找出可信任的人。"}
          </p>
          <div className="team-names identity-list">
            {role.knowledge.map((id) => (
              <span key={id}>{identity(id)}</span>
            ))}
          </div>
          {role.role === "assassin" && (
            <p className="fine">三次任務成功後，你可以刺殺梅林，扭轉結局。</p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary"
            disabled={disabled}
            onClick={() =>
              void run(async () => {
                if (game.phase === "ROLE_REVEAL" && !game.revealed[uid])
                  await gameAction(room.code, game, { type: "reveal" });
                setShowRole(false);
              })
            }
          >
            收起身份{game.phase === "ROLE_REVEAL" ? "，確認準備" : ""}
          </button>
        </GameDialog>
      )}
      {target && assassinating && !showResult && !showRole && (
        <GameDialog title="確認刺殺目標" onClose={() => setTarget(null)}>
          <h2>刺殺 {name(target)}？</h2>
          <p>只有一次機會，確認後揭曉勝負。</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            className="danger"
            disabled={disabled}
            onClick={() => act({ type: "assassinate", target })}
          >
            確認刺殺
          </button>
        </GameDialog>
      )}
      {showVictory && (
        <GameDialog
          title="阿瓦隆終局揭曉"
          onClose={closeVictory}
          className={`avalon-victory victory-${game.winner ?? "none"}`}
        >
          <p className="eyebrow">THE LEGEND IS WRITTEN · 終局揭曉</p>
          <div className="victory-emblem" aria-hidden="true">
            {game.winner === "evil" ? (
              <Skull />
            ) : game.winner === "good" ? (
              <Crown />
            ) : (
              <Swords />
            )}
          </div>
          <h2>{victoryTitle}</h2>
          <p className="victory-subtitle">
            {game.winner === "good"
              ? "曙光重返卡美洛"
              : game.winner === "evil"
                ? "暗影籠罩圓桌"
                : "冒險暫告一段落"}
          </p>
          <p>{game.winReason}</p>
          <div className="victory-score">
            <span>
              <Trophy />
              {game.missionResults.filter((m) => m.result === "success").length}
              <small>任務成功</small>
            </span>
            <span>
              <Skull />
              {game.missionResults.filter((m) => m.result === "fail").length}
              <small>任務失敗</small>
            </span>
          </div>
          <button className="primary" onClick={closeVictory}>
            <Eye size={18} />
            查看全員身份與圓桌
          </button>
        </GameDialog>
      )}
    </div>
  );
}
