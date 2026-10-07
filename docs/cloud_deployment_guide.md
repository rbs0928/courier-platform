# 24 小時雲端主機搬遷與發布手冊 (Step 1 完整指引)

本指南引導您將**全運具跨城／跨國順路捎帶快遞媒合平台**從本機環境搬遷至 24 小時不中斷運作的雲端伺服器。

---

## 📦 已就緒的雲端發布資產

專案根目錄目前已具備以下生產級設定：
1. **`Dockerfile`**：採用輕量 `node:22-alpine`，內建健康檢查 (`/api/hubs`) 與 TypeScript 原生直譯。
2. **`.dockerignore`** 與 **`.gitignore`**：嚴格過濾暫存檔、金鑰與本地快取。
3. **`.env.example`**：雲端環境變數標準範本。
4. **`zeabur.json`**：亞太極速雲端平台 Zeabur 一鍵部署規格。
5. **`render.yaml`**：國際雲端平台 Render 自動化 Blueprint 規格。
6. **Git 本機倉庫**：已初始化完畢並完成初始提交 (`main` 分支)。

---

## 步驟 1-1：推送代碼至 GitHub 雲端倉庫

1. 前往 [GitHub.com](https://github.com/) 並登入（若無帳號請免費註冊）。
2. 點選右上角的 **「+」 -> 「New repository」**。
3. 輸入倉庫名稱（例如：`courier-platform`），設為 **Public** 或 **Private** 皆可，**不要**勾選 Initialize with README（我們本地已有完整專案）。
4. 點選 **「Create repository」**。
5. 複製 GitHub 提供的倉庫網址（例如：`https://github.com/<你的帳號>/courier-platform.git`）。
6. 在本機終端機（或由我為您執行）輸入：
   ```bash
   git remote add origin https://github.com/<你的帳號>/courier-platform.git
   git push -u origin main
   ```

---

## 步驟 1-2：選擇雲端平台並一鍵上線（推薦 Zeabur）

### 🌟 方案 A：Zeabur（最推薦，台灣/亞洲節點延遲僅 15ms，全中文介面）
1. 前往 [zeabur.com](https://zeabur.com) 並以 GitHub 帳號快速登入。
2. 點選 **「Create Project（建立專案）」**，選擇離台灣最近的區域（例如 Asia-East 東京節點）。
3. 點選 **「Deploy New Service」 -> 「Git」**，選取剛才建立的 `courier-platform` 倉庫。
4. Zeabur 會自動偵測到根目錄的 `Dockerfile`，點選確認後即開始自動建置。
5. 建置完成後（約 60 秒），進入服務設定中的 **「Networking（網域名稱）」**，點選 **「Generate Domain（產生免費域名）」**。
6. 您將立即獲得一個永久運行的網址：`https://courier-platform-xxxx.zeabur.app`，且自動配備 SSL 綠色安全鎖匙！

---

### 🌐 方案 B：Render（國際知名，免費額度充足）
1. 前往 [render.com](https://render.com) 註冊/登入。
2. 點選 **「New +」 -> 「Web Service」**。
3. 連結您的 GitHub 倉庫 `courier-platform`。
4. Runtime 選擇 **Docker**（Render 會自動套用 `Dockerfile`）。
5. 點選 **「Create Web Service」**。
6. 部署完成後即可取得 `https://courier-platform-xxxx.onrender.com`。

---

## 步驟 1-3：雲端資料庫擴充（選填，進階生產級）
本服務核心內建高效率記憶體資料庫 (`InMemoryStore`)，部署後可立即直接對外提供 API 與 Web 介面。
若日後需要持久化儲存：
- 在 Zeabur 或 Render 專案內點選 **「Prebuilt」 -> 「PostgreSQL」**。
- 將產生的連線字串填入服務的環境變數 `DATABASE_URL`，系統即可無縫切換至空間資料庫。
