# 犯人在跳舞 — Post-Implementation Addendum

目前 Codex 回報已完成：
- 3–8 人多人遊戲
- 2–7 位 AI 練習
- 完整基礎卡牌規則與少年選配
- 手機／電腦介面、實體卡風格 UI、卡牌放大與操作彈窗
- 約 3.2 秒行動動畫
- 秘密傳牌、勝利揭曉、多輪計分
- 412 項單元測試、服務整合、4 項瀏覽器測試、Lint、Build 通過
- 尚未正式部署
- 警部尚未開放

---

## 1. 接下來優先順序

```text
P1 警部規則補完
P2 AI 防作弊 / 隱藏資訊稽核
P3 Firebase 私密資料安全稽核
P4 Browser Acceptance Matrix
P5 動畫速度 UX
P6 Production 部署
P7 正式站 Smoke Test
```

---

## 2. 警部（Police Chief）數位規則

### 啟用方式

```ts
policeChiefEnabled: boolean;
```

預設：

```text
false
```

建議啟用時：

```text
警部取代神犬
```

少年則仍可獨立作為目擊者替換選配。

### 持有警部是公開資訊

警部在玩家手中時，其他人應該知道誰持有警部。

但只能公開：

```text
Kevin
手牌 3
[警部持有中]
```

不可公開該玩家其他手牌。

如果警部經由：

```text
交易
情報交換
謠言
```

移到其他玩家手中，公開持有人標示也必須同步移動。

### 出牌限制

```ts
canPlayPoliceChief(handSizeBeforePlay: number): boolean {
  return handSizeBeforePlay <= 3;
}
```

出牌後：

```text
1. 選擇一名非自己的玩家
2. 警部牌正面放在該玩家面前
3. 記錄 policeChiefOwnerUid
4. 記錄 policeChiefTargetUid
5. 遊戲繼續
```

警部不會立刻驗證犯人。

### 終局才判定

犯人牌可能在警部放置後繼續移動。

例：

```text
警部指定 Amy
Amy 當下有犯人

之後交易：
Amy → Jack 傳走犯人

回合結束時 Jack 是犯人

=> 警部失敗
```

反之：

```text
警部指定 Amy
Amy 當下不是犯人

之後謠言把犯人移到 Amy

回合結束時 Amy 是犯人

=> 警部成功
```

因此不可在警部出牌當下判定。

---

## 3. 終局犯人快照

在任何回合結束事件發生時，在清理手牌前保存：

```ts
interface CriminalDanceTerminalSnapshot {
  finalCriminalUid: string;
  finalCriminalHadAlibi: boolean;

  endReason:
    | 'DETECTIVE_CAUGHT'
    | 'DOG_CAUGHT'
    | 'CRIMINAL_ESCAPED';

  detectiveUid?: string;
  dogUid?: string;
}
```

警部結算必須依賴這個終局快照，不可在手牌已被移動／清理後重新判斷。

---

## 4. 警部 + 不在場證明

公開中文規則來源的文字略有差異，但多個規則整理明確描述：

```text
不在場證明可對偵探／警部生效
```

因此本專案建議採 deterministic digital contract：

```text
若警部鎖定的玩家是終局犯人，
但終局犯人仍有不在場證明，
警部不算成功抓到犯人。
```

程式：

```ts
const policeChiefSucceeded =
  policeChiefTargetUid === terminal.finalCriminalUid &&
  !terminal.finalCriminalHadAlibi;
```

如果未來拿到官方擴充說明書，且規則不同，請一起更新 Spec 與 Tests，不要只改程式。

---

## 5. 警部計分

警部成功時採神犬型計分：

```text
警部玩家：+3
犯人：+0
已啟動共犯：+0
其他玩家：+1
```

建議：

```ts
type ScoringResolution =
  | 'DETECTIVE'
  | 'DOG'
  | 'CRIMINAL'
  | 'POLICE_CHIEF';
```

如果警部成功，最終計分 Resolution 應為：

```text
POLICE_CHIEF
```

---

## 6. 警部測試

至少增加：

- 啟用警部時取代神犬
- 持有警部為公開資訊
- 其他手牌仍保持私密
- 警部經交易後公開持有人更新
- 警部經情報交換後公開持有人更新
- 警部經謠言後公開持有人更新
- 手牌 >3 不可使用警部
- 手牌 <=3 可使用警部
- 不可指定自己
- 出牌時不可立即揭露目標是不是犯人
- 目標在放置後固定
- 犯人牌之後移走 → 判定失敗
- 犯人牌之後移入 → 判定成功
- 只在回合結束時判定
- 成功時警部 +3
- 犯人／共犯 0
- 其他玩家 +1
- 不在場證明可阻擋警部成功
- public log 不得洩漏犯人牌移動

---

## 7. AI 防作弊稽核

AI 練習模式很實用，但 AI 不能因為程式在 server/service 裡就取得全知資訊。

請建立專用 AI Context：

```ts
interface CriminalDanceAIContext {
  selfUid: string;

  ownHand: CriminalDanceCard[];
  ownScore: number;

  publicState: CriminalDancePublicState;

  rememberedInformation: AIKnowledgeMemory;
}
```

禁止提供 AI：

```text
所有玩家手牌
currentCriminalUid
server secret state
其他玩家私密選牌
未來的隨機結果
```

### AI 可以記住的資訊

```text
目擊者：
只記住當時看到的 hand snapshot

公開出牌：
可記得公開打出的牌

交易：
只知道自己給出的牌與收到的牌

情報交換：
只知道自己傳出與收到的牌

謠言：
只知道自己收到的牌

少年：
若 AI 合法持有少年，可知道「初始犯人」
但之後犯人移動不能自動更新
```

### AI 防作弊 Regression Test

建立兩份遊戲狀態：

```text
AI 可見資訊完全一樣
但是犯人實際藏在不同玩家
```

然後驗證：

```text
AI 收到的 Context 必須完全相同
```

這是很有效的 anti-cheat 測試。

---

## 8. Firebase Security Audit

Production 前確認：

- 玩家 A 無法讀玩家 B 手牌
- 目擊者 view 只有使用者可讀
- Trade selection 私密
- Information Exchange selection 私密
- 少年情報私密
- 本局未使用卡牌私密
- 隨機神犬／謠言由 trusted logic 執行
- 分數由 authoritative logic 計算
- current turn server-side validation
- `stateVersion` stale request 防護
- double-click idempotency
- multi-tab 同 UID race 防護

若專案已有 Firebase Emulator Tests，務必補 Rules Tests。

---

## 9. Browser Acceptance Matrix

目前只有 4 項 browser tests，建議至少覆蓋：

```text
3 人真人局
8 人真人局
1 真人 + 2 AI
1 真人 + 7 AI
少年啟用
警部啟用
```

另外至少有一個 E2E 要包含：

```text
犯人透過交易移動
犯人透過情報交換移動
犯人透過謠言移動
```

並驗證 UI / Log 沒有洩漏犯人位置。

---

## 10. Mobile Acceptance

至少驗證：

```text
360px
390px
430px
768px
Desktop
```

重點：

- 起手 4 張卡仍可閱讀
- 卡片放大不超出螢幕
- Target Dialog 可操作
- Trade/情報交換秘密選牌不爆版
- 長玩家名稱不破版
- 8 玩家手機版仍可用
- Score / Log / Rules 能正常開啟

---

## 11. 動畫速度建議

目前 Codex 回報：

```text
約 3.2 秒行動動畫
```

重大動畫可以，但 6–8 人長時間遊戲可能偏慢。

建議增加：

```ts
animationSpeed: 'NORMAL' | 'FAST';
```

### NORMAL

```text
重大揭曉：約 2.0–3.2 秒
一般出牌：約 0.5–1.2 秒
```

### FAST

```text
重大揭曉：約 0.8–1.2 秒
一般出牌：約 0.2–0.4 秒
```

同時支援：

```text
點擊略過非秘密動畫
prefers-reduced-motion
```

注意：

```text
Skip Animation 只能跳過動畫
不能跳過遊戲邏輯
```

AI 練習模式尤其建議支援 Fast。

---

## 12. Production Deployment Checklist

在宣稱正式可用前：

```text
1. 確認 production Firebase Project
2. Production build
3. Deploy Realtime Database Rules
4. Deploy Functions / trusted backend
5. Deploy Hosting
6. 確認 SPA rewrite
7. 確認 Anonymous Auth
8. 確認 production databaseURL
9. 確認沒有 emulator / localhost URL
10. 確認沒有舊 Socket.IO localhost dependency
11. 確認沒有秘密資訊寫入 frontend log
12. 執行 production smoke test
```

不要只 deploy Hosting 而沒更新安全 Rules / Functions。

---

## 13. Post-deploy Smoke Test

至少兩個真實 browser session：

```text
Create Room
Join Room
Start 犯人在跳舞
確認兩邊私密手牌不同
First Discoverer
Trade
Witness
Information Exchange
Rumor
Detective Catch
Next Round
Refresh / Reconnect
Finish Match
Return Lobby
```

再驗證：

```text
AI Practice
Mobile
```

---

## 14. Production Logging

禁止正式 Log 記錄：

```text
完整手牌
current Criminal UID
Witness 看到的牌
Trade secret selection
少年知道的初始犯人
本局排除的牌
```

允許：

```text
room id/hash
action type
actor uid/hash
phase
round
stateVersion
success/failure
error code
latency
```

---

## 15. 建議下一段直接給 Codex

```text
目前《犯人在跳舞》Base Game、少年選配、AI 練習、UI 與測試已完成。

請完整閱讀 CRIMINAL_DANCE_POST_IMPLEMENTATION_ADDENDUM.md，
不要重構或破壞目前已通過功能，依序完成：

1. 實作並開放「警部」選配，依 Addendum deterministic digital rule contract。
2. 完成 AI hidden-information anti-cheat audit，AI 不得取得伺服器全知資訊。
3. 補 Firebase private-state / Security Rules / multi-tab / stale-state 測試。
4. 補 3 人、8 人、1+2 AI、1+7 AI、少年、警部的 browser acceptance tests。
5. 加入動畫 Normal/Fast 與 reduced-motion，避免所有動作固定等待約 3.2 秒。
6. 完成 production deployment checklist，但真正 deploy 前先列出將變更的 Firebase Rules / Functions / Hosting 設定給我確認。

每個階段完成後執行：
test、browser test、lint、build。

最後回報：
- 新增／修改檔案
- 測試總數
- 尚未解決事項
- Firebase 正式部署所需人工步驟
- 是否已可安全部署 production

不要新增其他桌遊或額外 scope。
```
