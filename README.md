# 全運具跨城／跨國順路捎帶快遞媒合平台 (Multi-Modal Crowdsourced Courier Platform)

打造結合日常通勤（捷運、公車）、跨城長途（高鐵、台鐵）與跨國航空（國際航班）的**順路閒置運力共享與包裹媒合平台**。

---

## 核心價值主張 (Core Value Proposition)

* **日常通勤族 (捷運/公車)**：上班順路在捷運站面交，補貼來回捷運車資（\$60 ~ \$120 TWD）。
* **跨城差旅商務客 (高鐵/台鐵)**：北高出差 1.5 ~ 3 小時直達，幫忙帶精密樣品/急件，補貼單程高鐵票價（\$350 ~ \$800 TWD）。
* **出國旅客與留學生 (航班)**：利用託運或手提行李箱閒置空間，幫忙捎帶合法特產與禮品，補貼機票費用（\$1500 ~ \$3000 TWD）。
* **寄件者**：享有比專程跨城專車快遞便宜 70%、比傳統跨日宅急便快 3 倍的極速直送體驗。

---

## 核心架構模組

1. **多運具分級計價引擎 (`PricingEngine`)**：
   - 依運具（捷運、公車、高鐵、台鐵、航空）動態計算基礎車資補貼、超重費、超額里程費、保價費與報關費。
   - 自動計算旅人實得收益與平台服務抽成（15% ~ 20%）。
2. **時空走廊軌跡匹配引擎 (`CorridorMatchingEngine`)**：
   - 空間走廊偏差計算（站點面交零偏差、路線容忍半徑 $\le 3\text{km}$）。
   - 時間窗相容性檢核（出發前取件留緩衝、抵達時間早於送達截止期限）。
   - 多維度評分模型（空間偏差 30 分 + 時間充裕度 15 分 + 旅人 KYC/評分 15 分）。
3. **安全合規與防護模組 (`ComplianceAndSafetyModule`)**：
   - 通用危險品與跨國境海關/動植物防檢疫違禁詞庫智慧過濾。
   - 旅人開箱驗視存證協定（現場當面開箱、檢視外觀、拍照上傳存證、當面封箱）。
   - 雙重動態 OTP 面交校驗（取件 OTP 驗證後始進入 `IN_TRANSIT`；簽收 OTP 驗證後始進入 `DELIVERED`）。
4. **第三方資金託管服務 (`EscrowWalletService`)**：
   - 媒合接單時全額鎖定寄件人款項進入 Escrow。
   - 送達簽收時毫秒級解鎖撥款至旅人錢包，確保履約安全。

---

## 快速啟動與驗證

專案依託 Node.js 原生 TypeScript 運行環境，無須繁瑣編譯：

```bash
# 1. 執行端到端完整互動模擬演示 (包含高鐵跨城急件與長榮航空東京跨境捎帶)
agy-node --experimental-strip-types scripts/demo_simulation.ts

# 2. 執行所有自動化測試
agy-node --experimental-strip-types backend/tests/pricing.test.ts
agy-node --experimental-strip-types backend/tests/corridor_matching.test.ts
agy-node --experimental-strip-types backend/tests/compliance_and_safety.test.ts
agy-node --experimental-strip-types backend/tests/api_server.test.ts

# 3. 啟動後端 RESTful API 伺服器 (Port 3000)
agy-node --experimental-strip-types backend/src/server.ts
```
