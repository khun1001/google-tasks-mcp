# google-tasks-mcp

自建的 Google Tasks MCP server,透過 Google Tasks API 提供讀寫(CRUD)。
給 Claude Code 用來讀任務、產週報、管理任務。

## 提供的工具

| 工具 | 說明 |
|------|------|
| `list_tasklists` | 列出所有任務清單(id + 標題) |
| `create_tasklist` | 新增任務清單 |
| `list_tasks` | 列出任務,支援 `completedMin/Max`、`dueMin/Max` 日期區間(產週報用) |
| `get_task` | 取得單一任務完整內容 |
| `create_task` | 新增任務(可設 notes、due、子任務) |
| `update_task` | 更新任務欄位(title/notes/due/status) |
| `complete_task` | 標記完成 |
| `delete_task` | 刪除任務 |

---

## 🚀 給同事的快速安裝說明

跟著這 5 步做,約 5 分鐘就能在你自己的 Claude Code 用 Google Tasks。

### 事前準備
- 已安裝 **Node.js**(18 以上):終端機打 `node -v` 有版本號即可。
- 已安裝 **Claude Code**:終端機打 `claude --version` 有版本號即可。
- 準備好 `credentials.json`(見步驟 2)。

### 步驟

**1️⃣ 解壓縮 + 安裝**

把 zip 解壓到你想放的位置(路徑建議不要有特殊符號),在該資料夾開終端機執行:

```bash
npm install
npm run build
```

**2️⃣ 放入 `credentials.json`**

- **自己建**:照本文件下方〈一次性設定 → 1. 建立 GCP OAuth 憑證〉建立一組 **Desktop app** 憑證,下載後改名 `credentials.json` 放進資料夾。

**3️⃣ 用「你自己的」Google 帳號授權一次**

```bash
npm run auth
```

會自動開瀏覽器 → 選你自己的 Google 帳號 → 若出現「未驗證的應用程式」點 **進階 → 繼續前往** → 按 **允許**。
成功後資料夾會多出 `token.json`(這是你個人的存取憑證,**不要傳給任何人**)。

> ⚠️ 若這步出現 TLS/憑證錯誤,先暫時關閉防毒軟體的「HTTPS 掃描」再重試。

**4️⃣ 註冊到 Claude Code**

把下面路徑換成你「解壓後資料夾」的絕對路徑(注意結尾是 `\build\index.js`):

```bash
claude mcp add google-tasks -s user -- node "C:\你的路徑\google-tasks-mcp\build\index.js"
```

驗證有沒有成功:

```bash
claude mcp list
```

看到 `google-tasks: ... - ✓ Connected` 就對了。

**5️⃣ 重開 Claude Code**

關掉再重開(或開新 session),就能直接對 Claude 說「列出我的任務」「幫我產週報」。

### 常見問題
- **`claude mcp list` 顯示 ✗ 或紅字**:多半是步驟 4 路徑打錯,或還沒做步驟 2/3。重新確認絕對路徑、`credentials.json` 有放、`token.json` 有產生。
- **叫不到 google-tasks 工具**:MCP 只在「開啟 session 時」載入,務必**重開** Claude Code。
- **讀不到「被指派」的任務(有 👥 圖示)**:本 server 的 `list_tasks` 已預設帶 `showAssigned:true`,正常可讀到;若自行改過參數記得保留。

### ⚠️ 安全提醒
`token.json` = 你 Google 帳號的存取權,`credentials.json` = 機密。**這兩個檔都不要外傳、不要上傳公開 Git**(本專案已用 `.gitignore` 擋掉)。

---

## 一次性設定

### 1. 建立 GCP OAuth 憑證

1. 開 https://console.cloud.google.com/ ,選一個專案(或新建)。
2. **啟用 API**:APIs & Services → Library → 搜尋「Google Tasks API」→ Enable。
3. **OAuth 同意畫面**:APIs & Services → OAuth consent screen
   - User type 選 **Internal**(Workspace 帳號可用,最簡單);
     若不能選 Internal 就選 **External**,並在 Test users 加入自己的 email。
   - 填 App name、support email、developer email 即可。
4. **建立憑證**:APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type 選 **Desktop app** → Create。
   - 點 **Download JSON**。

### 2. 放置憑證並授權

1. 把下載的 JSON 改名為 `credentials.json`,放進這個資料夾根目錄。
2. 在這個資料夾執行:

   ```bash
   npm install
   npm run build
   npm run auth
   ```

   `npm run auth` 會開瀏覽器 → 用公司帳號登入 → 同意授權。
   成功後會產生 `token.json`(存 refresh token,之後不用再登入)。

   > ⚠️ 若 `npm run auth` 出現 TLS/憑證錯誤,先暫時關閉 Avast 的 HTTPS 掃描再重試

### 3. 把 MCP server 加進 Claude Code

在任意終端機執行(user scope,全域可用):

```bash
claude mcp add google-tasks -s user -- node "C:\Users\w7426\Desktop\claude code\google-tasks-mcp\build\index.js"
```

然後**重開 Claude Code**,下一個 session 就會出現 `google-tasks` 的工具。

## 重新授權

刪掉 `token.json` 再跑一次 `npm run auth` 即可。
