import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Eye,
  Scissors,
  ShieldCheck,
  Flame,
  Clock3,
  Check,
  Shield,
  Leaf,
  Heart,
  Zap,
  Unlock,
  Crosshair,
} from "lucide-react";
import type { Room } from "../../../../functions/src/shared/model";
import type {
  BombAction,
  BombPrivate,
  Wire,
} from "../../../../functions/src/shared/timebomb";
import {
  COLOR_NAMES,
  BOMB_EFFECTS,
  bombThreshold,
  defusableColors,
  rearmableColors,
} from "../../../../functions/src/shared/timebomb";
import { bombAction } from "../../firebase/api";
import { useAction } from "../../hooks/useAction";
import "./timebomb.css";
const wireName = (w: Wire) =>
  w === "success"
    ? "解除引線"
    : w === "safe"
      ? "安全引線"
      : w === "bomb"
        ? "炸彈"
        : `${COLOR_NAMES[w]}炸彈`;
export function WireCard({
  wire = "back",
  small = false,
}: {
  wire?: Wire | "back";
  small?: boolean;
}) {
  const glyphs = {
    back: Scissors,
    success: Check,
    safe: Shield,
    bomb: Flame,
    green: Leaf,
    orange: Clock3,
    pink: Heart,
    yellow: Zap,
    blue: Unlock,
    red: Crosshair,
  };
  const Glyph = glyphs[wire];
  return (
    <span
      className={`wire-card wire-${wire} ${small ? "small" : ""}`}
      role="img"
      aria-label={wire === "back" ? "未知引線" : wireName(wire)}
    >
      {wire === "safe" ? (
        <svg className="safe-wire-art" viewBox="0 0 100 150" aria-hidden="true">
          <path
            d="M28 -5 C10 45 45 85 28 155 M52 -5 C75 45 30 100 52 155 M77 -5 C55 50 90 95 77 155"
            fill="none"
            stroke="#332416"
            strokeWidth="12"
          />
          <path
            d="M28 -5 C10 45 45 85 28 155 M52 -5 C75 45 30 100 52 155 M77 -5 C55 50 90 95 77 155"
            fill="none"
            stroke="#c89857"
            strokeWidth="7"
          />
          <path
            d="M28 -5 C10 45 45 85 28 155"
            fill="none"
            stroke="#efe0ad"
            strokeWidth="2"
          />
        </svg>
      ) : (
        <span
          className={`card-art ${wire === "back" ? "art-back" : wire === "success" ? "art-wire" : "art-bomb"}`}
        />
      )}
      <span className="wire-glyph">
        <Glyph size={20} />
      </span>
      <span className="wire-label">
        {wire === "back" ? "未知引線" : wireName(wire)}
      </span>
    </span>
  );
}
export function TimeBombGame({
  room,
  role,
  uid,
  connected,
  onRematch,
  roomPending,
}: {
  room: Room;
  role: BombPrivate | null;
  uid: string;
  connected: boolean;
  onRematch: () => void;
  roomPending: boolean;
}) {
  const g = room.timebomb!;
  const classic = g.variant === "classic";
  const edition = classic
    ? "驚爆倫敦 · 原版"
    : g.variant === "evolution"
      ? "危機進化"
      : "危機進化 · 舊基礎規則";
  const [showPrivate, setShowPrivate] = useState(false);
  const [claim, setClaim] = useState(0);
  const { pending, error, run } = useAction();
  const disabled = pending || !connected;
  const act = (action: BombAction) =>
    void run(() => bombAction(room.code, g, action));
  const name = (id: string) => room.players[id]?.nickname ?? "已離開的玩家";
  const last = g.history.at(-1);
  const isCutter = g.scissorsId === uid;
  const labels = {
    ROLE_REVEAL: "身份與引線",
    CLAIMS: "交換情報",
    CUT: "剪斷一條引線",
    DEFUSE: "選擇拆除的炸彈",
    REARM: "藍色炸彈：移除保護",
    CUT_RESULT: "剪線結果",
    GAME_OVER: "倫敦的命運",
  };
  return (
    <div className="timebomb-table">
      <div className="bomb-score">
        <span>
          <Clock3 size={18} />第 {g.round} / 4 輪
        </span>
        <span>
          <Scissors size={18} />
          {g.cuts} / {g.cutLimit} 次剪線
        </span>
        <span>
          <ShieldCheck size={18} />
          {g.successes} / {g.order.length} 條解除
        </span>
      </div>
      {classic ? (
        <div className="classic-wire-guide" aria-label="原版卡牌規則">
          {(["safe", "success", "bomb"] as const).map((w) => (
            <div key={w}>
              <WireCard wire={w} small />
              <span>
                {w === "safe"
                  ? "平安無事"
                  : w === "success"
                    ? `集滿 ${g.order.length} 張`
                    : "翻開即引爆"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bomb-track">
          {g.colors.map((c) => (
            <div
              key={c}
              className={`bomb-meter bomb-${c} ${g.defused[c] ? "defused" : ""}`}
            >
              <span>
                {COLOR_NAMES[c]}
                {g.defused[c] && <ShieldCheck size={14} />}
              </span>
              <strong>
                {g.bombs[c] ?? 0}
                <small> / {bombThreshold(g, c)}</small>
              </strong>
              <span className="meter-dots">
                {Array.from({ length: bombThreshold(g, c) }, (_, i) => (
                  <i
                    key={i}
                    className={i < (g.bombs[c] ?? 0) ? "filled" : ""}
                  />
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="game-phase-heading">
        <h2>{labels[g.phase]}</h2>
        <span className="tag">{edition}</span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <motion.section
        key={`${g.round}:${g.phase}`}
        className="panel bomb-stage"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {g.phase === "ROLE_REVEAL" && (
          <>
            <div className="role-preview art-detective card-art" />
            <p className="eyebrow">LONDON · 1890</p>
            <h2>你是拯救倫敦的人，還是暗中的破壞者？</h2>
            <p className="muted">
              先確認陣營與自己的引線組成。重新洗勻後，沒有人知道任何一張蓋牌的位置。
            </p>
            <button
              className="primary"
              disabled={!role}
              onClick={() => setShowPrivate(true)}
            >
              <Eye size={18} />
              查看身份與引線
            </button>
            <p className="fine">
              {Object.keys(g.confirmed).length} / {g.order.length} 位已確認
            </p>
          </>
        )}
        {g.phase === "CLAIMS" && (
          <>
            <p className="eyebrow">TRUTH OR BLUFF?</p>
            <h2>這一輪，你打算怎麼說？</h2>
            <p className="muted">
              宣稱你有幾條解除引線；可以說真話，也可以虛張聲勢。宣言不代表實際牌面。
            </p>
            {g.claims[uid] === undefined ? (
              <div className="claim-form">
                <label htmlFor="wire-claim">我宣稱有</label>
                <select
                  id="wire-claim"
                  value={Math.min(claim, 6 - g.round)}
                  onChange={(e) => setClaim(Number(e.target.value))}
                >
                  {Array.from({ length: 7 - g.round }, (_, n) => (
                    <option key={n} value={n}>
                      {n} 條解除引線
                    </option>
                  ))}
                </select>
                <button
                  className="primary"
                  disabled={disabled}
                  onClick={() =>
                    act({
                      type: "claim",
                      successes: Math.min(claim, 6 - g.round),
                    })
                  }
                >
                  送出宣言
                </button>
              </div>
            ) : (
              <p className="success-text">
                你宣稱有 {g.claims[uid]} 條解除引線。等待大家分享情報。
              </p>
            )}
            <button className="quiet" onClick={() => setShowPrivate(true)}>
              <Eye size={16} />
              查看本輪手牌組成
            </button>
          </>
        )}
        {g.phase === "CUT" && (
          <>
            <Scissors size={36} />
            <h2>
              {isCutter
                ? "剪刀在你手上。"
                : `${name(g.scissorsId)} 正在選擇引線`}
            </h2>
            <p className="muted">
              {g.forcedTarget
                ? `紅色炸彈指定：只能剪 ${name(g.forcedTarget)} 的牌${g.forcedTarget === g.scissorsId ? "（本次允許剪自己）" : ""}。`
                : "持有剪刀的人，選擇其他玩家的一張蓋牌。被剪的玩家會接過剪刀。"}
            </p>
          </>
        )}
        {(g.phase === "DEFUSE" || g.phase === "REARM") && (
          <>
            <h2>
              {g.phase === "DEFUSE"
                ? "把解除引線接到哪一種炸彈？"
                : "哪一種炸彈將失去保護？"}
            </h2>
            <p className="muted">
              {g.phase === "DEFUSE"
                ? "只能拆除已翻開、尚未受保護且非黃色的炸彈。"
                : "藍色裝置會移除一種炸彈的保護；達到爆炸張數時立即引爆。"}
            </p>
            {g.effectActor === uid ? (
              <div className="actions">
                {(g.phase === "DEFUSE"
                  ? defusableColors(g)
                  : rearmableColors(g)
                ).map((c) => (
                  <button
                    key={c}
                    className={`bomb-choice bomb-${c}`}
                    disabled={disabled}
                    onClick={() =>
                      act({
                        type: g.phase === "DEFUSE" ? "defuse" : "rearm",
                        color: c,
                      })
                    }
                  >
                    {COLOR_NAMES[c]} · {g.bombs[c] ?? 0} 張
                  </button>
                ))}
              </div>
            ) : (
              <p>等待 {name(g.effectActor!)} 選擇…</p>
            )}
          </>
        )}
        {g.phase === "CUT_RESULT" && last && (
          <>
            <p className="eyebrow">THE WIRE IS CUT</p>
            <div className="revealed-card">
              <WireCard wire={last.wire} />
            </div>
            <h2>{wireName(last.wire)}</h2>
            <p>
              {name(last.actor)} 剪開了 {name(last.target)} 的第 {last.slot + 1}{" "}
              張牌。
            </p>
            {last.note && <p className="success-text">{last.note}</p>}
            {g.forcedTarget && (
              <p className="forced-notice">
                紅色指定下一位目標：{name(g.forcedTarget)}
              </p>
            )}
            {room.hostId === uid ? (
              <button
                className="primary"
                disabled={disabled}
                onClick={() => act({ type: "bombContinue" })}
              >
                {g.cuts >= g.cutLimit ? "收回剩餘引線，進入下一輪" : "繼續剪線"}
              </button>
            ) : (
              <p className="muted">等待房主繼續…</p>
            )}
          </>
        )}
        {g.phase === "GAME_OVER" && (
          <>
            <div
              className={`end-art card-art ${g.winner === "good" ? "art-detective" : "art-london"}`}
            />
            <p className="eyebrow">THE FATE OF LONDON</p>
            <h2>
              {g.winner === "good"
                ? "夏洛克陣營獲勝"
                : g.winner === "evil"
                  ? "莫里亞蒂陣營獲勝"
                  : "本局中止"}
            </h2>
            <p className="muted">{g.winReason}</p>
            {last && <p>最後翻開：{wireName(last.wire)}</p>}
            <div className="role-results">
              {Object.entries(g.roles ?? {}).map(([id, r]) => (
                <div key={id}>
                  <span>{name(id)}</span>
                  <strong>
                    {r === "sherlock" ? "夏洛克陣營" : "莫里亞蒂陣營"}
                  </strong>
                </div>
              ))}
            </div>
            {room.hostId === uid && (
              <button
                className="primary"
                disabled={roomPending || !connected}
                onClick={onRematch}
              >
                再玩一局
              </button>
            )}
          </>
        )}
      </motion.section>
      {g.phase !== "ROLE_REVEAL" && g.phase !== "GAME_OVER" && (
        <div className="wire-players">
          {g.order.map((id) => {
            const targetAllowed =
              g.phase === "CUT" &&
              isCutter &&
              (g.forcedTarget ? id === g.forcedTarget : id !== uid);
            return (
              <section
                className={`wire-player panel ${g.scissorsId === id ? "has-scissors" : ""}`}
                key={id}
              >
                <header>
                  <strong>
                    {name(id)}
                    {id === uid ? "（你）" : ""}
                  </strong>
                  <span>
                    {g.scissorsId === id && <Scissors size={16} />}{" "}
                    {g.claims[id] !== undefined
                      ? `宣稱 ${g.claims[id]} 條解除`
                      : "尚未宣言"}
                  </span>
                </header>
                <div className="wire-hand">
                  {(g.hands[id] ?? []).map((slot) => (
                    <button
                      className="cut-card"
                      key={slot}
                      disabled={!targetAllowed || disabled}
                      aria-label={`剪開 ${name(id)} 的第 ${slot + 1} 張引線`}
                      onClick={() => act({ type: "cut", target: id, slot })}
                    >
                      <WireCard />
                      <span className="slot-number">{slot + 1}</span>
                    </button>
                  ))}
                  {!g.hands[id]?.length && (
                    <p className="fine">本輪沒有剩餘引線</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {g.phase !== "ROLE_REVEAL" && g.phase !== "GAME_OVER" && (
        <button className="quiet" onClick={() => setShowPrivate(true)}>
          <Eye size={16} />
          查看我的身份與引線
        </button>
      )}
      <details className="panel vote-history">
        <summary>剪線紀錄 · {g.history.length} 張</summary>
        <ol className="cut-history">
          {g.history.map((h, i) => (
            <li key={i}>
              <span>
                第 {h.round} 輪 · {name(h.actor)} → {name(h.target)}
              </span>
              <strong className={`wire-text-${h.wire}`}>
                {wireName(h.wire)}
              </strong>
              {h.note && <small>{h.note}</small>}
            </li>
          ))}
        </ol>
      </details>
      <details className="panel vote-history">
        <summary>{classic ? "原版規則" : "規則與顏色能力"}</summary>
        <p>
          {classic ? "4–8" : "4–6"} 人，每人初始 5
          張牌。每輪剪開與人數相同的張數後，剩餘牌全部重洗，依序發 4、3、2 張。
        </p>
        <p>
          找到全部 {g.order.length}{" "}
          條解除引線，夏洛克勝；炸彈引爆或第四輪時間耗盡，莫里亞蒂勝。四人局會從
          3 好人＋2 壞人的角色牌中抽走 1 張，不公開。
          {classic && "七人局則從 5 好人＋3 壞人抽走 1 張，不公開。"}
        </p>
        {classic ? (
          <p>
            牌庫只有 1 張炸彈、{g.order.length} 張解除引線及{" "}
            {4 * g.order.length - 1}{" "}
            張安全引線。安全引線無效果，炸彈一翻開就立即引爆。
          </p>
        ) : g.variant === "evolution" ? (
          g.colors.map((c) => (
            <p key={c}>
              <strong>{COLOR_NAMES[c]}：</strong>
              {BOMB_EFFECTS[c]}
            </p>
          ))
        ) : (
          <p>基礎規則：任一顏色翻開第 4 張就引爆，不啟用拆除保護或特殊能力。</p>
        )}
      </details>
      <AnimatePresence>
        {showPrivate && role && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <section
              className={`panel bomb-private ${role.role}`}
              role="dialog"
              aria-modal="true"
              aria-label="你的身份與引線"
            >
              <div
                className={`private-portrait card-art ${role.role === "sherlock" ? "art-detective" : "art-mastermind"}`}
              />
              <h2>
                {role.role === "sherlock" ? "夏洛克陣營" : "莫里亞蒂陣營"}
              </h2>
              <h3>第 {role.round} 輪 · 我的手牌</h3>
              <div className="private-hand" aria-label="剩餘手牌圖案">
                {Object.entries(role.inventory)
                  .filter(([, n]) => n)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .flatMap(([wire, n]) =>
                    Array.from({ length: n ?? 0 }, (_, i) => (
                      <WireCard key={`${wire}-${i}`} wire={wire as Wire} />
                    )),
                  )}
              </div>
              {!Object.values(role.inventory).some((n) => n) && (
                <p className="fine">本輪手牌已全部翻開</p>
              )}
              <p className="fine">圖案僅供辨識，不對應桌上蓋牌位置。</p>
              <button
                className="primary"
                disabled={disabled}
                onClick={() => {
                  if (g.phase === "ROLE_REVEAL" && !g.confirmed[uid])
                    act({ type: "bombReveal" });
                  setShowPrivate(false);
                }}
              >
                收起情報{g.phase === "ROLE_REVEAL" ? "，確認準備" : ""}
              </button>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
