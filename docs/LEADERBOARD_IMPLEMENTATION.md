# 勝場排行榜

大廳 `/games` 的「勝場排行榜」開啟原生 modal。預設依總勝場降冪，可切換六款遊戲；每列列出所有遊戲勝場與合計，同勝場並列名次。每榜最多 5 位有勝場的會員，另顯示自己的累積勝場，即使自己未上榜仍可查看。支援重新整理、載入／空榜／錯誤狀態、Escape、焦點還原與手機橫向捲動表格。

## 計分

- 以 Firebase Authentication UID 累計，查榜時優先使用帳號目前的 `displayName`，沒有帳號暱稱時才沿用結算紀錄的房間暱稱；改名不會建立另一份戰績，也不會被舊房間的延遲結算覆蓋。
- 朋友房中獲勝的真人每局 +1；有 AI 補位的朋友房仍計真人勝場。單人 practice、AI、離席後由 AI 接手的座位不計。
- 阿瓦隆依結算公開身分與勝方；驚爆倫敦兩版本分開累計陣營勝場。
- 同房異夢合作成功全員 +1；失敗／離席中止不計。
- 璀璨寶石與教父風雲使用引擎最後的 winners（包含並列與特殊角色）；中止不計。
- 啟用後的新結算開始記錄，不回補過去已刪除或重開的對局。

## Firebase

遊戲同步與在線狀態使用 Realtime Database；排行榜使用現有 Cloud Firestore `(default)`、Standard edition、台灣 `asia-east1`。沿用 Firebase Admin SDK，無新增前端 Firestore 依賴。

房間 `mutate` transaction 僅在 playing → finished 且有合資格贏家時，原子寫入 `sessions/{code}/settlements/{matchId}`。紀錄只包含比賽 ID、遊戲 ID、贏家 UID／暱稱與結算時間；不包含牌局或歷史資料。`recordGameWins` 使用 `onValueCreated` 監聽此小型紀錄，一般準備／投票／出牌不再觸發排行榜函式。RTDB 觸發器位於現有資料庫的新加坡 `asia-southeast1`，Emulator 則使用 `us-central1`。[官方觸發器說明](https://firebase.google.com/docs/functions/database-events)

Firestore 分為兩個集合：

- `playerStats/{uid}`：uid、nickname、固定六款遊戲 wins、totalWins、updatedAt。文件大小不隨對局次數增長。
- `gameResults/{matchId}`：不可變結算紀錄及去重收據，與所有贏家的統計在同一個 Firestore transaction 提交。重送先檢查收據，不重複加分；讀取所有贏家的統計後才開始寫入。[Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)

Firestore 提交成功後才移除 RTDB 待處理紀錄。若清理失敗，事件重試會先看到收據，再完成清理。即使房間立即重開／刪除，建立事件仍攜帶原始結算內容。RTDB 與 Firestore 不共用跨資料庫 transaction，此設計以原子待處理紀錄與冪等消費保護計分。若事件超過平台重試期限仍未處理，需人工檢查失敗事件；勿直接刪除 Firestore 收據再重播舊事件。

`firestore.rules` 拒絕所有客戶端直接讀寫；已註冊密碼登入的會員透過 `getLeaderboard` callable 查榜。Admin SDK 僅回傳暱稱、UID 與勝場，不回傳結算紀錄、電子郵件或私人角色。查詢使用 `where(score, ">", 0).orderBy(score, "desc").limit(5)`；Standard 自動單欄位索引涵蓋 totalWins 與 wins 子欄位，無須複合索引。結算紀錄與無查詢用途的欄位停用索引。相同分數依文件 ID 降冪保持穩定，畫面列並列名次；第 5 位同分玩家可能超出顯示上限。

前端每位 UID／每個榜單快取 60 秒，並合併同時發出的請求（含 React StrictMode）；切換帳號清除快取。手動重新整理清除此榜的前端快取。後端每個 Functions instance 對榜單再快取 60 秒並合併併發查詢，各榜可跨會員共用，但 `self` 永遠另外讀取本人文件。快取有數量上限且不保存失敗；沒有持續監聽或背景輪詢。兩層快取最多疊加約 120 秒，再加上結算傳遞時間；使用者仍需開啟／切換／重新整理才會看到新資料。

每次後端快取未命中讀最多 5 份排名統計與 1 份自己的文件；命中時只讀自己的 1 份。快取限單一 instance，冷啟動或擴容各自重新載入，不是全站共用快取。排行榜 UI 保留全部六款遊戲勝場，無須讀取 `gameResults`。每次 callable 另外批次查詢最多 6 位 Firebase Auth 使用者，以最新 `displayName` 組合回應；只取暱稱，不將完整帳號資料回傳前端。[Admin 批次取得使用者](https://firebase.google.com/docs/auth/admin/manage-users#bulk_retrieve_user_data)

頁首暱稱旁的鉛筆按鈕可修改自己的暱稱（1–20 字），使用已登入使用者的 `updateProfile` 儲存至 Auth。成功後立即更新頁首並清除自己的前端榜單快取；其他玩家的前端快取最多保留舊名 60 秒，可按重新整理取得新名。新建／加入房間使用新名，已在房間內的座位暱稱保留至下次入座。

## 部署

`npm run deploy` 已包含 Firestore 規則／索引、Functions、Realtime Database 規則與 Hosting；後端部署成功後才發布 Hosting。首次啟用前需一起部署這些項目。若曾使用 RTDB 版累積資料，應先規劃一次性匯入並保留舊收據，不能同時啟用兩套計分。

若排行榜出現 `Index not defined ... /playerStats ... .indexOn: totalWins`，代表線上的 `getLeaderboard` 仍是 RTDB 舊版。應重新建置並部署 Functions 與 Firestore 規則／索引，再發布 Hosting；新版查詢不使用 RTDB 的 `/playerStats`，不應以新增 RTDB 索引作為切換 Firestore 的修正。

若正式環境曾部署上一版 `recordGameWins`（written public 路徑），Firebase 可能拒絕原地改成 created settlements 觸發器；需在維護窗口停用舊觸發器，再部署新版。不要讓舊版 public 監聽與新版計分長期並存。

## 驗證

- `npm test`：六款計分、合作／並列、練習／AI／中止、一次結算、跨遊戲總和、快取合併／過期／錯誤／上限。
- `npm run emulators` 啟動 Auth、RTDB、Firestore 與 Functions 後，`node tests/leaderboard-integration.mjs` 驗證真正 gameAction 最後一步、Firestore 多贏家原子提交、重送、並行、刪房／再開、快取與會員權限。
- Emulator 啟動後 `npx playwright test tests/browser/leaderboard.spec.ts`：實際 callable 連線，以及畫面排序、空榜、錯誤重試、鍵盤關閉、焦點還原和 320／390／1280px 畫面。
