import assert from 'node:assert';
import { CorridorMatchingEngine } from '../src/modules/matching/CorridorMatchingEngine.ts';
import type { Itinerary, PackageShipment } from '../src/types/index.ts';
import { ComplianceAndSafetyModule } from '../src/modules/compliance/ComplianceAndSafetyModule.ts';
import { PricingEngine } from '../src/modules/pricing/PricingEngine.ts';

console.log('🧪 正在執行 [CorridorMatchingEngine] 時空走廊匹配引擎單元測試...\n');

const now = new Date();

// 基礎測試高鐵行程: 2小時後出發，3.5小時後抵達左營
const testItinerary: Itinerary = {
  id: 'ITIN_TEST_01',
  travelerId: 'USR_TRAVELER_01',
  travelerName: '高鐵商務客',
  travelerPhone: '0912-000-111',
  travelerRating: 5.0,
  isKycVerified: true,
  transportMode: 'HSR',
  origin: {
    name: '高鐵台北站',
    address: '台北市北平西路3號',
    lat: 25.0479,
    lng: 121.5170,
    hubCode: 'THSR_TPE',
  },
  destination: {
    name: '高鐵左營站',
    address: '高雄市高鐵路105號',
    lat: 22.6874,
    lng: 120.3075,
    hubCode: 'THSR_ZUY',
  },
  departureTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
  arrivalTime: new Date(now.getTime() + 3.5 * 60 * 60 * 1000).toISOString(),
  capacity: {
    maxWeightKg: 5,
    remainingWeightKg: 5,
    maxVolumeCm3: 20000,
    remainingVolumeCm3: 20000,
    luggageType: 'BACKPACK',
  },
  maxDetourKm: 3.0,
  status: 'PLANNED',
  createdAt: now.toISOString(),
};

function createMockShipment(overrides: Partial<PackageShipment> = {}): PackageShipment {
  const quote = PricingEngine.calculateQuote({
    transportMode: 'HSR',
    distanceKm: 300,
    weightKg: 1.0,
    declaredValueTwd: 3000,
  });

  return {
    id: 'PKG_TEST_01',
    senderId: 'USR_SENDER_01',
    senderName: '台北發件人',
    senderPhone: '0988-000-111',
    recipientName: '高雄收件人',
    recipientPhone: '0988-000-222',
    title: '重要合約正本',
    description: 'A4 文件夾',
    category: 'DOCUMENT',
    weightKg: 0.5,
    dimensions: { lengthCm: 30, widthCm: 22, heightCm: 3 },
    declaredValue: 3000,
    pickupLocation: {
      name: '台北車站站前新光三越',
      address: '台北市忠孝西路一段66號',
      lat: 25.0458,
      lng: 121.5165,
    },
    dropoffLocation: {
      name: '高鐵左營站彩虹市集',
      address: '高雄市高鐵路115號',
      lat: 22.6876,
      lng: 120.3080,
    },
    earliestPickupTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    deliveryDeadline: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(), // 抵達後1.5小時
    status: 'MATCHING',
    pickupOtp: ComplianceAndSafetyModule.generateSecureOtp(),
    dropoffOtp: ComplianceAndSafetyModule.generateSecureOtp(),
    pricingQuote: quote,
    createdAt: now.toISOString(),
    ...overrides,
  };
}

// 測試 1: 完美時空契合包裹 -> 應高分媒合成功
{
  const perfectShipment = createMockShipment();
  const matches = CorridorMatchingEngine.matchItinerariesForShipment(perfectShipment, [testItinerary]);

  assert.strictEqual(matches.length, 1, '應成功媒合到 1 筆行程');
  const match = matches[0];
  console.log('測試 1 媒合結果:', {
    score: match.score,
    totalDetourKm: match.totalDetourKm,
    timeFitMarginMinutes: match.timeFitMarginMinutes,
    matchReasons: match.matchReasons,
  });

  assert.ok(match.score >= 80, '高度契合應取得 80 分以上高評分');
  assert.ok(match.totalDetourKm < 1.0, '站前周邊面交偏差距離應小於 1km');
  console.log('✅ 測試 1 通過: 完美時空包裹成功媒合且評分優秀');
}

// 測試 2: 重量超載檢驗 (包裹 8kg > 旅人上限 5kg) -> 應自動過濾
{
  const overweightShipment = createMockShipment({ weightKg: 8.0 });
  const matches = CorridorMatchingEngine.matchItinerariesForShipment(overweightShipment, [testItinerary]);
  assert.strictEqual(matches.length, 0, '超重包裹不可被媒合');
  console.log('✅ 測試 2 通過: 載重超標包裹正確被過濾排除');
}

// 測試 3: 空間偏差過大檢驗 (取件點在淡水 18km > 旅人容忍半徑 3km) -> 應自動過濾
{
  const farShipment = createMockShipment({
    pickupLocation: {
      name: '淡水漁人碼頭',
      address: '新北市淡水區觀海路199號',
      lat: 25.1825,
      lng: 121.4116,
    },
  });
  const matches = CorridorMatchingEngine.matchItinerariesForShipment(farShipment, [testItinerary]);
  assert.strictEqual(matches.length, 0, '超出繞路半徑包裹不可被媒合');
  console.log('✅ 測試 3 通過: 空間偏離走廊包裹正確被過濾排除');
}

// 測試 4: 時間窗衝突檢驗 (寄件人要求 2.5 小時內送達，但旅人 3.5 小時後才抵達) -> 應自動過濾
{
  const impossibleDeadlineShipment = createMockShipment({
    deliveryDeadline: new Date(now.getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
  });
  const matches = CorridorMatchingEngine.matchItinerariesForShipment(impossibleDeadlineShipment, [testItinerary]);
  assert.strictEqual(matches.length, 0, '時間衝突包裹不可被媒合');
  console.log('✅ 測試 4 通過: 送達時間晚於截止期限之包裹正確被過濾排除');
}

console.log('\n🎉 所有 [CorridorMatchingEngine] 測試均順利通過！');
