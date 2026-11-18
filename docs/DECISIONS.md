# UCMS 專案決策

依據：《Web App Milestone 1 第 I 組專題報告》（Web app I組MS1.pdf）。最後更新：2026-11-18。

## 範圍

- React、JavaScript、CSS；Firebase Authentication、Cloud Firestore。
- 前端部署到 Vercel，後端使用 Firebase（見下方「部署」）。
- 先以 Firebase Emulator 完成本機前後端，附正式環境接入步驟。
- 完成報告 5.1 的 11 項 In Scope 功能。AI 摘要、電子郵件通知與線上金流已確認不在這一版。
- 不代為上傳 GitHub、不代為部署；由組員自行執行。專案維持在可直接 commit 的狀態，逐步說明見 `docs/DEPLOY.md`。
- 遇到影響需求或交付的問題先詢問使用者，不自行改變範圍。

## 部署（2026-11-17 使用者確認）

- **前端放在 Vercel，後端放在 Firebase。** 使用者曾提出把後端改到 Supabase，隨後決定維持 Firebase，並要求附上逐步的部署說明（`docs/DEPLOY.md`）。
- 不使用 Firebase Hosting，`firebase.json` 只保留 Firestore 規則與模擬器設定。
- `vercel.json` 指定建置指令（`npm run build`）、輸出資料夾（`dist`）與回應標頭；網址使用 `#/` 路由，不需要改寫規則。
- 正式環境的設定只有三個環境變數（`UCMS_MODE`、`FIREBASE_PROJECT_ID`、`FIREBASE_API_KEY`），填在 Vercel 專案設定，不寫進 repository。
- 在 Vercel 上建置時（偵測 `VERCEL` 環境變數）一律要求正式環境的設定，缺少就讓建置失敗，避免部署出指向本機模擬器的網站。
- `package.json` 的 Node.js 版本範圍為 `>=22 <27`：22、24、26 都實際建置並測試過；設定上限是為了不讓 Vercel 在新的主要版本推出時自動升級。
- 規則的發布與前端部署是分開的：改了 `firestore.rules` 要另外在 Firebase 發布。

## 設計（2026-11-17 使用者確認）

方向：**Medium 的編輯式排版＋Apple 的材質**。使用者先指定以 apple.com/tw 為參考，之後補充要參考 medium.com；兩者在按鈕顏色、標題字體與底色上衝突，經詢問後選定混合方案。

Design Read

- 類型：社團幹部的管理工作空間，另有公開的活動報名頁。
- 對象：社團幹部（桌面與手機）、活動參加者（多為手機）。
- 視覺語言：襯線大標題與髮絲線構成的編輯式版面，放在黑白灰的 Apple 材質上。
- 模式：延續既有草稿（`design/index.html`）的資訊架構，重做視覺。
- 變化程度 4／動態 3／資訊密度 6／圖像依賴 2／風格忠實度 7。

設計系統（token 定義在 `src/styles.css` 開頭）

| 項目 | 決定 | 來源 |
|---|---|---|
| 標題 | 襯線：Noto Serif TC，後備系統宋體；字重 400–500，緊字距 | Medium |
| 內文 | 系統無襯線（SF／蘋方／Noto Sans TC），16px | Apple |
| 底色 | 白 `#FFFFFF`、灰 `#F5F5F7`、墨色 `#1D1D1F`、次要文字 `#6E6E73` | Apple |
| 操作 | 藍色膠囊按鈕 `#0071E3`，連結 `#0066CC` | Apple |
| 分隔 | 頁首下方 1px 墨色線，其餘用淺灰髮絲線；不用卡片陰影 | Medium |
| 列表 | 扁平列表、底線式分頁籤 | Medium |
| 卡片 | 僅用於活動、會議、公告：灰底色塊、22px 圓角、無邊框 | Apple |
| 導航 | Liquid Glass 側欄、右上工具列、公開頁導航、提示訊息 | Apple |
| 狀態色 | 紅 `#D70015`（逾期、刪除）、綠 `#1A8917`（收入、完成）、橘 `#B25000`（即將到期） | — |
| 間距 | 4／8／16／24／40／64 | — |
| 動態 | 200–300ms，只回應互動；遵循 prefers-reduced-motion | — |
| 深色 | 黑底、`#1C1C1E` 表面，連結改用 `#2997FF` | Apple |

文案規則

- 頁面標題上方不放英文小字，標題下方不放裝飾性副標。
- 保留有資訊量的文字：表單提示、日期、狀態、權限與資料說明。
- 示範資料一律標示為示範，不使用真實人名。

## 架構決定

- 資料層使用 Firebase 的 REST API（`src/firebase.mjs`），不引入 Firebase SDK；瀏覽器端沒有任何特權憑證，權限完全由 `firestore.rules` 決定。同一份資料層也用於種子資料與整合測試。
- 路由表（`src/main.jsx` 的 `ROUTES`）同時決定側欄與角色權限。前端只隱藏入口，規則才是實際的限制。
- 登入後先讀取自己在各社團的角色，社團切換器只列出自己所屬的社團；系統管理者可進入所有社團。
- 金額以「分」為單位的整數儲存，避免浮點誤差。
- 庫存數量只能透過「異動」改變；庫存與異動紀錄在同一次 commit 寫入，規則會交叉檢查兩者一致。
- 盲注計時以截止時間計算剩餘秒數，分頁在背景或重新整理後依實際時間校正；狀態存在瀏覽器。
- 報名與回饋以使用者 UID 為文件 ID，因此每人每場活動只有一筆。
- 系統管理者（`admins/{uid}`）不能從介面或前端寫入，只能由 Firebase Console 或模擬器種子資料建立。
- 資料層把後端的錯誤代碼轉成中文訊息，包含正式環境設定不完整的情況（API Key 無效、未啟用登入方式、未建立資料庫），讓部署的人能從畫面上判斷缺了哪一步。

## 資料模型

- `users/{uid}`：姓名與電子郵件，僅本人與系統管理者可讀。
- `admins/{uid}`：系統管理者。
- `clubs/{clubId}`：名稱、介紹、模組開關（inventory、timer、feedback）；公開可讀。
- `clubs/{clubId}/members/{uid}`：姓名、電子郵件、角色（core、officer、finance、member）。
- `announcements/{id}`（含 `reads/{uid}`）、`tasks/{id}`（保留 `meetingId`）、`meetings/{id}`。
- `events/{id}`，其下 `registrations/{uid}`、`forms/feedback`、`responses/{uid}`。
- `transactions/{id}`、`inventory/{id}`、`inventoryMovements/{id}`、`blindStructures/{id}`。

## 目前狀態

- 11 項功能的頁面、路由、登入、社團切換與角色權限已整合，`npm run build` 通過。
- 模擬器啟動、JDK 21 檢查、示範資料、單元測試與整合測試腳本已補齊。
- 2026-11-18 由使用者完成部署：前端 https://ucms-gamma.vercel.app/ ，後端為 Firebase 專案 `ucms-7a098`，程式碼在 GitHub 的 `felixleong0918/ucms`。
- 驗證進度與尚未完成的項目見 `docs/TESTING.md`。
