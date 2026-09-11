# 圓桌之夜 · Boardgame Online Platform

React / TypeScript / Vite 桌遊平台，使用 Firebase Anonymous Auth、Realtime Database 與 callable Cloud Functions。大廳提供 Avalon（5–10 人）、驚爆倫敦原版（4–8 人）、驚爆倫敦：危機進化（4–6 人）及同房異夢（2–4 人）。前三款支援 AI 練習與補位；同房異夢由真人合作。

## 同房異夢 · 圖像化合租解謎

建立同房異夢房間，邀請 2–4 位朋友，由房主選擇符合人數的原創劇本。每人打開「我的秘密心願」閱讀圖卡，再按「讀完了，準備入住」。四個劇本包含兩個雙人、一個三人、一個四人劇本，每個都有經測試驗證的解法；解法僅存在測試資料，不會打包至前端。

點房間牆面或家具位置，挑選物品／顏色，查看「現在 → 確認後」的房間對照，再確認佈置。每回合可新增、移除、同類替換、粉刷，已滿足全部個人心願時可略過；四人劇本另可交換臥室。室友用三種表情回應，所有人回應後換人。

秘密心願以房間、家具、顏色、風格與數量圖示呈現，自己的條件會即時顯示 ✓／✗，文字保留於「心願詳解」。圖卡只有本人、合法收件人或終局揭曉後可見。UI 不提供自由文字聊天。

雙人於第 15、20、25 輪結束後談心；三／四人於第 5、10、15、20、25 輪結束後開會。選表情、心願卡、收件人後送出，只有指定室友收到該條件。雙人分享持續累積；多人新分享取代前次分享。上方愛心時程與室友完成標記提示進度。所有人同時滿意立即獲勝，30 輪耗盡則失敗，結算顯示最終房屋、所有心願與分數。

沿用既有匿名登入、房間、即時同步與斷線重連；`decorumPrivate/{uid}` 只允許本人讀取，所有操作與條件判定由 Functions 驗證。詳細對照見 [Decorum 實作狀態](docs/DECORUM_IMPLEMENTATION.md)。

## 阿瓦隆結算與圖示

結束時會優先彈出醒目的「好人陣營勝利／壞人陣營勝利」，關閉後查看圓桌與全員身份，也可隨時按「查看勝負」重開。隊伍表決使用圓形拇指贊成／反對票，秘密任務使用長方形聖杯／骷髏牌；戰報與任務地圖沿用相同任務圖示。AI 玩家名稱統一為隨機名稱加 `AI`（例如 `艾琳AI`），包括練習、補位及离席接手。

## 單人 AI 練習與驚爆倫敦

輸入暱稱後，在對應版本的遊戲卡片選擇「單人練習 · 與 AI 對局」，設定人數與難度。建立練習桌後點「我準備好了」及「開始遊戲」，AI 會自動確認身份與行動；每次結果由房主點擊繼續，方便閱讀與練習。

驚爆倫敦原版只有安全引線、解除引線與一張炸彈，翻到炸彈立即結束；危機進化使用六色炸彈及特殊能力。查看手牌時逐張顯示卡面，排列只反映組成，不代表桌上蓋牌的位置。

AI 使用伺服器策略程式，提供輕鬆與標準難度，不需要 LLM API key。決策只取得公開紀錄及該 AI 自己的身份情報；無法查看其他玩家身份或未知牌的位置。驚爆倫敦包含宣言、虛張聲勢、剪線與顏色能力選擇；Avalon 包含組隊、表決、任務與刺殺。

詳細規則、數位化選擇及限制見 [AI 與驚爆倫敦實作說明](docs/AI_TIMEBOMB_IMPLEMENTATION.md)。

## 安裝與本機試玩

需要 Node.js 22、npm 10+。Firebase Emulator 另需 Java 21+；瀏覽器測試預設使用已安裝的 Microsoft Edge。

```sh
npm install
```

開啟兩個終端機：

```sh
# 終端機 A：Auth、Realtime Database、Functions Emulator
npm run emulators

# 終端機 B：本機前端，使用 demo-boardgame，不會連線正式專案
npm run dev:emulator
```

前端預設 http://localhost:5173，Emulator UI 為 http://127.0.0.1:4000。Emulator 模式完全忽略真實 Firebase Web 設定，無須先建立雲端資料庫。請等終端機出現「All emulators ready」再建房。

若 Windows 找不到 Java，可在終端機 A 設定已安裝的 JDK，例如 Android Studio 附帶的 JBR：

```powershell
$env:JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr'
$env:PATH = "$env:JAVA_HOME/bin;$env:PATH"
npm run emulators
```

使用一般視窗與無痕視窗，或不同瀏覽器，代表不同玩家。同一瀏覽器的分頁共用 Firebase uid。每位玩家輸入暱稱，建立／加入房間，所有人準備後由房主開始。一般遊戲過程不需重新整理；重新整理會保留身份、房間與已提交的操作。

## 連接既有 Firebase 專案

專案 ID：`boardgame-online-platform`，既有 Web App：`1:769265872941:web:02f295d845103fbd5a48a4`。請沿用此專案，無須重新註冊 App。

目前程式與本機驗證已完成，**正式 Firebase 專案存取、Console 設定與部署尚未驗證**。這次工具登入帳號無法選取此專案；提供 Web config 並不等於具有部署權限。

1. 以有專案權限的帳號進入 Firebase Console。
2. **Authentication → Sign-in method → Anonymous**：啟用匿名登入。
3. **Realtime Database → Create database**：選擇適合台灣玩家的可用亞洲區域，例如 Console 若提供 Singapore (`asia-southeast1`)，並以 locked mode 建立。資料庫區域與 Functions 區域不必相同。
4. 複製 Console 顯示的完整資料庫 URL，不要自行猜測。
5. 將 `client/.env.example` 複製為 `client/.env.local`，填入 API key 與 `VITE_FIREBASE_DATABASE_URL`。此工作目錄已放入使用者提供的 Web config，仍留白尚未取得的 database URL；該檔案被 Git 忽略。
6. 將 `functions/.env.example` 複製為 `functions/.env.boardgame-online-platform`，`DATABASE_URL` 填相同的實際 URL。這也適用於具名或非預設資料庫。
7. Functions 使用第二代 callable functions、Node.js 22、`asia-east1`。部署前確認專案已啟用 **Blaze 計費**及具備部署權限；本次沒有更動計費或進行正式部署。

`client/.env.local` 的主要欄位：

| 變數 | 用途 |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Console 提供的 Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `boardgame-online-platform.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | Console 顯示的實際 Realtime Database URL |
| `VITE_FIREBASE_PROJECT_ID` | `boardgame-online-platform` |
| `VITE_FIREBASE_APP_ID` | 既有 Web App ID |
| `VITE_FIREBASE_FUNCTIONS_REGION` | `asia-east1`，必須與 Functions 原始碼相同 |

其餘 Web metadata 已列於範例檔。Web API key 是客戶端識別資訊；真正的授權由 Auth、Security Rules 與伺服器驗證實現。不要將 service account JSON 或 Admin SDK 私鑰放進前端。此 MVP 不啟用 Analytics。

環境變數會在 Vite 建置時寫入前端；修改後應重新啟動開發伺服器或重新建置。缺少設定時會顯示可操作的提示。

```sh
# 使用正式 Firebase 的本機前端；先完成下方 Functions/rules 部署
npm run dev
```

## 驗證

```sh
npm run build
npm run lint
npm test
```

`npm test` 執行 Avalon、兩版驚爆倫敦、AI 命名／策略及同房異夢的規則測試。`lint` 包含前端 ESLint 與 Functions 嚴格 TypeScript 檢查。

```sh
# 自行啟動並關閉 Emulator，需 Java；執行時不可已有相同 port 的 Emulator
npm run test:integration

# 若 Emulator 已在執行，直接跑整合測試
npm run test:services

# Emulator 已執行時：多人 Avalon、AI 練習及四個同房異夢劇本跑完整遊戲
npm run test:e2e
```

E2E 會自行啟動測試前端（5174）。`playwright.config.ts` 預設 Edge；其他作業系統可移除 `channel: 'msedge'` 並執行 `npx playwright install chromium`。截圖與測試結果位於忽略的 `.tools/`。

測試涵蓋：5–10 人配置、第四輪雙敗、過半表決、五次否決、三次任務成敗、兩種刺殺結局、身份知識、禁止正義出 Fail、重複票、錯誤階段、並發入房／投票、滿房、房主交接、離線清理、私人資料／寫入權限、重新整理、重開局，以及 360／390／430／768／1280 px 版面。

## 部署

確認 `.firebaserc`、兩端環境變數、Blaze 與登入帳號後，先部署規則及 Functions，再部署前端。不要以公開 test rules 取代本專案規則。

```sh
npx firebase login
npx firebase projects:list
npm run build
npx firebase deploy --project boardgame-online-platform --only database,functions
npx firebase deploy --project boardgame-online-platform --only hosting
```

若資料庫為非預設具名 instance，請先在 Firebase CLI 設定該 database target，並將 `firebase.json` 的 database 設定指向該 target，確保規則部署至 `DATABASE_URL` 對應的 instance。

Hosting 使用 `client/dist` 並將所有前端路由導回 `index.html`。在 Authentication 的 Authorized domains 檢查部署網域與 localhost；本機連線正式專案時依 Console 狀態加入 localhost。

## 架構與資料保密

```text
client/src/app/              路由、玩家 context
client/src/pages/            暱稱、大廳、建房／加入、房間
client/src/firebase/         Web SDK 設定、callable API
client/src/hooks/            Auth、Realtime 訂閱、presence、操作狀態
client/src/games/            遊戲目錄、Avalon 與驚爆倫敦 UI
functions/src/shared/       純型別、角色名稱、人數／任務規則（前後端共用）
functions/src/engine.ts      Avalon 狀態機，僅伺服器執行
functions/src/timebomb-engine.ts  驚爆倫敦基礎／進化狀態機
functions/src/bots.ts        限定情報的 AI 策略與行動派送
functions/src/index.ts       Auth 驗證、房間操作、RTDB 交易
tests/                      規則、整合、瀏覽器測試
server/                     Time Bomb 參考程式及原規則書
client/legacy/              原 Socket.IO React 畫面備份
```

```text
sessions/{code}/
  public/     房間、玩家、公開遊戲狀態；僅成員可讀，僅伺服器可寫
  private/    每位 uid 的 Avalon 角色與知識；本人可讀，僅伺服器可寫
  timebombPrivate/ 每位 uid 的陣營及手牌組成；本人可讀，僅伺服器可寫
  decorumPrivate/ 每位 uid 的秘密條件及合法收到的分享；本人可讀，僅伺服器可寫
  secret/     未結算投票及驚爆倫敦實際牌序；客戶端一律不可讀寫
  presence/   uid/connections 與 lastSeen；成員可讀，僅本人可寫
```

客戶端不能讀取整個 session、private 根節點或其他人的角色。父節點沒有讀權限，避免權限繼承洩漏。僅在終局或中止後公開角色；任務票結算後清除，只保留失敗票張數與隊伍。

所有建房、入房、準備、開局、投票與結算透過 callable functions。每個房間的公開／私人資料、presence 在同一個 RTDB 交易內變更。驗證失敗會中止交易；伺服器生成的隨機種子與 game ID 在重試時固定。玩家順序與角色使用不同隨機串流。遊戲操作攜帶 game ID、回合、階段與提案次數，拒絕過期操作。

Presence 使用每個分頁獨立 connection 與 `onDisconnect`。重新整理不移除成員。離線超過 90 秒可由任何留在房間的玩家清理；清理時與重新連線一起交易，避免使用過期判斷。房主明確離開或被清理時，依加入時間、uid 排序交接給最早玩家。最後一人離開則刪除 session。

Avalon／驚爆倫敦遊戲中明確離開或被清理時，由 AI 保留座位及秘密資訊接手至本局結束。同房異夢則中止本局並揭曉所有心願，新房主可再開一局。短暫離線仍可等待玩家重連。

## 範圍與已知限制

- 開放朋友房與單人練習，未加入公開配對、自由聊天、排行榜或 Mordred／Oberon。
- AI 由在線真人瀏覽器呼叫 `advanceBots` 推進；所有真人關閉頁面後暫停，重連後繼續。策略 AI 不提供自然語言理解或聊天模型。
- 匿名身份依瀏覽器儲存；清除網站資料或換瀏覽器會成為新玩家。
- 空置但未明確離開的房間沒有排程清除；任務歷史保留在房內，不提供永久戰績。
- App Check、每帳號建房頻率限制及配額監控尚未加入；公開大規模營運前需補上。Security Rules 已防止跨玩家讀取及非法遊戲寫入。
- Firebase／Google SDK 部分間接依賴仍有 npm audit moderate 通報，詳見實作狀態文件；沒有為消除通報而強制降級 SDK。
- `server/` 保留為參考；若單獨研究舊程式可在該目錄 `npm install`，新平台不需要啟動 localhost:3001。

Firebase 官方參考：[callable functions](https://firebase.google.com/docs/functions/callable)、[presence 與 onDisconnect](https://firebase.google.com/docs/database/web/offline-capabilities)、[Emulator Suite](https://firebase.google.com/docs/emulator-suite)。
