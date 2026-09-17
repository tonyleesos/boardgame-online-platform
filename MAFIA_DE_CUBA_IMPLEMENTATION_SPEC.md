# 《教父風雲：危情古巴》標準規則與開發參考規格

> 遊戲英文名稱：Mafia de Cuba  
> 文件用途：提供 Codex 或其他開發工具實作多人線上桌遊版本  
> 規則範圍：原版基礎遊戲；另附 Cleaner（殺手）進階規則  
> 不包含：紅色革命擴充、娛樂節目自訂積分制、房規

---

## 1. 遊戲概述

《教父風雲：危情古巴》是一款 6～12 人的隱藏身分、欺騙與推理遊戲。

- 其中 1 人固定擔任「教父」。
- 其他玩家不會在開局隨機取得身分，而是在雪茄盒傳遞階段，透過拿取鑽石或角色籌碼決定自己的身分。
- 教父必須透過詢問、證詞與玩家之間的矛盾，找出所有竊賊並追回全部失竊鑽石。
- 玩家可以說真話、說謊、誤導，或保持沉默。

---

## 2. 遊戲人數與配件

### 2.1 遊戲人數

- 總人數：6～12 人。
- 總人數包含教父。
- 每局固定只有 1 名教父。

### 2.2 基礎配件

- 鑽石 ×15
- 心腹籌碼 ×5
- 探員籌碼 ×2（FBI、CIA）
- 司機籌碼 ×2
- Cleaner／殺手籌碼 ×1
- 美酒指示物 ×2
- 黑色布袋 ×1
- 雪茄盒 ×1

Cleaner 是進階角色，初次遊戲建議不使用。

### 2.3 依總人數配置

「總人數」包含教父。

| 總人數 | 心腹 | 探員 | 司機 | 美酒 |
|---:|---:|---:|---:|---:|
| 6 | 1 | 1 | 1 | 0 |
| 7 | 2 | 1 | 1 | 0 |
| 8 | 3 | 1 | 1 | 1 |
| 9 | 4 | 1 | 1 | 1 |
| 10 | 4 | 2 | 1 | 1 |
| 11 | 4 | 2 | 2 | 2 |
| 12 | 5 | 2 | 2 | 2 |

每局再固定加入 15 顆鑽石。

### 2.4 沒有實體籌碼的身分

以下兩種身分沒有角色籌碼：

- 竊賊：玩家拿取至少 1 顆鑽石後產生。
- 街頭混混：玩家沒有拿到任何東西時產生。

---

## 3. 遊戲準備

1. 選出 1 名玩家擔任教父。
2. 依玩家總人數，將對應數量的角色籌碼與固定 15 顆鑽石放入雪茄盒。
3. 教父秘密從盒中拿走 0～5 顆鑽石，放在自己面前或自己的保管區。
4. 其他玩家不得知道教父拿走幾顆鑽石。
5. 因此，雪茄盒開始傳遞時會剩下 10～15 顆鑽石。
6. 教父左手邊第一位玩家成為「第一位玩家」，並取得黑色布袋的操作權。
7. 雪茄盒由第一位玩家開始，依座位順序傳遞，最後由教父右手邊的玩家交還教父。

> 教父預先保留的鑽石不算「失竊鑽石」，也不需要追回。

---

## 4. 第一階段：鑽石失竊

### 4.1 一般玩家回合

每位玩家收到雪茄盒時，依序完成以下動作。

#### 步驟 A：秘密查看盒內物品

玩家可以查看：

- 剩餘鑽石數量。
- 剩餘角色籌碼。
- 哪些角色可能已經被拿走。

玩家應記住這些資訊，供之後審問階段使用。其他玩家不能看到盒內內容。

#### 步驟 B：秘密拿取一種物品

正常情況下，玩家必須在以下兩種選擇中擇一：

1. 拿取至少 1 顆鑽石，數量不限，成為「竊賊」。
2. 拿取 1 個角色籌碼，身分成為該籌碼所代表的角色。

禁止事項：

- 不可同時拿角色籌碼與鑽石。
- 不可拿取兩個以上角色籌碼。
- 除特殊情況外，不可主動什麼都不拿。

#### 步驟 C：傳遞雪茄盒

- 玩家將拿到的物品隱藏。
- 不可公開自己的身分或拿取數量。
- 將雪茄盒傳給下一位玩家。

### 4.2 第一位玩家的特殊能力

第一位玩家在正常拿取物品以前，可以：

- 從盒中選擇 0 或 1 個角色籌碼放進黑色布袋。
- 可以選擇不放入任何角色。
- 絕對不可把鑽石放入黑色布袋。

完成藏角色動作後，第一位玩家仍須正常拿取：

- 至少 1 顆鑽石；或
- 1 個角色籌碼。

黑色布袋在本局結束前保持秘密。被放入布袋的角色視為「未被任何玩家取得」。

### 4.3 街頭混混的產生方式

街頭混混沒有角色籌碼，共有以下兩種產生方式。

#### 情況 A：雪茄盒已空

若盒子傳到玩家手中時已經沒有任何可拿取物品：

- 該玩家自動成為街頭混混。
- 該玩家仍須假裝自己有拿取東西。
- 不得直接公開盒子已空。

若後續玩家也收到空盒，後續玩家同樣成為街頭混混。

#### 情況 B：最後一位玩家主動放棄拿取

教父右手邊、最後收到雪茄盒的玩家具有特殊權利：

- 即使盒內仍有物品，也可以選擇什麼都不拿。
- 若選擇不拿，該玩家成為街頭混混。
- 該玩家仍須假裝自己有拿取東西。

只有最後一位玩家能在盒內仍有物品時主動選擇不拿。

---

## 5. 第二階段：教父調查

### 5.1 調查開始

1. 最後一位玩家把雪茄盒交還教父。
2. 教父秘密查看盒內剩餘的鑽石與角色籌碼。
3. 教父開始自由審問其他玩家。

### 5.2 教父可詢問的內容

例如：

- 你收到盒子時有幾顆鑽石？
- 你看到哪些角色？
- 你把盒子傳出去時剩下幾顆鑽石？
- 你拿了什麼？
- 你認為誰偷了鑽石？

### 5.3 玩家發言規則

- 玩家可以說真話。
- 玩家可以說謊。
- 玩家可以保持沉默。
- 尚未出局的玩家可以主動發言。
- 玩家可指控或替其他玩家辯護。
- 玩家不會因為口頭承認身分就自動公開或結算；必須由教父正式指控。

---

## 6. 教父正式指控

### 6.1 正式指控方式

當教父決定指控某位玩家時，必須明確執行「要求交出物品」的正式指控動作。

只有正式指控後，目標玩家才必須公開自己的實際物品或身分。

> 線上版應將「詢問／口頭懷疑」和「正式指控」設計為不同操作，並要求教父再次確認正式指控。

### 6.2 抓到竊賊

若目標玩家持有鑽石：

- 教父指控成功。
- 該玩家公開自己偷取的全部鑽石。
- 全部鑽石交還教父。
- 該竊賊立即出局。
- 出局後不得再發言、投票、提示或參與調查。
- 教父可繼續調查並指控其他玩家。

### 6.3 抓錯普通角色

若目標玩家是以下身分之一：

- 心腹
- 司機
- 街頭混混

則代表教父抓錯人。

處理方式：

- 若教父還有美酒，必須支付 1 個美酒給被冤枉的玩家，調查繼續。
- 被冤枉的普通角色不會因此出局，可繼續參與討論。
- 若教父已無美酒可支付，遊戲立即結束，教父失敗。

6～7 人局沒有美酒，因此第一次抓錯普通角色就會立即失敗。

### 6.4 抓到探員

若被正式指控的玩家是 FBI 或 CIA 探員：

- 遊戲立即結束。
- 被指控的該名探員單獨達成主要勝利。
- 教父不可使用美酒抵銷。
- 若場上有兩名探員，另一名未被指控的探員不會因此一起取得探員勝利。
- 仍需另外判定是否有司機因右手邊玩家獲勝而連帶獲勝。

---

## 7. 角色與標準勝利條件

| 身分 | 產生方式 | 勝利條件 |
|---|---|---|
| 教父 | 開局指定 | 找回全部失竊鑽石 |
| 心腹 | 拿取心腹籌碼 | 教父找回全部失竊鑽石時一起獲勝 |
| 竊賊 | 拿取至少 1 顆鑽石 | 教父失敗時，尚未被抓的竊賊中持有鑽石最多者獲勝 |
| 探員 | 拿取 FBI 或 CIA 籌碼 | 自己被教父正式指控時，該探員立即獲勝 |
| 司機 | 拿取司機籌碼 | 自己右手邊的玩家獲勝時，司機也獲勝 |
| 街頭混混 | 沒有拿到任何物品 | 只要有竊賊成為勝者，街頭混混一起獲勝 |

### 7.1 竊賊勝利判定

教父失敗時：

1. 排除所有已被教父抓到並追回鑽石的竊賊。
2. 在仍未被抓的竊賊中，比較各自持有的鑽石數量。
3. 持有最多鑽石的竊賊獲勝。
4. 若最高數量相同，並列最高的竊賊共同獲勝。
5. 其他持有較少鑽石的未被抓竊賊不算勝者。
6. 若有竊賊勝者，所有街頭混混一起獲勝。

範例：

- 甲偷 2 顆。
- 乙偷 5 顆。
- 丙偷 5 顆。
- 三人均未被抓，且教父最後失敗。

結果為乙、丙共同獲勝，甲不獲勝；所有街頭混混也獲勝。

### 7.2 司機勝利判定

司機沒有固定陣營，只判斷自己右手邊的玩家是否為本局勝者。

右手邊玩家可能是：

- 教父
- 心腹
- 竊賊
- 探員
- 另一位司機
- 街頭混混

#### 多名司機的連鎖判定

如果司機右手邊也是司機，應以「右手邊玩家最終是否獲勝」進行遞迴或固定點判定，直到連到非司機角色。

建議實作方式：

1. 先結算所有非司機角色的主要勝負結果。
2. 依座位關係反覆更新司機勝負。
3. 當結果不再改變時停止。
4. 若所有玩家皆為司機造成封閉環，屬於不可能由標準配件配置產生的狀態，後端應阻擋此異常資料。

---

## 8. 遊戲結束條件

### 8.1 教父成功

觸發條件：所有失竊鑽石都已追回。

勝者：

- 教父。
- 所有心腹。
- 右手邊玩家為勝者的司機。

### 8.2 教父抓錯且無酒可付

觸發條件：

- 教父正式指控普通角色；且
- 教父沒有剩餘美酒。

勝者：

- 尚未被抓的竊賊中，持有鑽石最多者。
- 若最多顆數並列，並列者共同獲勝。
- 若存在竊賊勝者，所有街頭混混一起獲勝。
- 右手邊玩家為勝者的司機。

### 8.3 教父指控探員

觸發條件：教父正式指控 FBI 或 CIA 探員。

勝者：

- 被指控的該名探員。
- 右手邊玩家為該勝者的司機。

### 8.4 教父一開始就沒有失竊鑽石

若所有非教父玩家都選擇角色、成為街頭混混，或因盒子狀態而沒有任何人拿鑽石：

- 雪茄盒回到教父手上並完成初始檢查後，可立即判定教父已找回全部失竊鑽石。
- 教父與所有心腹獲勝。
- 再結算司機。

---

## 9. 進階角色：Cleaner／殺手

### 9.1 加入方式

- 從該人數配置中移除 1 個心腹籌碼。
- 加入 1 個 Cleaner／殺手籌碼。
- 其他配置不變。

例如 9 人局原本使用 4 個心腹，可改為：

- 心腹 ×3
- Cleaner ×1
- 探員 ×1
- 司機 ×1

### 9.2 發動時機

當教父正式指控某玩家後、目標玩家公開身分以前，Cleaner 可以選擇發動能力。

線上版建議流程：

1. 教父鎖定並確認正式指控目標。
2. 系統進入 Cleaner 反應階段。
3. Cleaner 在倒數時間內選擇「開槍」或「不開槍」。
4. 若不開槍或逾時，目標照正常流程公開身分。
5. 若開槍，立即處理 Cleaner 結果。

### 9.3 Cleaner 射中探員

若目標是 FBI 或 CIA 探員：

- Cleaner 立即達成主要勝利。
- 遊戲立即結束。
- 再依右手邊玩家是否為勝者判定司機。

### 9.4 Cleaner 射錯

若目標不是探員：

- Cleaner 與目標玩家一起出局。
- 若目標是竊賊，該竊賊全部鑽石仍交給教父。
- 若目標是普通角色，教父不需支付美酒。
- 若追回該竊賊的鑽石後，所有失竊鑽石均已追回，教父可立即獲勝。
- 否則遊戲繼續。

---

## 10. 標準模式與節目版差異

本文件不採用額外積分制。

標準單局規則重點如下：

- 6～12 人。
- 固定 15 顆鑽石。
- 教父開局秘密保留 0～5 顆鑽石。
- 第一位玩家可秘密移除 0 或 1 個角色籌碼。
- 最後一位玩家可主動不拿東西，成為街頭混混。
- 教父要追回全部失竊鑽石才能獲勝。
- 教父失敗時，不是所有竊賊一起獲勝，而是尚未被抓且持有鑽石最多的竊賊獲勝。
- 節目為多局競賽設計的額外分數，不屬於標準單局規則。

---

## 11. 線上版遊戲狀態設計

### 11.1 建議遊戲階段

```text
LOBBY
  -> SETUP
  -> GODFATHER_HIDE_DIAMONDS
  -> FIRST_PLAYER_HIDE_ROLE
  -> PASSING_BOX
  -> GODFATHER_INSPECT_BOX
  -> INTERROGATION
  -> ACCUSATION_CONFIRMATION
  -> CLEANER_REACTION（啟用 Cleaner 時）
  -> ACCUSATION_RESOLUTION
  -> GAME_OVER
```

可循環的部分：

- `ACCUSATION_RESOLUTION -> INTERROGATION`：成功抓到竊賊，或以美酒支付抓錯代價後繼續。
- `ACCUSATION_RESOLUTION -> GAME_OVER`：教父成功、無酒可付、抓到探員或 Cleaner 成功。

### 11.2 建議列舉

```ts
enum Role {
  Godfather = "godfather",
  LoyalHenchman = "loyal_henchman",
  Thief = "thief",
  AgentFBI = "agent_fbi",
  AgentCIA = "agent_cia",
  Driver = "driver",
  StreetUrchin = "street_urchin",
  Cleaner = "cleaner"
}

enum GamePhase {
  Lobby = "lobby",
  Setup = "setup",
  GodfatherHideDiamonds = "godfather_hide_diamonds",
  FirstPlayerHideRole = "first_player_hide_role",
  PassingBox = "passing_box",
  GodfatherInspectBox = "godfather_inspect_box",
  Interrogation = "interrogation",
  AccusationConfirmation = "accusation_confirmation",
  CleanerReaction = "cleaner_reaction",
  AccusationResolution = "accusation_resolution",
  GameOver = "game_over"
}

enum EndReason {
  AllStolenDiamondsRecovered = "all_stolen_diamonds_recovered",
  WrongAccusationWithoutRum = "wrong_accusation_without_rum",
  AgentAccused = "agent_accused",
  CleanerKilledAgent = "cleaner_killed_agent"
}
```

### 11.3 建議玩家狀態

```ts
interface PlayerState {
  playerId: string;
  seatIndex: number;
  role: Role | null;
  diamondsHeld: number;
  isAlive: boolean;
  isRevealed: boolean;
  isFirstPlayer: boolean;
  isLastPlayer: boolean;
  hasCompletedBoxTurn: boolean;
  isWinner: boolean;
}
```

### 11.4 建議遊戲狀態

```ts
interface GameState {
  gameId: string;
  phase: GamePhase;
  players: PlayerState[];

  godfatherPlayerId: string;
  currentTurnPlayerId: string | null;
  accusationTargetPlayerId: string | null;

  boxDiamonds: number;
  boxRoles: Role[];
  hiddenBagRole: Role | null;
  godfatherReservedDiamonds: number;
  godfatherRecoveredDiamonds: number;
  rumRemaining: number;

  cleanerEnabled: boolean;
  endReason: EndReason | null;
  winnerPlayerIds: string[];
}
```

### 11.5 伺服器應保存的基準值

為避免勝負計算只依賴可變狀態，建議另外保存：

```ts
interface DiamondLedger {
  totalDiamonds: 15;
  godfatherReserved: number;
  initiallyAvailableToPlayers: number;
  currentlyInBox: number;
  currentlyHeldByActiveThieves: number;
  recoveredFromThieves: number;
}
```

必須隨時符合：

```text
15
= godfatherReserved
+ currentlyInBox
+ currentlyHeldByActiveThieves
+ recoveredFromThieves
```

---

## 12. 資訊可見性與防作弊要求

### 12.1 僅本人可見

- 自己的角色。
- 自己持有的鑽石數量。
- 自己收到盒子時看到的內容。
- 自己傳出盒子前的內容。

### 12.2 僅目前操作玩家可見

- 雪茄盒當前內容。
- 可拿取的角色與鑽石。

### 12.3 僅教父可見

- 自己開局保留的鑽石數量。
- 雪茄盒回來後的剩餘內容。
- 尚未公開前，不可看到其他玩家真實身分或鑽石數量。

### 12.4 第一位玩家專屬資訊

- 黑色布袋是否放入角色。
- 被放入的角色種類。

### 12.5 伺服器權威原則

- 所有抽取、拿取、傳遞、指控與勝負計算均由伺服器驗證。
- 前端不可收到不應看見的完整遊戲狀態後再自行隱藏。
- API／WebSocket 回傳資料應依玩家身分過濾。
- 重新整理或重新連線後，只能恢復該玩家原本有權看到的資訊。
- 伺服器應記錄每次狀態轉換，但遊戲進行中不可把秘密操作寫入所有人可讀的事件流。

---

## 13. 核心後端驗證規則

### 13.1 開局驗證

- 人數必須介於 6～12。
- 必須剛好有 1 名教父。
- 角色配置必須符合人數表。
- 啟用 Cleaner 時，必須以 1 個 Cleaner 取代 1 個心腹。
- 鑽石總數固定為 15。
- 教父只能保留 0～5 顆鑽石。

### 13.2 拿取驗證

- 只有目前回合玩家可操作雪茄盒。
- 玩家不可重複操作自己的盒子回合。
- 一般玩家必須拿鑽石或 1 個角色。
- 拿鑽石時數量至少為 1，且不可超過盒內剩餘數量。
- 拿角色時只能拿 1 個盒內仍存在的角色。
- 不可同時拿角色與鑽石。
- 第一位玩家最多只能藏 1 個角色，且不可藏鑽石。
- 只有最後一位玩家可在盒內仍有物品時主動不拿。
- 盒子已空時，玩家自動成為街頭混混。

### 13.3 指控驗證

- 只有教父可以正式指控。
- 只能在調查階段指控。
- 不能指控自己。
- 不能重複指控已出局玩家。
- 指控確認後不可更換目標。
- 啟用 Cleaner 且 Cleaner 尚可行動時，先進入 Cleaner 反應階段。

### 13.4 勝負驗證

- 每次成功追回鑽石後，立即檢查是否追回全部失竊鑽石。
- 指控普通角色時，若有酒必須自動扣除 1 個；若無酒則立即結束。
- 指控探員立即結束，不可扣酒。
- 先結算非司機角色，再結算司機。
- 勝者清單應由伺服器一次產生並保存，避免不同客戶端自行計算出不同結果。

---

## 14. 建議勝負判定演算法

```text
resolveAccusation(target):
  if cleaner enabled and cleaner chooses to shoot:
    if target is Agent:
      primaryWinners = [Cleaner]
      endReason = CLEANER_KILLED_AGENT
      finalizeDrivers(primaryWinners)
      end game
    else:
      eliminate Cleaner and target
      if target is Thief:
        recover all target diamonds
        if all stolen diamonds recovered:
          primaryWinners = [Godfather, all Henchmen]
          endReason = ALL_STOLEN_DIAMONDS_RECOVERED
          finalizeDrivers(primaryWinners)
          end game
      return to interrogation

  reveal target

  if target is Thief:
    recover all target diamonds
    eliminate target
    if all stolen diamonds recovered:
      primaryWinners = [Godfather, all Henchmen]
      endReason = ALL_STOLEN_DIAMONDS_RECOVERED
      finalizeDrivers(primaryWinners)
      end game
    else:
      return to interrogation

  if target is Agent:
    primaryWinners = [target]
    endReason = AGENT_ACCUSED
    finalizeDrivers(primaryWinners)
    end game

  if target is ordinary role:
    if rumRemaining > 0:
      rumRemaining -= 1
      return to interrogation
    else:
      maxDiamonds = maximum diamonds among uncaught thieves
      primaryWinners = all uncaught thieves with maxDiamonds
      if primaryWinners contains any thief:
        add all Street Urchins
      endReason = WRONG_ACCUSATION_WITHOUT_RUM
      finalizeDrivers(primaryWinners)
      end game
```

---

## 15. 建議 API／即時事件

以下僅為參考命名，可依現有 React、Firebase、Firestore 或 WebSocket 架構調整。

### 15.1 指令型 API

```text
POST /games/{gameId}/start
POST /games/{gameId}/godfather/hide-diamonds
POST /games/{gameId}/first-player/hide-role
POST /games/{gameId}/box/take-diamonds
POST /games/{gameId}/box/take-role
POST /games/{gameId}/box/take-nothing
POST /games/{gameId}/box/pass
POST /games/{gameId}/godfather/accuse
POST /games/{gameId}/cleaner/react
POST /games/{gameId}/chat/messages
```

### 15.2 建議即時事件

```text
game.started
phase.changed
box.received
box.action.completed
box.passed
interrogation.started
chat.message.created
accusation.pending
cleaner.reaction.requested
accusation.resolved
player.eliminated
rum.consumed
game.ended
```

事件不得向未授權玩家暴露秘密資料。例如 `box.action.completed` 對其他玩家只能顯示「某玩家已完成操作」，不能顯示拿了什麼。

---

## 16. UI／UX 實作建議

### 16.1 雪茄盒階段

- 只有目前玩家畫面顯示盒內實際內容。
- 操作前顯示「確認周圍沒有人看到螢幕」。
- 拿取完成後進入遮罩畫面，再交給下一位玩家。
- 線上遠端模式則直接切換目前操作權，不需要實體傳手機流程。
- 顯示操作倒數與斷線重連狀態。

### 16.2 調查階段

- 顯示所有玩家座位順序。
- 清楚標示教父左、右方向，避免司機勝負方向混淆。
- 教父畫面提供「詢問」與醒目的「正式指控」兩種不同操作。
- 正式指控前顯示二次確認，並提示剩餘美酒數量。
- 已被抓到的竊賊應顯示出局，並關閉文字／語音發言能力。

### 16.3 結算畫面

應顯示：

- 遊戲結束原因。
- 每位玩家的真實身分。
- 每位竊賊原本偷取的鑽石數量。
- 哪些竊賊已被抓到。
- 黑色布袋中的角色。
- 教父開局保留的鑽石數量。
- 每位勝者與其獲勝理由。
- 司機右手邊玩家及連帶勝負結果。

---

## 17. 驗收測試案例

### 17.1 配置測試

1. 6 人局應建立 1 心腹、1 探員、1 司機、0 美酒與 15 鑽石。
2. 12 人局應建立 5 心腹、2 探員、2 司機、2 美酒與 15 鑽石。
3. 開啟 Cleaner 後，角色總數不變，且心腹數減 1、Cleaner 數加 1。
4. 少於 6 人或多於 12 人不得開始標準模式。

### 17.2 教父藏鑽測試

1. 教父藏 0 顆時，盒內應有 15 顆。
2. 教父藏 5 顆時，盒內應有 10 顆。
3. 藏負數或超過 5 顆必須拒絕。
4. 其他玩家不可讀取實際藏鑽數量。

### 17.3 第一位玩家測試

1. 可選擇不藏角色。
2. 可藏 1 個仍在盒內的角色。
3. 不可藏 2 個角色。
4. 不可藏鑽石。
5. 藏角色後仍必須正常拿取一種物品。

### 17.4 拿取測試

1. 一般玩家不可同時拿鑽石和角色。
2. 一般玩家不可主動空手。
3. 最後玩家可在盒內仍有物品時空手並成為街頭混混。
4. 盒子已空時，目前及後續玩家自動成為街頭混混。
5. 玩家不可拿超過盒內數量的鑽石。

### 17.5 指控測試

1. 抓到竊賊時，全部鑽石轉為教父已追回，竊賊出局。
2. 抓到普通角色且有酒時，扣 1 酒，遊戲繼續，目標不出局。
3. 抓到普通角色且無酒時，遊戲立即結束。
4. 抓到探員時遊戲立即結束，不扣酒。
5. 6～7 人局第一次抓錯普通角色時應立即結束。

### 17.6 勝負測試

1. 教父追回所有失竊鑽石時，教父與心腹勝利。
2. 教父失敗時，只有未被抓竊賊中持有最多鑽石者勝利。
3. 兩名未被抓竊賊同為最多顆時，兩人共同勝利。
4. 持有較少鑽石的未被抓竊賊不獲勝。
5. 有竊賊勝者時，所有街頭混混獲勝。
6. 被指控的探員獲勝，另一名未被指控探員不獲勝。
7. 司機右手邊玩家獲勝時，司機獲勝。
8. 司機右手邊玩家未獲勝時，司機不獲勝。

### 17.7 Cleaner 測試

1. Cleaner 只能在正式指控後、目標公開前反應。
2. Cleaner 射中探員時立即獲勝並結束遊戲。
3. Cleaner 射錯普通角色時，兩者出局，教父不扣酒。
4. Cleaner 射錯竊賊時，竊賊鑽石仍交給教父。
5. Cleaner 射中竊賊並使失竊鑽石全部追回時，教父與心腹勝利。

### 17.8 權限與斷線測試

1. 非目前回合玩家不可取得盒內內容。
2. 重新整理頁面後，玩家仍只能看見自己的秘密資訊。
3. 斷線重連不得造成重複拿取。
4. 同一操作重送時，後端應以冪等方式拒絕或回傳既有結果。
5. 遊戲結束前，任何公開事件不得洩漏黑色布袋角色。

---

## 18. 開發時最容易寫錯的規則

1. 玩家身分不是開局隨機發牌，而是透過拿取物品產生。
2. 教父秘密拿走的 0～5 顆鑽石不是失竊鑽石。
3. 第一位玩家藏的是 0 或 1 個角色，不能藏鑽石。
4. 第一位玩家藏完角色後，仍要正常拿取物品。
5. 只有最後一位玩家可在盒內仍有物品時主動空手。
6. 抓錯普通角色且有酒時，被冤枉玩家不出局。
7. 抓到探員不能用酒補救。
8. 教父失敗時，不是所有竊賊都獲勝，只有未被抓且鑽石最多者獲勝。
9. 街頭混混只有在出現竊賊勝者時才跟著獲勝。
10. 司機看的是自己右手邊玩家的最終勝負，不是固定支持教父或竊賊。
11. 出局竊賊不得繼續發言。
12. 線上版不能把完整秘密狀態傳給前端後只靠 UI 隱藏。

---

## 19. 一局完整範例

假設總共 9 人：1 名教父與 8 名其他玩家。

配置：

- 鑽石 ×15
- 心腹 ×4
- 探員 ×1
- 司機 ×1
- 美酒 ×1

流程：

1. 教父秘密保留 3 顆鑽石，因此盒內剩 12 顆鑽石與 6 個角色。
2. 第一位玩家把探員放入黑色布袋，再拿走 1 個心腹。
3. 第二位玩家拿 2 顆鑽石，成為竊賊。
4. 第三位玩家拿司機。
5. 第四位玩家拿 4 顆鑽石，成為竊賊。
6. 第五位玩家拿心腹。
7. 第六位玩家拿 1 顆鑽石，成為竊賊。
8. 第七位玩家拿心腹。
9. 最後一位玩家主動什麼都不拿，成為街頭混混。
10. 盒子回到教父手中時剩 5 顆鑽石。

教父知道：

- 自己原本保留 3 顆。
- 玩家開始傳遞時有 12 顆。
- 現在盒內剩 5 顆。
- 玩家合計偷走 7 顆。

但教父不知道：

- 是 1 人偷 7 顆，還是多人分別偷取。
- 哪些玩家是竊賊。
- 探員是被玩家拿走，還是被第一位玩家放進黑色布袋。

此時進入調查與正式指控階段。

---

## 20. 參考來源

- Asmodee Taiwan 商品與遊戲介紹：https://www.asmodee.com.tw/en_US/shop/product/mafia-de-cuba-1126
- Mafia de Cuba 英文規則整理：https://www.ultraboardgames.com/mafia-de-cuba/game-rules.php
- 原版英文規則書 PDF：https://cdn.1j1ju.com/medias/53/87/ed-mafia-de-cuba-rulebook.pdf

> 正式開發或公開發行前，建議再以實際持有版本的原廠規則書校對角色名稱、配件名稱與地區版本差異。

