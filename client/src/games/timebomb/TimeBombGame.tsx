import { useState } from "react";
import { PlayerIdentity } from "../../components/PlayerIdentity";
import { GameDialog } from "../../components/GameDialog";
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
  Layers3,
  MessageCircle,
  ArrowRight,
  Bot,
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
export function TimeBombGame({ room, role, uid, connected, onRematch, roomPending }: {
  room: Room; role: BombPrivate | null; uid: string; connected: boolean;
  onRematch: () => void; roomPending: boolean;
}) {
  const g = room.timebomb!;
  const classic = g.variant === "classic";
  const [showPrivate, setShowPrivate] = useState(false);
  const [claim, setClaim] = useState(0);
  const [dismissed, setDismissed] = useState("");
  const { pending, error, run } = useAction();
  const disabled = pending || !connected;
  const act = (action: BombAction) => void run(() => bombAction(room.code, g, action));
  const name = (id: string) => room.players[id]?.nickname ?? "已離開的玩家";
  const identity = (id: string) => <PlayerIdentity name={name(id)} index={g.order.indexOf(id)} suffix={id === uid ? " · 你" : ""} />;
  const last = g.history.at(-1);
  const isCutter = g.scissorsId === uid;
  const token = `${g.id}:${g.round}:${g.phase}:${g.cuts}`;
  const needsClaim = g.phase === "CLAIMS" && g.claims[uid] === undefined;
  const needsEffect = (g.phase === "DEFUSE" || g.phase === "REARM") && g.effectActor === uid;
  const result = g.phase === "CUT_RESULT";
  const showAction = (needsClaim || needsEffect || result) && dismissed !== token && !showPrivate;
  const labels = { ROLE_REVEAL: "身份與引線", CLAIMS: "交換情報", CUT: "剪斷一條引線", DEFUSE: "選擇拆除的炸彈", REARM: "藍色炸彈：移除保護", CUT_RESULT: "剪線結果", GAME_OVER: "倫敦的命運" };
  const targetAllowed = (id: string) => g.phase === "CUT" && isCutter && (g.forcedTarget ? id === g.forcedTarget : id !== uid);
  const privateCards = role && <div className="private-hand" aria-label="剩餘手牌圖案">{Object.entries(role.inventory).filter(([, n]) => n).sort(([a], [b]) => a.localeCompare(b)).flatMap(([wire, n]) => Array.from({ length: n ?? 0 }, (_, i) => <WireCard key={`${wire}-${i}`} wire={wire as Wire} />))}</div>;
  return <div className="timebomb-table">
    <div className="game-core bomb-core">
      <div className="bomb-score" aria-label="回合與拆彈進度">
        {[{ label: "目前回合", value: g.round, total: 4, unit: "輪", Icon: Clock3 },
          { label: "本輪已剪", value: g.cuts, total: g.cutLimit, unit: "張", Icon: Scissors },
          { label: "已解除引線", value: g.successes, total: g.order.length, unit: "根", Icon: ShieldCheck }].map(({ label, value, total, unit, Icon }) => <div className="bomb-stat" key={label}>
          <div className="bomb-stat-label"><Icon size={20} /><span>{label}</span></div>
          <strong>{value}<small> / {total} {unit}</small></strong>
          <div className="stat-segments" aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} className={i < value ? "filled" : ""} />)}</div>
        </div>)}
      </div>
      {!classic && <div className="bomb-track" aria-label="各色炸彈進度">{g.colors.map((c) => <div key={c} className={`bomb-meter bomb-${c} ${g.defused[c] ? "defused" : ""}`} aria-label={`${COLOR_NAMES[c]} ${g.bombs[c] ?? 0} / ${bombThreshold(g, c)}${g.defused[c] ? "，已保護" : ""}`}>
        <span>{COLOR_NAMES[c]}{g.defused[c] && <ShieldCheck size={12} />}</span><strong>{g.bombs[c] ?? 0}<small> / {bombThreshold(g, c)}</small></strong>
        <span className="meter-dots">{Array.from({ length: bombThreshold(g, c) }, (_, i) => <i key={i} className={i < (g.bombs[c] ?? 0) ? "filled" : ""} />)}</span>
      </div>)}</div>}
      <div className="game-phase-heading"><h2>{labels[g.phase]}</h2><span className="tag">{classic ? "原版" : "危機進化"}</span></div>
      {error && !showAction && !showPrivate && <p className="error" role="alert">{error}</p>}
      <section className={`panel bomb-stage ${g.phase === "GAME_OVER" ? "bomb-stage-feature" : ""}`}>
        {g.phase === "ROLE_REVEAL" && <><Scissors className="gold" size={28} /><p className="eyebrow">LONDON · 1890</p><h2>倫敦的命運，在你手中。</h2><p className="muted">引線已發到桌上，開啟身份視窗查看你的秘密情報。</p><small>{Object.keys(g.confirmed).length} / {g.order.length} 已確認</small></>}
        {g.phase === "CLAIMS" && <><h3>{needsClaim ? "這一輪，你打算怎麼說？" : `你宣稱有 ${g.claims[uid]} 條解除引線`}</h3><p>宣言可能是虛張聲勢 · {Object.keys(g.claims).length} / {g.order.length} 已分享</p></>}
        {g.phase === "CUT" && <><h3><Scissors size={17} />{isCutter ? "剪刀在你手上。" : <>{identity(g.scissorsId)} 正在選擇引線</>}</h3><p>{g.forcedTarget ? <>指定目標：{identity(g.forcedTarget)}{g.forcedTarget === uid && "（本次可剪自己）"}</> : isCutter ? "直接點選其他玩家的一張蓋牌剪開" : "金框標示目前的剪刀持有者"}</p></>}
        {(g.phase === "DEFUSE" || g.phase === "REARM") && <><h3>{needsEffect ? "輪到你選擇顏色" : <>等待 {identity(g.effectActor!)} 選擇</>}</h3><p>{g.phase === "DEFUSE" ? "解除引線已找到，選擇保護的炸彈" : "藍色裝置將移除一種保護"}</p></>}
        {result && last && <><h3>{wireName(last.wire)}</h3><div className="identity-list">{identity(last.actor)}<ArrowRight size={16} />{identity(last.target)}<span>第 {last.slot + 1} 張</span></div></>}
        {g.phase === "GAME_OVER" && <><div className={`end-art card-art ${g.winner === "good" ? "art-detective" : "art-london"}`} /><h2>{g.winner === "good" ? "夏洛克陣營獲勝" : g.winner === "evil" ? "莫里亞蒂陣營獲勝" : "本局中止"}</h2><p>{g.winReason}</p><div className="role-results">{Object.entries(g.roles ?? {}).map(([id, r]) => <div key={id}>{identity(id)}<strong>{r === "sherlock" ? "夏洛克陣營" : "莫里亞蒂陣營"}</strong></div>)}</div></>}
      </section>
      <div className="game-dock">
        {g.phase !== "GAME_OVER" && <button className="quiet" disabled={!role} onClick={() => setShowPrivate(true)}><Eye size={17} />{g.phase === "ROLE_REVEAL" ? "查看身份與引線" : "我的身份與引線"}</button>}
        {(needsClaim || needsEffect || result) && <button className="primary" onClick={() => setDismissed("")}>{needsClaim ? "發表宣言" : needsEffect ? "選擇顏色" : "查看剪線結果"}</button>}
        {g.phase === "GAME_OVER" && room.hostId === uid && <button className="primary" disabled={roomPending || !connected} onClick={onRematch}>再玩一局</button>}
      </div>
      {g.phase !== "GAME_OVER" && <div className="wire-players" aria-label="所有玩家與引線">{g.order.map((id) => <section key={id} className={`wire-player panel ${g.scissorsId === id ? "has-scissors" : ""} ${targetAllowed(id) ? "can-cut" : ""}`} aria-label={`${name(id)} 的引線`}>
        <header className="wire-player-top"><strong>{identity(id)}</strong><span>{g.scissorsId === id && <span className="scissors-badge"><Scissors size={14} />剪刀</span>}{room.players[id]?.isBot && <small><Bot size={12} />{room.players[id]?.isProxy ? "AI 接手" : "AI"}</small>}</span></header>
        <div className="wire-player-meta"><span><MessageCircle size={14} />宣稱 {g.claims[id] ?? "?"} 根解除引線</span><span><Layers3 size={14} />剩 {g.hands[id]?.length ?? 0} 張</span></div>
        <div className="wire-hand">{(g.hands[id] ?? []).map((slot) => <button className="cut-card" key={slot} disabled={disabled || !targetAllowed(id)} aria-label={`剪開 ${name(id)} 的第 ${slot + 1} 張引線`} onClick={() => act({ type: "cut", target: id, slot })}>
          <WireCard /><span className="slot-number">{targetAllowed(id) && <Scissors size={12} />}第 {slot + 1} 張</span>
        </button>)}{!g.hands[id]?.length && <p className="empty-hand"><Check size={18} />本輪引線已全部翻開</p>}</div>
        {targetAllowed(id) && !!g.hands[id]?.length && <p className="cut-hint"><Scissors size={13} />點選一張蓋牌剪開</p>}
      </section>)}</div>}

    </div>
    <div className="game-extras">
      <details className="panel vote-history"><summary>剪線紀錄 · {g.history.length} 張</summary><ol className="cut-history">{g.history.map((h, i) => <li key={i}><div className="identity-list"><span>第 {h.round} 輪</span>{identity(h.actor)}<ArrowRight size={14} />{identity(h.target)}</div><strong className={`wire-text-${h.wire}`}>{wireName(h.wire)}</strong>{h.note && <small>{h.note}</small>}</li>)}</ol></details>
      <details className="panel vote-history"><summary>{classic ? "原版規則與卡牌" : "規則與顏色能力"}</summary>
        {classic && <div className="classic-wire-guide">{(["safe", "success", "bomb"] as const).map((w) => <div key={w}><WireCard wire={w} small /><span>{w === "safe" ? "平安無事" : w === "success" ? `集滿 ${g.order.length} 張` : "翻開即引爆"}</span></div>)}</div>}
        <p>{classic ? "4–8" : "4–6"} 人，每人初始 5 張牌。每輪剪開與人數相同的張數後，剩餘牌重洗，依序發 4、3、2 張。手牌組成不代表蓋牌位置。</p>
        <p>集滿 {g.order.length} 條解除引線，夏洛克勝；炸彈引爆或第四輪時間耗盡，莫里亞蒂勝。四人局從 3 好人＋2 壞人中抽走 1 張不公開。{classic && "七人局從 5 好人＋3 壞人抽走 1 張不公開。"}</p>
        {classic ? <p>牌庫：1 張炸彈、{g.order.length} 張解除引線、{4 * g.order.length - 1} 張安全引線。炸彈一翻開即引爆。</p> : g.variant === "evolution" ? g.colors.map((c) => <p key={c}><strong>{COLOR_NAMES[c]}：</strong>{BOMB_EFFECTS[c]}</p>) : <p>舊基礎規則：任一顏色翻開第 4 張即引爆，不啟用特殊能力。</p>}
      </details>
    </div>
    {showAction && <GameDialog key={token} title={labels[g.phase]} onClose={() => setDismissed(token)} className="bomb-action-dialog timebomb-table">
      {needsClaim && <><p className="eyebrow">TRUTH OR BLUFF?</p><h2>這一輪，你打算怎麼說？</h2>{privateCards}<p className="fine">你的真實手牌組成 · 圖案不對應蓋牌位置</p><div className="claim-form"><label htmlFor="wire-claim">我宣稱有</label><select id="wire-claim" value={Math.min(claim, 6 - g.round)} onChange={(e) => setClaim(Number(e.target.value))}>{Array.from({ length: 7 - g.round }, (_, n) => <option key={n} value={n}>{n} 條解除引線</option>)}</select><button className="primary" disabled={disabled} onClick={() => act({ type: "claim", successes: Math.min(claim, 6 - g.round) })}>送出宣言</button></div><p className="fine">可以說真話，也可以虛張聲勢。</p></>}
      {needsEffect && <><h2>{g.phase === "DEFUSE" ? "保護哪一種炸彈？" : "移除哪一種保護？"}</h2><div className="effect-choices">{(g.phase === "DEFUSE" ? defusableColors(g) : rearmableColors(g)).map((c) => <button key={c} className={`bomb-choice bomb-${c}`} disabled={disabled} onClick={() => act({ type: g.phase === "DEFUSE" ? "defuse" : "rearm", color: c })}><WireCard wire={c} /><strong>{COLOR_NAMES[c]}</strong><small>{g.bombs[c] ?? 0} / {bombThreshold(g, c)}</small></button>)}</div><p className="fine">{g.phase === "DEFUSE" ? "只能拆除已翻開、尚未保護且非黃色的炸彈。" : "移除保護後若達到爆炸張數，立即引爆。"}</p></>}
      {result && last && <><div className="revealed-card"><WireCard wire={last.wire} /></div><h2>{wireName(last.wire)}</h2><div className="identity-list">{identity(last.actor)}<Scissors size={18} />{identity(last.target)}</div><p>剪開第 {last.slot + 1} 張牌</p>{last.note && <p className="success-text">{last.note}</p>}{g.forcedTarget && <p className="forced-notice">下一位指定目標：{identity(g.forcedTarget)}</p>}{room.hostId === uid ? <button className="primary" disabled={disabled} onClick={() => act({ type: "bombContinue" })}>{g.cuts >= g.cutLimit ? "收回剩餘引線，進入下一輪" : "繼續剪線"}</button> : <p className="fine">等待房主繼續…</p>}</>}
      {error && <p className="error" role="alert">{error}</p>}
    </GameDialog>}
    {showPrivate && role && <GameDialog title="你的身份與引線" onClose={() => setShowPrivate(false)} className={`bomb-private timebomb-table ${role.role}`}>
      <div className={`private-portrait card-art ${role.role === "sherlock" ? "art-detective" : "art-mastermind"}`} /><h2>{role.role === "sherlock" ? "夏洛克陣營" : "莫里亞蒂陣營"}</h2><h3>第 {role.round} 輪 · 我的手牌</h3>{privateCards}
      {!Object.values(role.inventory).some((n) => n) && <p className="fine">本輪手牌已全部翻開</p>}<p className="fine">圖案僅供辨識，不對應桌上蓋牌位置。</p>{error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={disabled} onClick={() => void run(async () => { if (g.phase === "ROLE_REVEAL" && !g.confirmed[uid]) await bombAction(room.code, g, { type: "bombReveal" }); setShowPrivate(false); })}>收起情報{g.phase === "ROLE_REVEAL" ? "，確認準備" : ""}</button>
    </GameDialog>}
  </div>;
}
