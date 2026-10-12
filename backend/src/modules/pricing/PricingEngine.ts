import type { TransportMode, PricingQuote, UrgencyLevel } from '../../types/index.ts';

export interface PricingInput {
  transportMode: TransportMode;
  distanceKm: number;
  weightKg: number;
  declaredValueTwd: number;
  isInternational?: boolean;
  urgencyLevel?: UrgencyLevel; // 配送時效等級 (STANDARD | EXPRESS | RUSH)
}

export class PricingEngine {
  /**
   * 依據運輸工具、距離、重量、時效急件等級與申報價值計算階梯費用分帳 (支援 10 大運具)
   */
  public static calculateQuote(input: PricingInput): PricingQuote {
    let baseFare = 0;
    let weightFee = 0;
    let distanceFee = 0;
    let urgencyFee = 0;
    let estimatedHours = 3.0;
    let insuranceFee = 0;
    let customsFee = 0;
    let commissionRate = 0.15; // 預設 15% 平台抽成

    const { transportMode, distanceKm, weightKg, declaredValueTwd } = input;
    const urgencyLevel: UrgencyLevel = input.urgencyLevel || 'STANDARD';

    switch (transportMode) {
      case 'WALKING':
        baseFare = 60;
        weightFee = Math.max(0, weightKg - 1) * 10;
        distanceFee = Math.max(0, distanceKm - 1) * 15;
        commissionRate = 0.12;
        if (urgencyLevel === 'EXPRESS') { urgencyFee = 20; estimatedHours = 1.0; }
        else if (urgencyLevel === 'RUSH') { urgencyFee = 40; estimatedHours = 0.5; }
        else { estimatedHours = 2.0; }
        break;

      case 'BICYCLE':
        // 腳踏車 / YouBike 2.0 綠色順路捎帶：市區 1~5km 短距通勤送件，享有綠色低碳 12% 平台優惠抽成
        baseFare = 60; // 基礎起跳價 (涵蓋前 2km 及 2kg 隨身置物籃空間)
        weightFee = Math.max(0, weightKg - 2) * 8; // 超過 2kg 每公斤 +$8 TWD (上限 5kg)
        distanceFee = Math.max(0, distanceKm - 2) * 8; // 超過 2km 每公里 +$8 TWD
        insuranceFee = Math.round(declaredValueTwd * 0.01);
        commissionRate = 0.12; // 綠色低碳優惠抽成
        // 時效急件階梯加成 (如需更短時間送達，費用更高)
        if (urgencyLevel === 'EXPRESS') { urgencyFee = 30; estimatedHours = 1.0; } // 1小時快速送達
        else if (urgencyLevel === 'RUSH') { urgencyFee = 60; estimatedHours = 0.5; } // 30分鐘閃送直達
        else { estimatedHours = 2.5; } // 一般悠活順路
        break;

      case 'MOTORCYCLE':
        // 機車外送／速克達順路捎帶：到府直送、靈活穿梭巷弄、即時性最高，實質補貼油資與機車保養耗損
        baseFare = 75; // 基礎起跳價 (包含前 3km 及 2kg)
        weightFee = Math.max(0, weightKg - 2) * 12;
        distanceFee = Math.max(0, distanceKm - 3) * 12;
        insuranceFee = Math.round(declaredValueTwd * 0.01);
        commissionRate = 0.15; // 平台抽成 15%
        if (urgencyLevel === 'EXPRESS') { urgencyFee = 40; estimatedHours = 1.0; }
        else if (urgencyLevel === 'RUSH') { urgencyFee = 80; estimatedHours = 0.5; }
        else { estimatedHours = 2.0; }
        break;

      case 'MRT':
      case 'BUS':
        // 市區大眾運輸：補貼日常通勤車資
        baseFare = 80;
        weightFee = Math.max(0, weightKg - 2) * 15;
        distanceFee = Math.max(0, distanceKm - 3) * 5;
        insuranceFee = Math.round(declaredValueTwd * 0.01);
        commissionRate = 0.15;
        if (urgencyLevel === 'EXPRESS') { urgencyFee = 35; estimatedHours = 1.5; }
        else if (urgencyLevel === 'RUSH') { urgencyFee = 70; estimatedHours = 1.0; }
        else { estimatedHours = 3.0; }
        break;

      case 'TRAIN':
        // 台鐵跨城：補貼火車票
        baseFare = 200;
        weightFee = Math.max(0, weightKg - 3) * 20;
        distanceFee = Math.max(0, distanceKm - 30) * 1.5;
        insuranceFee = Math.round(declaredValueTwd * 0.015);
        commissionRate = 0.15;
        if (urgencyLevel === 'EXPRESS') { urgencyFee = 80; estimatedHours = 3.0; }
        else if (urgencyLevel === 'RUSH') { urgencyFee = 160; estimatedHours = 2.0; }
        else { estimatedHours = 5.0; }
        break;

      case 'HSR':
        // 台灣高鐵跨城：3~4 小時極速互達，補貼 30%~60% 高鐵票價
        baseFare = 350;
        weightFee = Math.max(0, weightKg - 3) * 30;
        distanceFee = Math.floor(Math.max(0, distanceKm - 100) / 50) * 40;
        insuranceFee = Math.round(declaredValueTwd * 0.02);
        commissionRate = 0.18;
        if (urgencyLevel === 'EXPRESS') { urgencyFee = 180; estimatedHours = 2.0; } // 下一班次優先
        else if (urgencyLevel === 'RUSH') { urgencyFee = 360; estimatedHours = 1.5; } // 即刻出發最速
        else { estimatedHours = 4.0; }
        break;

      case 'DOMESTIC_FLIGHT':
        // 國內航空：松山/台中/高雄 飛 澎湖馬公、金門、台東、花蓮、馬祖 (40~60分鐘極速跨島)
        baseFare = 480; // 包含前 2kg 隨身手提空間
        weightFee = Math.max(0, weightKg - 2) * 120; // 國內線超重每公斤補貼 +$120 TWD
        distanceFee = 150; // 離島跨海航線補貼
        customsFee = 0; // 國內航線免海關報關費
        insuranceFee = Math.round(declaredValueTwd * 0.02);
        commissionRate = 0.15;
        // 時效急件階梯加成 (如需更短時間送達，費用更高)
        if (urgencyLevel === 'EXPRESS') { urgencyFee = 280; estimatedHours = 2.0; } // 2小時下一航班優先捎帶
        else if (urgencyLevel === 'RUSH') { urgencyFee = 560; estimatedHours = 1.0; } // 60分鐘下班機直送 (Next-Flight-Out Rush)
        else { estimatedHours = 4.0; } // 當日一般航班
        break;

      case 'FLIGHT':
        // 國際航班：以行李箱空間與重量分潤為主力，補貼廉航機票或超重費
        baseFare = 800; // 包含第 1 kg 與隨身手提空間
        weightFee = Math.max(0, weightKg - 1) * 400; // 每多 1kg +$400 TWD
        distanceFee = 0; // 國際航空以航程公斤為主
        customsFee = 200; // 報關與安全申報合規處理費
        insuranceFee = Math.round(declaredValueTwd * 0.03); // 國際保價 3%
        commissionRate = 0.20;
        if (urgencyLevel === 'EXPRESS') { urgencyFee = 600; estimatedHours = 18.0; }
        else if (urgencyLevel === 'RUSH') { urgencyFee = 1200; estimatedHours = 8.0; }
        else { estimatedHours = 36.0; }
        break;

      case 'CAR':
        // 境內自駕私家車順路捎帶：利用後車廂與後座大空間，實質補貼車主國道油資與 eTag 過路費
        baseFare = 160;
        weightFee = Math.max(0, weightKg - 5) * 10;
        if (distanceKm <= 20) {
          distanceFee = Math.max(0, distanceKm - 5) * 12;
        } else {
          distanceFee = 180 + (distanceKm - 20) * 7;
        }
        insuranceFee = Math.round(declaredValueTwd * 0.015);
        commissionRate = 0.16;
        if (urgencyLevel === 'EXPRESS') { urgencyFee = 150; estimatedHours = 2.5; }
        else if (urgencyLevel === 'RUSH') { urgencyFee = 300; estimatedHours = 1.5; }
        else { estimatedHours = 5.0; }
        break;
    }

    // 向上取整以利展示
    baseFare = Math.round(baseFare);
    weightFee = Math.round(weightFee);
    distanceFee = Math.round(distanceFee);
    urgencyFee = Math.round(urgencyFee);
    insuranceFee = Math.max(10, Math.round(insuranceFee)); // 最低保費 $10 TWD

    const subtotal = baseFare + weightFee + distanceFee + urgencyFee + insuranceFee + customsFee;
    const platformCommission = Math.round(subtotal * commissionRate);
    const travelerEarnings = subtotal - platformCommission;

    return {
      transportMode,
      urgencyLevel,
      baseFare,
      weightFee,
      distanceFee,
      urgencyFee,
      insuranceFee,
      customsFee,
      platformCommission,
      travelerEarnings,
      totalAmount: subtotal,
      estimatedDeliveryHours: estimatedHours,
      currency: 'TWD',
    };
  }
}
