import type {
  Itinerary,
  PackageShipment,
  MatchResult,
  PricingQuote,
} from '../../types/index.ts';
import { GeoUtils } from '../../shared/GeoUtils.ts';
import { PricingEngine } from '../pricing/PricingEngine.ts';

export class CorridorMatchingEngine {
  /**
   * 根據包裹需求，在所有登記的旅客行程中計算最佳時空走廊匹配清單
   */
  public static matchItinerariesForShipment(
    shipment: PackageShipment,
    itineraries: Itinerary[]
  ): MatchResult[] {
    const results: MatchResult[] = [];

    for (const itinerary of itineraries) {
      if (itinerary.status !== 'PLANNED') {
        continue;
      }

      const match = this.evaluateMatch(shipment, itinerary);
      if (match) {
        results.push(match);
      }
    }

    // 依匹配分數降序排序 (分數高者優先推薦)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 根據旅客行程，尋找所有符合該時空軌跡的順路待運包裹
   */
  public static matchShipmentsForItinerary(
    itinerary: Itinerary,
    shipments: PackageShipment[]
  ): MatchResult[] {
    const results: MatchResult[] = [];

    for (const shipment of shipments) {
      if (shipment.status !== 'MATCHING') {
        continue;
      }

      const match = this.evaluateMatch(shipment, itinerary);
      if (match) {
        results.push(match);
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 單一包裹與行程之時空走廊綜合評估演算法
   */
  private static evaluateMatch(
    shipment: PackageShipment,
    itinerary: Itinerary
  ): MatchResult | null {
    const matchReasons: string[] = [];

    // 1. 容積與重量檢核 (Capacity Check)
    if (shipment.weightKg > itinerary.capacity.remainingWeightKg) {
      return null; // 超重
    }

    const packageVolume =
      shipment.dimensions.lengthCm *
      shipment.dimensions.widthCm *
      shipment.dimensions.heightCm;

    if (packageVolume > itinerary.capacity.remainingVolumeCm3) {
      return null; // 體積過大，行李空間裝不下
    }

    // 2. 空間走廊偏差計算 (Spatial Corridor Check)
    let pickupDetourKm = GeoUtils.calculateDistanceKm(
      itinerary.origin,
      shipment.pickupLocation
    );
    let dropoffDetourKm = GeoUtils.calculateDistanceKm(
      itinerary.destination,
      shipment.dropoffLocation
    );

    // 若起迄點皆於指定樞紐站點面交，偏差視為 0
    if (
      itinerary.origin.hubCode &&
      shipment.pickupLocation.hubCode &&
      itinerary.origin.hubCode === shipment.pickupLocation.hubCode
    ) {
      pickupDetourKm = 0;
      matchReasons.push('起點於相同大眾運輸樞紐面交 (零繞路成本)');
    }

    if (
      itinerary.destination.hubCode &&
      shipment.dropoffLocation.hubCode &&
      itinerary.destination.hubCode === shipment.dropoffLocation.hubCode
    ) {
      dropoffDetourKm = 0;
      matchReasons.push('終點於相同大眾運輸樞紐面交 (零繞路成本)');
    }

    const allowedDetour = itinerary.maxDetourKm || 3.0; // 預設最大容許繞路半徑 3km
    if (pickupDetourKm > allowedDetour || dropoffDetourKm > allowedDetour) {
      return null; // 超出旅客願意繞路的空間容忍度
    }

    const totalDetourKm = parseFloat((pickupDetourKm + dropoffDetourKm).toFixed(2));

    // 3. 時間窗相容性檢核 (Temporal Window Check)
    const pickupReadyTime = new Date(shipment.earliestPickupTime).getTime();
    const travelerDepartureTime = new Date(itinerary.departureTime).getTime();
    const travelerArrivalTime = new Date(itinerary.arrivalTime).getTime();
    const deliveryDeadline = new Date(shipment.deliveryDeadline).getTime();

    // 規則 A: 旅客出發時間需晚於包裹可取件時間 (至少留 15 分鐘取件驗視緩衝)
    const minHandoverBufferMs = 15 * 60 * 1000;
    if (travelerDepartureTime < pickupReadyTime + minHandoverBufferMs) {
      return null; // 旅客出發過早，來不及取件
    }

    // 規則 B: 旅客抵達目的地時間需早於包裹交付截止時間
    if (travelerArrivalTime > deliveryDeadline) {
      return null; // 抵達時間超過寄件人要求的截止期限
    }

    const timeFitMarginMinutes = Math.floor(
      (deliveryDeadline - travelerArrivalTime) / (60 * 1000)
    );

    if (timeFitMarginMinutes >= 60) {
      matchReasons.push(`時間充裕 (送達截止前仍有 ${timeFitMarginMinutes} 分鐘彈性)`);
    }

    // 4. 計算多運具報價
    const directDistanceKm = GeoUtils.calculateDistanceKm(
      shipment.pickupLocation,
      shipment.dropoffLocation
    );

    const pricingQuote = PricingEngine.calculateQuote({
      transportMode: itinerary.transportMode,
      distanceKm: directDistanceKm,
      weightKg: shipment.weightKg,
      declaredValueTwd: shipment.declaredValue,
      isInternational: itinerary.origin.address.includes('Japan') || itinerary.destination.address.includes('Japan')
    });

    // 5. 綜合推薦評分模型 (0 ~ 100)
    let score = 50; // 基礎基準分

    // (A) 空間偏離度評分 (最高 30 分)
    const spatialScore = Math.max(0, 30 - totalDetourKm * 5);
    score += spatialScore;

    // (B) 時間充裕度評分 (最高 15 分)
    const temporalScore = Math.min(15, Math.floor(timeFitMarginMinutes / 10));
    score += temporalScore;

    // (C) 旅人信譽加成 (最高 15 分)
    if (itinerary.isKycVerified) {
      score += 8;
      matchReasons.push('旅人已通過身分證/護照 KYC 實名認證');
    }
    score += Math.round((itinerary.travelerRating / 5) * 7);

    // 確保分數在 0 ~ 100
    score = Math.min(100, Math.max(0, Math.round(score)));

    return {
      itinerary,
      shipment,
      score,
      pickupDetourKm,
      dropoffDetourKm,
      totalDetourKm,
      timeFitMarginMinutes,
      pricingQuote,
      matchReasons,
    };
  }
}
