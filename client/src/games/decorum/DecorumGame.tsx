import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { House, Heart, Paintbrush, Plus, Check, X, Smile, Meh, Frown, BookOpen, Users, Sparkles, ArrowRight, BedDouble, Bath, Sofa, CookingPot, ArrowLeftRight } from "lucide-react";
import type { Room } from "../../../../functions/src/shared/model";
import { COLOR_LABELS, DECORUM_SCENARIOS, OBJECT_LABELS, OBJECT_TYPES, REACTION_LABELS, ROOM_LABELS, decorumToken, objectLabel } from "../../../../functions/src/shared/decorum";
import type { DecorumPrivate, DecorumAction, HouseAction, ReactionType } from "../../../../functions/src/shared/decorum";
import { evaluatePlayerConditions, evaluateCondition } from "../../../../functions/src/shared/decorum-conditions";
import { decorumAction } from "../../firebase/api";
import { useAction } from "../../hooks/useAction";
import { PlayerIdentity } from "../../components/PlayerIdentity";
import { GameDialog } from "../../components/GameDialog";
import { FurnitureArt } from "./DecorArt";
import { paintColors } from "./constants";
import { RoomActionSheet, type RoomSheetMode } from "./RoomActionSheet";
import "./decorum.css";

const reactionIcons = { positive: Smile, neutral: Meh, negative: Frown };
const roomIcons = { livingRoom: Sofa, bedroom: BedDouble, bedroom2: BedDouble, bathroom: Bath, kitchen: CookingPot };
function actionText(action: HouseAction, room: Room) {
  const g = room.decorum!;
  const place = "roomId" in action ? ROOM_LABELS[g.house.rooms.find((r) => r.id === action.roomId)!.type] : "";
  switch (action.type) {
    case "decorPaint": return `把${place}刷成${COLOR_LABELS[action.color]}`;
    case "decorAdd": return `在${place}加入一件物品`;
    case "decorSwap": return `替換了${place}的物品`;
    case "decorRemove": return `移除了${place}的${OBJECT_LABELS[action.objectType]}`;
    case "decorPass": return "滿意地略過這個回合";
    case "decorRoommate": return `搬進了${place}`;
  }
}
export function DecorumGame({ room, privateData, uid, connected, onRematch, roomPending }: {
  room: Room; privateData: DecorumPrivate | null; uid: string; connected: boolean; onRematch: () => void; roomPending: boolean;
}) {
  const g = room.decorum!;
  const own = privateData?.gameId === g.id ? privateData : null;
  const { pending, error, run } = useAction();
  const disabled = pending || !connected;
  const [showPrivate, setShowPrivate] = useState(false);
  const [selected, setSelected] = useState<{ id: string; mode: RoomSheetMode; token: string } | null>(null);
  const [dismissedMeeting, setDismissedMeeting] = useState("");
  const [dismissedResult, setDismissedResult] = useState("");
  const [shareId, setShareId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<ReactionType>("neutral");
  const token = decorumToken(g);
  const scenario = DECORUM_SCENARIOS.find((s) => s.id === g.scenarioId)!;
  const currentId = g.playerOrder[g.currentPlayerIndex];
  const active = currentId === uid && g.phase === "PLAYER_ACTION";
  const meeting = g.phase === "HEART_TO_HEART" || g.phase === "HOUSE_MEETING";
  const needsShare = meeting && !g.meetingSubmitted[uid];
  const ended = g.phase === "GAME_OVER";
  const needsReaction = g.phase === "REACTION" && currentId !== uid && !g.reactions[uid];
  const name = (id: string) => room.players[id]?.nickname ?? "已離開的室友";
  const identity = (id: string) => <PlayerIdentity name={name(id)} index={g.playerOrder.indexOf(id)} suffix={id === uid ? " · 你" : ""} />;
  const act = (action: DecorumAction, after?: () => void) => void run(async () => { await decorumAction(room.code, g, action); after?.(); });
  const myStatus = own ? evaluatePlayerConditions(own.conditions, g.house, { ownerId: uid }) : null;
  const shareable = own?.conditions.filter((c) => g.phase !== "HEART_TO_HEART" || !own.sharedConditionIds.includes(c.id) || own.sharedConditionIds.length === own.conditions.length) ?? [];
  const selectedCondition = shareable.find((c) => c.id === shareId) ?? shareable[0];
  const recipientId = g.playerOrder.includes(recipient) && recipient !== uid ? recipient : g.playerOrder.find((id) => id !== uid)!;
  const selectedRoom = selected?.token === token && active ? g.house.rooms.find((r) => r.id === selected.id) : null;
  const openRoom = (id: string, mode: RoomSheetMode) => setSelected({ id, mode, token });
  return <div className="decorum-game">
    <header className="decor-intro"><div><p className="eyebrow">A HOME FOR ALL · 原創劇本</p><h2>{scenario.name}</h2><p>{scenario.description}</p></div><House size={42} strokeWidth={1.2} /></header>
    <div className="decor-metrics">
      <div><BookOpen size={18} /><span>共同生活<strong>第 {g.round} <small>/ {g.maxRounds} 輪</small></strong></span></div>
      <div><Heart size={18} /><span>{g.playerOrder.length === 2 ? "談心機會" : "房屋會議"}<strong>{g.heartsRemaining} <small>次剩餘</small></strong></span></div>
      <div><Smile size={18} /><span>滿意的室友<motion.strong key={Object.values(g.playerFulfilled).filter(Boolean).length} initial={{ scale: .9 }} animate={{ scale: 1 }}>{Object.values(g.playerFulfilled).filter(Boolean).length} <small>/ {g.playerOrder.length} 位</small></motion.strong></span></div>
    </div>
    <div className="decor-roommates" aria-label="室友狀態">{g.playerOrder.map((id) => {
      const reaction = g.reactions[id] ?? g.lastReactions[id]; const Icon = reaction ? reactionIcons[reaction] : null;
      return <div key={id} className={`decor-roommate ${id === currentId && !ended ? "current" : ""}`}>
        {identity(id)}<span className={`decor-satisfied ${g.playerFulfilled[id] ? "yes" : ""}`}>{g.playerFulfilled[id] ? <Check size={13} /> : <Meh size={13} />}{g.playerFulfilled[id] ? "滿意" : "還想調整"}</span>
        <AnimatePresence mode="wait">{Icon && <motion.span key={`${g.turn}:${reaction}`} className={`reaction-bubble ${reaction}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><Icon size={14} />{REACTION_LABELS[reaction!]}</motion.span>}</AnimatePresence>
      </div>;
    })}</div>
    <section className="decor-turn" aria-live="polite">
      {g.phase === "SETUP" ? <><h3>搬進來之前，先讀懂自己的心願。</h3><p>每個人都有秘密。先查看自己的條件，再確認準備。</p><small>{Object.keys(g.confirmed).length} / {g.playerOrder.length} 位已確認</small></>
        : ended ? <><h3><Sparkles size={21} />{g.winner === "players" ? "終於，這是我們都喜歡的家。" : g.endReason === "player-left" ? "室友已離席，本次合租中止。" : "時間到了，留一點遺憾給下一次。"}</h3><p>{g.fulfilledConditionCount} / {g.totalConditionCount} 項心願完成 · {g.score} 分</p></>
        : meeting ? <><h3><Heart size={20} />{g.phase === "HEART_TO_HEART" ? "留一點時間，聽聽彼此。" : "大家坐下來，聊聊這個家。"}</h3><p>{Object.keys(g.meetingSubmitted).length} / {g.playerOrder.length} 位已分享 · 所有人完成後進入第 {g.round + 1} 輪</p></>
        : g.phase === "REACTION" ? <><h3>{needsReaction ? "這次改變，你覺得如何？" : "等室友給一個小小回應。"}</h3><p>{g.latestAction && <>{name(g.latestAction.actorId)} {actionText(g.latestAction.action, room)}</>}</p>{needsReaction ? <div className="decor-reactions">{(Object.keys(REACTION_LABELS) as ReactionType[]).map((r) => { const Icon = reactionIcons[r]; return <button key={r} className={r} disabled={disabled} onClick={() => act({ type: "decorReact", reaction: r })}><Icon size={22} />{REACTION_LABELS[r]}</button>; })}</div> : <small>{Object.keys(g.reactions).length} / {g.playerOrder.length - 1} 位已回應</small>}</>
        : <><h3><Paintbrush size={20} />{active ? "輪到你，做一個小小的改變。" : <>{identity(currentId)} 正在佈置</>}</h3><p>{active ? "點房間或物品位置 → 挑選 → 預覽確認" : "看看這次改變，再用喜歡、沒意見或不喜歡回應。"}</p></>}
    </section>
    {error && !showPrivate && !selectedRoom && <p className="error" role="alert">{error}</p>}
    <section className="decor-house" aria-label="共享房屋平面圖">{g.house.rooms.map((r) => {
      const RoomIcon = roomIcons[r.type];
      return <section className={`decor-room ${active ? "editable" : ""}`} key={r.id} style={{ gridColumn: r.column + 1, gridRow: r.row + 1, "--wall-color": paintColors[r.wallColor] } as CSSProperties} aria-label={`${ROOM_LABELS[r.type]}・${COLOR_LABELS[r.wallColor]}牆面`}>
        <motion.div className="decor-wall" animate={{ backgroundColor: paintColors[r.wallColor] }} transition={{ duration: .4 }} />
        <header><button disabled={disabled || !active} aria-label={`佈置${ROOM_LABELS[r.type]}`} onClick={() => openRoom(r.id, "paint")}><RoomIcon size={17} /><strong>{ROOM_LABELS[r.type]}</strong></button><button className="wall-paint-button" disabled={disabled || !active} aria-label={`粉刷${ROOM_LABELS[r.type]}`} onClick={() => openRoom(r.id, "paint")}><Paintbrush size={14} /><span>{COLOR_LABELS[r.wallColor]}</span></button></header>
        <div className="decor-slots">{OBJECT_TYPES.map((type) => <button className={`decor-slot ${r.objects[type] ? "occupied" : "empty"}`} key={type} disabled={disabled || !active} aria-label={`佈置${ROOM_LABELS[r.type]}的${OBJECT_LABELS[type]}`} onClick={() => openRoom(r.id, type)}>
          <AnimatePresence mode="wait"><motion.span className="decor-slot-art" key={r.objects[type]?.id ?? "empty"} initial={{ opacity: 0, scale: .7, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .75, y: 8 }} transition={{ duration: .22 }}>{r.objects[type] ? <FurnitureArt object={r.objects[type]!} /> : <Plus size={24} strokeWidth={1} />}</motion.span></AnimatePresence>
          <span>{OBJECT_LABELS[type]}</span><small>{r.objects[type] ? objectLabel(r.objects[type]!).replace(OBJECT_LABELS[type], "") : "空位"}</small>
        </button>)}</div>
        {g.enableRoommateTokens && (r.type === "bedroom" || r.type === "bedroom2") && <div className="bedroom-residents"><span><BedDouble size={13} />{Object.entries(g.house.roommates).filter(([, id]) => id === r.id).map(([id]) => name(id)).join("、")} · {r.capacity} 人房</span>{active && g.house.roommates[uid] !== r.id && <button aria-label={`搬到${ROOM_LABELS[r.type]}`} disabled={disabled} onClick={() => openRoom(r.id, "roommate")}><ArrowLeftRight size={14} />換房</button>}</div>}
      </section>;
    })}</section>
    <div className="decor-dock">
      <button className="primary" disabled={!own} onClick={() => setShowPrivate(true)}><BookOpen size={18} />我的秘密心願{myStatus && <small>{myStatus.results.filter((r) => r.fulfilled).length} / {myStatus.results.length}</small>}</button>
      {active && <button disabled={disabled || !myStatus?.fulfilled} onClick={() => act({ type: "decorPass" })}><Check size={17} />滿意，略過</button>}
      {needsShare && <button onClick={() => { setShowPrivate(false); setDismissedMeeting(""); }}><Heart size={17} />進入{g.phase === "HEART_TO_HEART" ? "談心" : "會議"}</button>}
      {ended && <button onClick={() => setDismissedResult("")}>查看合租成果</button>}
    </div>
    {active && !myStatus?.fulfilled && <p className="decor-help">只有所有個人心願都滿足時，才可以略過回合。</p>}
    {g.latestAction && g.phase !== "REACTION" && <p className="decor-last-action"><Paintbrush size={14} />上一步：{name(g.latestAction.actorId)} {actionText(g.latestAction.action, room)}</p>}
    <details className="decor-rules"><summary>合租指南與溝通約定</summary><p>每位室友輪流做一件事：新增、移除或替換同類物品，或粉刷一間房間。滿意時才可略過。物品目錄可重複使用，牆面沒有風格。</p><p>其他室友各給一次「喜歡／沒意見／不喜歡」，全部回應後換人。感受由你決定，不必與滿意狀態相同。不能直接說出自己的秘密條件，也沒有自由文字聊天。</p><p>雙人於第 15、20、25 輪結束後談心，各分享一項新條件。三／四人於第 5、10、15、20、25 輪結束後開會，各選一項條件與一位收件人；新分享取代你的前次分享，舊收件人將失去該條件的介面存取。已看過的資訊無法從記憶中消除。</p><p>所有人同時滿意，立即共同獲勝；第 30 輪用盡則失敗。有室友離線時可等待重連；明確離開或被清理會中止本局。四人劇本可搬到另一間臥室，滿房時與指定室友交換。</p><p>這些劇本與插畫為本平台原創示範內容。</p></details>
    {showPrivate && own && <GameDialog title="我的秘密心願" onClose={() => setShowPrivate(false)} className="decorum-dialog decorum-drawer">
      <p className="eyebrow">JUST BETWEEN YOU & YOUR HOME</p><h2>理想的家，是這個樣子。</h2><p className="decor-help">只屬於你的心願。一般回合請用三種感受回應，不要直接透露內容。</p>
      <ul className="condition-list">{own.conditions.map((c) => { const fulfilled = evaluateCondition(c, g.house, { ownerId: uid }); return <motion.li layout key={c.id} className={fulfilled ? "fulfilled" : ""}><span className="condition-mark">{fulfilled ? <Check size={18} /> : <X size={18} />}</span><span>{c.description}<small>{fulfilled ? "已滿足" : "還想調整"}{own.sharedConditionIds.includes(c.id) && " · 已分享"}</small></span></motion.li>; })}</ul>
      <h3><Users size={18} />室友交給你的心願</h3>{own.sharedConditionsReceived.length ? <ul className="condition-list shared">{own.sharedConditionsReceived.map(({ ownerId, condition }) => <li key={`${ownerId}:${condition.id}`}><BookOpen size={18} /><span>{condition.description}<small>來自 {name(ownerId)}</small></span></li>)}</ul> : <p className="decor-help">目前尚未收到分享。會議時間到了，再慢慢了解彼此。</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary decor-confirm" disabled={disabled} onClick={() => g.phase === "SETUP" && !g.confirmed[uid] ? act({ type: "decorReady" }, () => setShowPrivate(false)) : setShowPrivate(false)}>{g.phase === "SETUP" && !g.confirmed[uid] ? "讀完了，準備入住" : "收起心願"}</button>
    </GameDialog>}
    {selectedRoom && selected && !showPrivate && <RoomActionSheet key={`${token}:${selected.id}:${selected.mode}`} room={selectedRoom} game={g} uid={uid} initialMode={selected.mode} name={name} disabled={disabled || !active} error={error} onClose={() => setSelected(null)} onConfirm={(action) => act(action, () => setSelected(null))} />}
    {needsShare && !showPrivate && dismissedMeeting !== token && own && <GameDialog key={token} title={g.phase === "HEART_TO_HEART" ? "室友談心" : "房屋會議"} onClose={() => setDismissedMeeting(token)} className="decorum-dialog decorum-meeting">
      <motion.div className="meeting-heart" initial={{ scale: .6 }} animate={{ scale: 1 }}><Heart size={40} strokeWidth={1.2} /></motion.div><p className="eyebrow">A LITTLE CLOSER</p><h2>分享一件你在意的小事。</h2><p>{g.phase === "HEART_TO_HEART" ? "彼此各分享一項新心願，之後就能持續查看。" : "選一項心願，交給一位室友。這次分享會取代你前次分享。"}</p>
      <label htmlFor="meeting-status">我對這個家的整體感受</label><select id="meeting-status" value={status} onChange={(e) => setStatus(e.target.value as ReactionType)}>{(Object.keys(REACTION_LABELS) as ReactionType[]).map((r) => <option value={r} key={r}>{REACTION_LABELS[r]}</option>)}</select>
      <label htmlFor="shared-condition">這次想分享的心願</label><select id="shared-condition" value={selectedCondition?.id ?? ""} onChange={(e) => setShareId(e.target.value)}>{shareable.map((c) => <option key={c.id} value={c.id}>{c.description}</option>)}</select>
      <label htmlFor="share-recipient">只分享給這位室友</label><select id="share-recipient" value={recipientId} onChange={(e) => setRecipient(e.target.value)}>{g.playerOrder.filter((id) => id !== uid).map((id) => <option key={id} value={id}>{name(id)}</option>)}</select>
      <p className="decor-help">所有室友分享完成後，消耗一次機會並繼續。收件人不需要回送給你。</p>{error && <p className="error" role="alert">{error}</p>}
      <button className="primary decor-confirm" disabled={disabled || !selectedCondition} onClick={() => selectedCondition && act({ type: "decorShare", conditionId: selectedCondition.id, recipientId, status })}>交給 {name(recipientId)}<ArrowRight size={17} /></button>
    </GameDialog>}
    {ended && !showPrivate && dismissedResult !== g.id && <GameDialog title="合租成果" onClose={() => setDismissedResult(g.id)} className="decorum-dialog decorum-result">
      <motion.div className="decor-result-icon" initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }}><House size={62} strokeWidth={1} /><Sparkles size={24} /></motion.div><p className="eyebrow">OUR HOME, OUR STORY</p><h2>{g.winner === "players" ? "我們，都喜歡這個家。" : g.endReason === "player-left" ? "這次合租暫告一段落。" : "差一點，就是理想的家。"}</h2><p>{g.winner === "players" ? "所有人的心願同時實現，合作成功！" : g.endReason === "player-left" ? "有室友離席，本局中止；可以重新邀朋友開局。" : "30 輪已用完，下次再一起找找新的可能。"}</p><div className="decor-result-stats"><span><strong>{g.round}</strong>輪共同生活</span><span><strong>{g.fulfilledConditionCount} / {g.totalConditionCount}</strong>心願完成</span><span><strong>{g.score}</strong>合租分數</span></div>
      {g.playerOrder.map((id) => <section key={id} className="revealed-wishes"><h3>{identity(id)}</h3><ul className="condition-list">{(g.revealedConditions?.[id] ?? []).map((c) => { const fulfilled = evaluateCondition(c, g.house, { ownerId: id }); return <li key={c.id} className={fulfilled ? "fulfilled" : ""}>{fulfilled ? <Check size={16} /> : <X size={16} />}<span>{c.description}</span></li>; })}</ul></section>)}
      <button className="primary decor-confirm" onClick={() => setDismissedResult(g.id)}>看看最後的家</button>{room.hostId === uid && <button className="decor-confirm" disabled={roomPending || !connected} onClick={onRematch}>再合租一次</button>}
    </GameDialog>}
    {ended && room.hostId === uid && <button className="primary decor-rematch" disabled={roomPending || !connected} onClick={onRematch}>再合租一次</button>}
  </div>;
}
