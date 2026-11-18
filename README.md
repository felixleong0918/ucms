# UCMS 大學社團整合管理平台

University Club Management System。把社團的公告、任務、會議、活動、財務與器材放在同一個地方，並依社團需要啟用盲注計時與活動回饋。依據《Web App Milestone 1 第 I 組專題報告》實作，需求驗證對象為台大撲克競技社與台大港澳會。

## 功能

| 報告 5.1 的項目 | 位置 |
|---|---|
| 1. 使用者登入及社團角色權限 | 登入頁、團隊管理、`firestore.rules` |
| 2. 公告、待辦事項及期限提醒 | 社團公告、我的任務、總覽、右上角的期限提醒 |
| 3. 行事曆及活動資訊管理 | 行事曆與活動 |
| 4. 活動報名、簽到及收費狀態登記 | 公開活動頁（報名）、活動管理（簽到與收費） |
| 5. 會議紀錄管理 | 會議紀錄，可把決議轉成任務 |
| 6. 財務收支及結餘管理 | 財務收支 |
| 7. 器材庫存管理 | 器材庫存（可選模組），每次數量變更都留下異動紀錄 |
| 8. 德州撲克盲注計時系統 | 盲注計時（可選模組），無廣告、可全螢幕 |
| 9. 活動回饋表單及回覆查詢 | 活動回饋（可選模組）、公開活動頁（填寫） |
| 10. 基本 Excel 資料匯出 | 報名名單、財務、庫存、回饋皆可匯出 `.xlsx` |
| 11. 手機及電腦響應式介面 | 全站；860px 以下改為抽屜式選單與單欄 |

不在這一版的範圍：AI 摘要、電子郵件通知、線上金流。

## 技術

- 前端：React 19、JavaScript、CSS（`src/styles.css`，無 UI 框架），以 esbuild 打包。
- 後端：Firebase Authentication、Cloud Firestore。前端透過 Firebase 的 REST API 存取，所有存取控制都在 `firestore.rules`。
- 部署：前端放在 Vercel（設定在 `vercel.json`），後端放在 Firebase。逐步說明見 [`docs/DEPLOY.md`](docs/DEPLOY.md)。
- 本機開發：Firebase Emulator（Auth + Firestore），不需要 Google 帳號。

## 快速開始

需要 **Node.js 22、24 或 26** 與 **JDK 21 以上**（Firebase Emulator 需要 Java）。macOS 可用 `brew install --cask temurin@21` 安裝 JDK。

```bash
npm install
npm run setup        # 建立 .env 並檢查環境
npm run emulators    # 啟動模擬器，保持開啟
```

另開一個終端機：

```bash
npm run seed         # 匯入示範資料（第一次執行即可）
npm run dev          # http://127.0.0.1:5173
```

模擬器的資料會在按 Ctrl+C 結束時存到 `.emulator-data/`，下次啟動自動載入。修改原始碼後重新執行 `npm run dev`。

### 模擬器無法下載時

第一次執行 `npm run emulators` 會從 `storage.googleapis.com` 下載 Firestore 模擬器（約 137 MB）。如果網路擋住這個網域，可以在能連線的地方手動下載，放到專案的 `.emulator-cache/`，腳本會優先使用：

```bash
mkdir -p .emulator-cache
curl -L -o .emulator-cache/cloud-firestore-emulator-v1.22.0.jar \
  https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar
```

這種情況下腳本會自動停用模擬器的管理介面（http://127.0.0.1:4000），其餘功能不受影響。

## 示範資料

`npm run seed` 會清空模擬器並建立兩個社團與下列帳號。所有人名、金額與內容都是示範用途，不是真實社團資料。

| 電子郵件 | 身分 |
|---|---|
| `admin@ucms.test` | 系統管理者（可建立社團、進入所有社團） |
| `poker.core@ucms.test` | 台大撲克競技社 · 核心幹部 |
| `poker.officer@ucms.test` | 台大撲克競技社 · 幹部 |
| `poker.finance@ucms.test` | 台大撲克競技社 · 財務幹部 |
| `poker.member@ucms.test` | 台大撲克競技社 · 社員 |
| `hkmo.core@ucms.test` | 台大港澳會 · 核心幹部 |
| `hkmo.officer@ucms.test` | 台大港澳會 · 幹部 |
| `hkmo.finance@ucms.test` | 台大港澳會 · 財務幹部 |
| `hkmo.member@ucms.test` | 台大港澳會 · 社員 |
| `guest@ucms.test` | 活動參加者（未加入任何社團） |

密碼都是 `ucms-demo-2026`，只存在於本機模擬器。撲克社啟用器材庫存與盲注計時，港澳會啟用活動回饋。

## 指令

| 指令 | 用途 |
|---|---|
| `npm run setup` | 建立 `.env`，並執行環境檢查 |
| `npm run doctor` | 檢查 Node、相依套件、JDK、連接埠與模擬器 |
| `npm run emulators` | 啟動 Auth 與 Firestore 模擬器 |
| `npm run seed` | 匯入示範資料到模擬器 |
| `npm run dev` | 建置並在 5173 連接埠預覽 |
| `npm run build` | 建置到 `dist/`（Vercel 部署時執行的就是這個指令） |
| `npm test` | 單元測試（不需要模擬器） |
| `npm run test:integration` | 啟動乾淨的模擬器並執行整合測試 |
| `npm run format` | 以 Prettier 統一程式碼格式 |

## 角色與權限

| | 系統管理者 | 核心幹部 | 財務幹部 | 幹部 | 社員 | 參加者 |
|---|---|---|---|---|---|---|
| 建立社團 | ✓ | | | | | |
| 成員、模組與社團設定 | ✓ | ✓ | | | | |
| 公告、任務、會議、活動 | ✓ | ✓ | ✓ | ✓ | | |
| 簽到與收費登記 | ✓ | ✓ | ✓ | ✓ | | |
| 財務收支 | ✓ | ✓（可刪除） | ✓ | | | |
| 器材庫存、盲注結構、回饋結果 | ✓ | ✓ | ✓ | ✓ | | |
| 查看並完成自己的任務 | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 公開活動、報名、填寫回饋 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

- 側欄只顯示有權限的頁面，但這只是介面上的方便；真正的限制寫在 `firestore.rules`，資料依社團完全隔離。
- 加入成員：請對方先註冊，從右上角「帳號資訊」複製 UID，交給核心幹部在「團隊管理」加入。
- 系統管理者不能從介面指定。模擬器由 `npm run seed` 建立；正式環境請在 Firebase Console 的 Firestore 手動新增文件 `admins/{該使用者的 UID}`。

## 專案結構

```
src/
  main.jsx            進入點：路由、角色權限與頁面切換
  context.jsx         登入狀態、社團切換、依角色載入資料
  firebase.mjs        Firebase Auth／Firestore REST 資料層
  domain.mjs          任務期限、金額、庫存、盲注計時等邏輯
  export.mjs          .xlsx 匯出
  styles.css          設計系統與所有樣式
  components/         共用元件（ui.jsx）、外框與導航（Shell.jsx）
  pages/              各功能頁面
scripts/              建置、預覽、模擬器、示範資料、環境檢查
tests/                單元測試與整合測試
firestore.rules       安全規則（角色權限與資料驗證）
vercel.json           Vercel 的建置與回應標頭設定
docs/                 部署步驟、設計決策與測試紀錄
design/index.html     最早的視覺草稿，僅供參考
```

資料模型：`users`、`admins`、`clubs`，以及每個社團底下的 `members`、`announcements`（含 `reads`）、`tasks`、`meetings`、`events`（含 `registrations`、`forms`、`responses`）、`transactions`、`inventory`、`inventoryMovements`、`blindStructures`。金額以「分」為單位的整數儲存。

## 測試

- `npm test`：任務期限、金額與結餘、庫存不可為負、盲注計時的暫停與級別切換、Excel 檔案內容、總覽標題、建置設定檢查、錯誤訊息對應。
- `npm run test:integration`：透過與網頁相同的資料層對模擬器發出請求，驗證登入、角色權限、跨社團隔離、會議轉任務、報名到簽到與收費、財務、庫存、盲注結構與回饋。

目前的驗證狀態與尚未完成的項目記錄在 [`docs/TESTING.md`](docs/TESTING.md)。

## 部署：前端 Vercel、後端 Firebase

完整的逐步說明（含每一步的檢查方式與常見問題）在 [`docs/DEPLOY.md`](docs/DEPLOY.md)。摘要：

1. **GitHub**：`git init`、`git add .`、`git commit`，建立空的 repository 後 `git push`。`.env`、`node_modules`、`dist`、模擬器資料都已列在 `.gitignore`。
2. **Firebase**：建立專案 → 註冊 Web 應用程式（記下 `projectId` 與 `apiKey`）→ 啟用「電子郵件／密碼」登入 → 建立 Firestore 資料庫（Production mode）→ 發布 `firestore.rules`。
3. **Vercel**：匯入 GitHub 的 repository，設定三個環境變數後部署。建置指令與輸出資料夾已寫在 `vercel.json`，不用另外設定。

   | 環境變數 | 值 |
   |---|---|
   | `UCMS_MODE` | `production` |
   | `FIREBASE_PROJECT_ID` | Firebase 的專案 ID |
   | `FIREBASE_API_KEY` | Firebase 的 Web API Key |

4. **第一個系統管理者**：在網站註冊帳號，複製 UID，到 Firestore 手動新增文件 `admins/{UID}`，再用這個帳號建立社團並加入核心幹部。

在 Vercel 上建置時，缺少上述任何一個環境變數都會讓建置失敗並指出缺少的項目，不會部署出連不到後端的網站。改了 `firestore.rules` 之後要另外重新發布規則，並先確認整合測試全數通過。

組員 clone 之後執行「快速開始」的指令即可在本機開發。`.env` 不會被提交，每個人各自執行 `npm run setup` 建立。

## 設計

Medium 的編輯式排版（襯線大標題、髮絲線、扁平列表）加上 Apple 的材質（黑白灰、藍色操作按鈕、Liquid Glass 導航與工具列），支援深淺色。色彩、字體與間距都定義在 `src/styles.css` 開頭的 token；完整決策見 [`docs/DECISIONS.md`](docs/DECISIONS.md)。

## 已知限制

- 修改原始碼後需要重新執行 `npm run dev`，沒有熱更新。
- 盲注計時的狀態存在瀏覽器，不跨裝置同步。
- 活動的收費狀態不會自動產生財務帳目，需另外在財務收支登記。
- 登入狀態存在分頁的 sessionStorage，關閉分頁後需重新登入。
- 襯線標題使用 Google Fonts 的 Noto Serif TC，離線時會退回系統宋體。
- 正式環境沒有示範資料；`npm run seed` 只對本機模擬器執行。
