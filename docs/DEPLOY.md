# 部署步驟：GitHub → Firebase → Vercel

這份文件從頭到尾走一次：把程式碼放上 GitHub、建立 Firebase 後端、把前端部署到 Vercel，最後建立第一個系統管理者。照順序做，每一步的最後都有「這樣就對了」的檢查方式。

最後更新：2026-11-17。Firebase 與 Vercel 的選單名稱偶爾會調整；找不到按鈕時，以功能名稱（例如 Authentication、Environment Variables）在該網站搜尋。

## 架構

```
瀏覽器 ──(載入網頁)──────────▶ Vercel          靜態檔案：index.html、app.js、app.css、config.js
   │
   └──(登入、讀寫資料)──────▶ Firebase        Authentication（帳號）＋ Cloud Firestore（資料）
                                              權限由 firestore.rules 決定
```

- **前端在 Vercel**：Vercel 從 GitHub 取得程式碼，執行 `npm run build`，把 `dist/` 發布成網站。
- **後端在 Firebase**：沒有自己的伺服器程式。網頁直接呼叫 Firebase 的 API，誰能讀寫什麼由 `firestore.rules` 把關。
- 兩邊靠三個環境變數接起來：`UCMS_MODE`、`FIREBASE_PROJECT_ID`、`FIREBASE_API_KEY`。

## 事前準備

| 需要 | 用途 |
|---|---|
| GitHub 帳號 | 放程式碼 |
| Google 帳號 | 建立 Firebase 專案 |
| Vercel 帳號（建議直接用 GitHub 登入） | 部署前端 |
| 本機 Node.js 22、24 或 26 | 建置與測試 |
| 本機 JDK 21 以上 | 只有跑模擬器與整合測試需要，部署本身不需要 |

Firebase（Spark 方案）與 Vercel（Hobby 方案）目前都有免費方案；額度與使用條款以兩邊的官方頁面為準。

## 第 1 步：在本機確認專案是好的

在專案資料夾開啟終端機：

```bash
npm install
npm test
npm run build
```

有裝 JDK 21 的話再跑一次整合測試（會自動啟動並關閉模擬器）：

```bash
npm run test:integration
```

**這樣就對了**：`npm test` 顯示 `pass 13`、`fail 0`；`npm run build` 顯示「已建置 dist/」；整合測試顯示 `pass 11`、`fail 0`。

## 第 2 步：上傳到 GitHub

1. 在專案資料夾執行：
   ```bash
   git init
   git add .
   git status
   ```
2. 看 `git status` 列出的檔案。**不應該**出現 `.env`、`node_modules/`、`dist/`、`.emulator-data/`、`.emulator-cache/`。這些已經寫在 `.gitignore`，正常不會出現；如果出現了，先不要 commit。
3. 建立第一個 commit：
   ```bash
   git commit -m "UCMS：初始版本"
   git branch -M main
   ```
4. 到 GitHub 右上角「＋」→ **New repository**。輸入名稱（例如 `ucms`），**不要**勾選自動產生 README、.gitignore 或 license，按 **Create repository**。
5. 把本機的程式碼推上去（網址換成你的）：
   ```bash
   git remote add origin https://github.com/<你的帳號>/<repository 名稱>.git
   git push -u origin main
   ```

**這樣就對了**：重新整理 GitHub 的 repository 頁面，看得到 `src/`、`docs/`、`vercel.json`、`firestore.rules`。

> 建議把 repository 放在「要用來登入 Vercel 的那個人」的個人帳號底下。Vercel 的免費方案對組織帳號的 repository 與多人協作有限制，放在個人帳號最單純。

## 第 3 步：建立 Firebase 專案（後端）

### 3.1 建立專案

1. 開啟 [Firebase Console](https://console.firebase.google.com/)，用 Google 帳號登入。
2. 按建立專案（Create a project／Add project），輸入專案名稱，例如 `ucms`。
3. 名稱下方會顯示自動產生的**專案 ID**（例如 `ucms-1a2b3`）。這個 ID 之後不能改，先記下來。
4. Google Analytics 與 Gemini 都可以關掉，這個專案用不到。按 **Create project**。

### 3.2 註冊 Web 應用程式，取得兩個設定值

1. 在專案總覽頁按 Web 圖示（`</>`）。
2. 輸入暱稱（例如 `ucms-web`）。**不要**勾選 Firebase Hosting，前端放在 Vercel。按 **Register app**。
3. 畫面會顯示一段 `firebaseConfig`。只需要其中兩個值：
   - `projectId` → 之後填到 `FIREBASE_PROJECT_ID`
   - `apiKey` → 之後填到 `FIREBASE_API_KEY`
4. 之後想再看一次：左上角齒輪 → **Project settings** → **General** → 往下找到 **Your apps**。

`apiKey` 是公開的識別碼，會出現在網頁原始碼裡，這是正常的；資料安全靠的是 `firestore.rules`。真正不能外流的是「服務帳戶金鑰」（一個 `.json` 檔），這個專案不需要它，也請不要下載或提交。

### 3.3 啟用電子郵件／密碼登入

1. 左側選單 **Security** → **Authentication**（舊版選單在 **Build** 底下），第一次進入按 **Get started**。
2. 切到 **Sign-in method** 分頁，選 **Email/Password**。
3. 打開第一個開關 **Email/Password**（第二個「Email link」不要開），按 **Save**。

### 3.4 建立 Firestore 資料庫

1. 左側選單 **Databases & Storage** → **Firestore**（舊版選單是 **Build** → **Firestore Database**），按 **Create database**。
2. 如果畫面詢問版本，選 **Standard edition**；資料庫 ID 維持預設的 `(default)`。
3. 位置選 **asia-east1（Taiwan）**。位置建立後不能更改。
4. 安全規則的起始模式選 **Production mode**（先全部拒絕，下一步再換成專案的規則）。按 **Create**。

### 3.5 發布安全規則

這一步決定所有角色權限，**一定要做**；沒做的話網站會顯示「你沒有此操作的權限」。兩種做法擇一。

**做法 A：在網頁上貼上（最簡單）**

1. 在 Firestore 頁面切到 **Rules** 分頁。
2. 把編輯器裡原本的內容全部刪掉。
3. 用文字編輯器開啟專案裡的 `firestore.rules`，全選、複製，貼到編輯器。
4. 按 **Publish**。

**做法 B：用指令（之後改規則時比較方便）**

```bash
npx firebase login
npx firebase deploy --only firestore:rules --project <你的專案 ID>
```

用 `--project` 指定專案，不需要修改 `.firebaserc`（它保留給本機模擬器用的 `demo-ucms`）。

**這樣就對了**：Rules 分頁顯示的內容第一行是 `rules_version = '2';`，而且看得到 `match /clubs/{c}`。

## 第 4 步：把前端部署到 Vercel

### 4.1 匯入 GitHub 的 repository

1. 開啟 [vercel.com](https://vercel.com/)，用 GitHub 帳號登入。
2. 在 Dashboard 按 **Create New**（舊版是 **Add New…**）→ **Project**。
3. 在 **Import Git Repository** 找到剛才的 repository，按 **Import**。如果清單裡沒有，按 **Adjust GitHub App Permissions**，授權 Vercel 讀取該 repository。
4. 設定畫面的 Framework Preset、Build Command、Output Directory **都不用改**。專案裡的 `vercel.json` 已經指定：Framework 為 Other、建置指令 `npm run build`、輸出資料夾 `dist`。

### 4.2 填入三個環境變數

在同一個設定畫面展開 **Environment Variables**，新增下面三筆（名稱要完全一樣，全大寫）：

| Name | Value |
|---|---|
| `UCMS_MODE` | `production` |
| `FIREBASE_PROJECT_ID` | 3.2 記下的 `projectId` |
| `FIREBASE_API_KEY` | 3.2 記下的 `apiKey` |

值的前後不要有引號或空白。環境（Environments）維持預設的全部勾選。

### 4.3 部署

按 **Deploy**，等一到兩分鐘。完成後會得到一個網址，例如 `https://ucms-xxxx.vercel.app`。

**這樣就對了**：

- 建置紀錄（Build Logs）最後有一行「已建置 dist/ — 模式：production（專案 你的專案 ID）」。
- 開啟網址看得到登入頁，而且登入表單下方**沒有**「本機模擬器模式」那行字。

如果忘了填環境變數，建置會直接失敗並列出缺少哪一個，不會部署出一個連不到後端的網站。補上之後到 **Deployments** 分頁，在最新一筆右側的「⋯」選 **Redeploy**。

### 4.4 把 Vercel 網域加入 Firebase（建議）

1. 回到 Firebase Console → **Authentication** → **Settings** 分頁 → **Authorized domains**。
2. 按 **Add domain**，填入 Vercel 給的網域（不含 `https://`，例如 `ucms-xxxx.vercel.app`）。

目前的電子郵件／密碼登入不依賴這份清單，但先加上去，日後若增加其他登入方式就不會卡住。

## 第 5 步：建立第一個系統管理者與社團

系統管理者不能從網站介面指定，這是刻意的設計；第一位必須在 Firebase Console 手動建立。

1. 開啟 Vercel 的網址，按「建立帳號」，用你自己的電子郵件註冊。
2. 登入後會看到「還沒有任何社團」。按右上角的人像圖示「帳號資訊」，按 **複製 UID**。
3. 到 Firebase Console → **Firestore** → **Data** 分頁，按 **Start collection**：
   - Collection ID 填 `admins`，按 Next。
   - Document ID 貼上剛才複製的 UID（不要用 Auto-ID）。
   - 新增一個欄位：Field 填 `note`、Type 選 `string`、Value 填 `系統管理者`。按 **Save**。
4. 回到網站重新整理。現在會出現「建立社團」按鈕。
5. 建立社團後，到側欄的「團隊管理」→「加入成員」。請幹部先各自註冊帳號、把自己的 UID 給你，再依序加入並指定角色（核心幹部、幹部、財務幹部、社員）。

**這樣就對了**：重新整理後側欄出現完整的選單，「團隊管理」看得到成員名單。

正式環境沒有示範資料。`npm run seed` 只會對本機模擬器執行，不會也不能寫入正式專案。

## 第 6 步：上線後檢查

用兩個帳號（一個系統管理者或核心幹部、一個剛註冊未加入社團的帳號）各走一次：

- [ ] 未登入時開啟 `網址/#/public` 看得到公開活動頁。
- [ ] 註冊新帳號後看到「你還沒有加入任何社團」，而不是錯誤訊息。
- [ ] 核心幹部可以新增公告、任務、會議、活動，重新整理後資料還在。
- [ ] 把活動設為公開後，未加入社團的帳號可以在公開頁報名。
- [ ] 角色是「幹部」的帳號看不到「財務收支」；核心幹部與財務幹部看得到。
- [ ] 社員直接輸入 `網址/#/finance` 會看到「你沒有檢視這個頁面的權限」。
- [ ] 手機開啟網址，選單可以開關、頁面沒有左右捲動。

## 之後怎麼更新

- **改程式**：`git push` 到 `main`，Vercel 會自動重新建置並上線。推到其他分支會產生預覽網址，不影響正式網站。
- **改 `firestore.rules`**：Vercel 不會幫你發布規則。改完要再做一次第 3.5 步，並先跑 `npm run test:integration` 確認規則沒有改壞。
- **改環境變數**：在 Vercel 專案的 **Settings** → **Environment Variables** 修改後，要 **Redeploy** 才會生效。

## 常見問題

| 現象 | 原因 | 處理 |
|---|---|---|
| Vercel 建置失敗，訊息是「設定不完整」 | 三個環境變數沒填、名稱打錯，或 `UCMS_MODE` 不是 `production` | 依訊息補上，然後 Redeploy |
| 登入時出現「網站設定的 Firebase Web API Key 無效」 | `FIREBASE_API_KEY` 貼錯或多了空白、引號 | 回 3.2 重新複製，更新環境變數後 Redeploy |
| 「這個 Firebase 專案尚未啟用 Authentication」或「尚未啟用『電子郵件／密碼』登入」 | 第 3.3 步沒做完 | 完成 3.3 |
| 「這個 Firebase 專案尚未建立 Firestore 資料庫」 | 第 3.4 步沒做，或資料庫 ID 不是 `(default)` | 完成 3.4 |
| 公開頁或登入後出現「你沒有此操作的權限，或資料未符合規則」 | 規則還是起始的全部拒絕，或 `FIREBASE_PROJECT_ID` 填成別的專案 | 完成 3.5；核對專案 ID |
| 登入後一直是「還沒有任何社團」而且沒有「建立社團」按鈕 | `admins` 文件的 ID 和你的 UID 不一致，或建在別的集合 | 回第 5 步核對 UID（大小寫要完全相同） |
| 登入頁出現「本機模擬器模式」 | 部署到的是模擬器設定的版本 | 確認 `UCMS_MODE=production` 後 Redeploy |
| 別人打開網址被要求登入 Vercel | 分享的是預覽部署的網址 | 分享專案頁面上 **Domains** 列出的正式網址 |
| 組員 push 之後 Vercel 沒有自動部署 | 可能是免費方案對私人 repository 協作者的限制；Deployments 分頁會寫出原因 | 由 Vercel 帳號擁有者 push，或把 repository 設為公開 |
| 標題不是襯線字體 | Google Fonts 被網路擋住 | 不影響功能，會自動改用系統的宋體 |

## 這份流程驗證到哪裡

- **實際跑過**：在全新的資料夾執行 `npm install` 與 Vercel 環境的建置（Node.js 22、24、26）；用 Vercel CLI 的 `vercel build` 讀取 `vercel.json` 並產生輸出；缺少環境變數時建置失敗；正式模式的網頁會呼叫 Firebase 的正式端點，API Key 無效時顯示中文說明。
- **沒有跑過**：第 3 到 6 步需要你的 Google 與 Vercel 帳號，沒有在真正的 Firebase 專案與 Vercel 專案上執行。規則只在本機模擬器驗證過。

細節見 [`TESTING.md`](TESTING.md)。
