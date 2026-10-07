# -------------------------------------------------------------
# 全運具快遞媒合平台 (Multi-Modal Courier Platform) Dockerfile
# 使用輕量 Node.js 22 Alpine，具備原生 TypeScript Strip Types 支援
# -------------------------------------------------------------
FROM node:22-alpine

# 安裝基本診斷與健康檢查工具
RUN apk add --no-cache curl wget

WORKDIR /app

# 複製專案設定
COPY package.json ./

# 複製後端服務代碼與靜態展示網頁
COPY backend/ ./backend/
COPY public/ ./public/

# 設定雲端運行環境變數
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# 暴露服務連接埠 (雲端 PaaS 會依據此設定映射流量)
EXPOSE 3000

# 容器健康檢查 (向 API Hub 樞紐端點發送請求)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/hubs || exit 1

# 啟動命令：以原生 Node.js 執行 TypeScript 核心伺服器
CMD ["node", "--experimental-strip-types", "backend/src/server.ts"]
