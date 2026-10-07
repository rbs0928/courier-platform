import type { TransportMode, PricingQuote } from '../../types/index.ts';

export interface PricingInput {
  transportMode: TransportMode;
  distanceKm: number;
  weightKg: number;
  declaredValueTwd: number;
  isInternational?: boolean;
}

export class PricingEngine {
  /**
   * 依據運輸工具、距離、重量與申報價值計算階梯費用分帳
   */
  public static calculateQuote(input: PricingInput): PricingQuote {
    let baseFare = 0;
    let weightFee = 0;
    let distanceFee = 0;
    let insuranceFee = 0;
    let customsFee = 0;
    let commissionRate = 0.15; // 預設 15% 平台抽成

    const { transportMode, distanceKm, weightKg, declaredValueTwd } = input;

    switch (transportMode) {
      case 'WALKING':
        baseFare = 60;
        weightFee = Math.max(0, weightKg - 1) * 10;
        distanceFee = Math.max(0, distanceKm - 1) * 15;
        commissionRate = 0.12;
        break;

      case 'MOTORCYCLE':
        // 機車外送／速克達順路捎帶：到府直送、靈活穿梭巷弄、即時性最高，實質補貼油資與機車保養耗損
        baseFare = 75; // 基礎起跳價 (包含前 3km 及 2kg，適合文件、餐飲、3C 配件、生活小包)
        weightFee = Math.max(0, weightKg - 2) * 12; // 超過 2kg 每公斤 +$12 TWD (機車踏板或車廂載重)
        distanceFee = Math.max(0, distanceKm - 3) * 12; // 超過 3km 每公里 +$12 TWD (精準補貼油資與機車磨耗)
        insuranceFee = Math.round(declaredValueTwd * 0.01);
        commissionRate = 0.15; // 平台抽成 15%
        break;

      case 'MRT':
      case 'BUS':
        // 市區大眾運輸：補貼日常通勤車資
        baseFare = 80;
        weightFee = Math.max(0, weightKg - 2) * 15;
        distanceFee = Math.max(0, distanceKm - 3) * 5;
        insuranceFee = Math.round(declaredValueTwd * 0.01);
        commissionRate = 0.15;
        break;

      case 'TRAIN':
        // 台鐵跨城：補貼火車票
        baseFare = 200;
        weightFee = Math.max(0, weightKg - 3) * 20;
        distanceFee = Math.max(0, distanceKm - 30) * 1.5;
        insuranceFee = Math.round(declaredValueTwd * 0.015);
        commissionRate = 0.15;
        break;

      case 'HSR':
        // 台灣高鐵跨城：3~4 小時極速互達，補貼 30%~60% 高鐵票價
        baseFare = 350;
        weightFee = Math.max(0, weightKg - 3) * 30;
        // 超過 100km 每 50km + $40 元 (如北高 300km 約增加 $160 元)
        distanceFee = Math.floor(Math.max(0, distanceKm - 100) / 50) * 40;
        insuranceFee = Math.round(declaredValueTwd * 0.02);
        commissionRate = 0.18;
        break;

      case 'FLIGHT':
        // 國際航班：以行李箱空間與重量分潤為主力，補貼廉航機票或超重費
        baseFare = 800; // 包含第 1 kg 與隨身手提空間
        weightFee = Math.max(0, weightKg - 1) * 400; // 每多 1kg +$400 TWD
        distanceFee = 0; // 航空以航程公斤為主
        customsFee = 200; // 報關與安全申報合規處理費
        insuranceFee = Math.round(declaredValueTwd * 0.03); // 國際保價 3%
        commissionRate = 0.20;
        break;

      case 'CAR':
        // 境內自駕私家車順路捎帶：利用後車廂與後座大空間，實質補貼車主國道油資與 eTag 過路費
        baseFare = 160; // 基礎起跳價 (包含前 5km 及 5kg 容量)
        weightFee = Math.max(0, weightKg - 5) * 10; // 超過 5kg 每公斤 +$10 TWD (適合大件、露營裝備或箱裝物品)
        if (distanceKm <= 20) {
          // 市區/中短程自駕：每超過 5km 每公里 +$12 TWD
          distanceFee = Math.max(0, distanceKm - 5) * 12;
        } else {
          // 跨縣市/國道長程自駕：前 20km 為 $180，後續每公里 +$7 TWD (精準補貼 95 無鉛汽油與國道計程通行費)
          distanceFee = 180 + (distanceKm - 20) * 7;
        }
        insuranceFee = Math.round(declaredValueTwd * 0.015);
        commissionRate = 0.16; // 平台抽成 16%
        break;
    }

    // 向上取整以利展示
    baseFare = Math.round(baseFare);
    weightFee = Math.round(weightFee);
    distanceFee = Math.round(distanceFee);
    insuranceFee = Math.max(10, Math.round(insuranceFee)); // 最低保費 $10 TWD

    const subtotal = baseFare + weightFee + distanceFee + insuranceFee + customsFee;
    const platformCommission = Math.round(subtotal * commissionRate);
    const travelerEarnings = subtotal - platformCommission;

    return {
      transportMode,
      baseFare,
      weightFee,
      distanceFee,
      insuranceFee,
      customsFee,
      platformCommission,
      travelerEarnings,
      totalAmount: subtotal,
      currency: 'TWD',
    };
  }
}
