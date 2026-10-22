import assert from 'node:assert';
import { DynamicEtaEngine } from '../src/modules/tracking/DynamicEtaEngine.ts';
import type { PackageShipment, LiveLocationUpdate } from '../src/types/index.ts';

console.log('🧪 正在執行 [DynamicEtaEngine] 即時定位追蹤與動態剩餘時間推算單元測試...\n');

// 準備測試包裹資料 (台北車站 ➔ 台北 101，預設機車運具)
const mockShipment: PackageShipment = {
  id: 'PKG_TEST_TRACKING_01',
  senderId: 'USR_SENDER_01',
  senderName: '陳大明 (寄件人)',
  senderPhone: '0911-222-333',
  recipientName: '林特助 (收件人)',
  recipientPhone: '0922-333-444',
  title: '生乳捲蛋糕禮盒',
  description: '盒裝完整',
  category: 'FOOD_PACKAGED',
  weightKg: 2,
  dimensions: { lengthCm: 25, widthCm: 15, heightCm: 10 },
  declaredValue: 1200,
  pickupLocation: {
    name: '台北車站 M8 出口前',
    address: '台北市中正區忠孝西路一段49號',
    lat: 25.045610,
    lng: 121.517890,
  },
  dropoffLocation: {
    name: '台北 101 大樓 1 樓松智路大廳',
    address: '台北市信義區信義路五段7號',
    lat: 25.033900,
    lng: 121.564500,
  },
  earliestPickupTime: new Date().toISOString(),
  deliveryDeadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
  transportModePreference: 'MOTORCYCLE',
  status: 'ACCEPTED',
  pickupOtp: '123456',
  dropoffOtp: '654321',
  pricingQuote: {
    transportMode: 'MOTORCYCLE',
    baseFare: 80,
    weightFee: 0,
    distanceFee: 30,
    insuranceFee: 36,
    customsFee: 0,
    platformCommission: 29,
    travelerEarnings: 117,
    totalAmount: 146,
    currency: 'TWD',
  },
  createdAt: new Date().toISOString(),
};

// 測試 1: 媒合成功後 (ACCEPTED)，取得寄件人即時定位，旅人端顯示寄件人與收件人定位並推算取件剩餘時間
{
  const senderLive: LiveLocationUpdate = {
    role: 'SENDER',
    lat: 25.045610,
    lng: 121.517890,
    addressDescription: '台北車站 M8 出口 (已在現場等候)',
    timestamp: new Date().toISOString(),
  };

  const travelerLive: LiveLocationUpdate = {
    role: 'TRAVELER',
    lat: 25.055000,
    lng: 121.525000, // 距離台北車站約 1.25 km 處
    speedKmh: 35,
    timestamp: new Date().toISOString(),
  };

  const trackingState = DynamicEtaEngine.computeTrackingState({
    shipment: mockShipment,
    senderLiveUpdate: senderLive,
    travelerLiveUpdate: travelerLive,
  });

  assert.strictEqual(trackingState.targetPhase, 'APPROACHING_PICKUP', '取件前目標階段應為 APPROACHING_PICKUP');
  assert.ok(trackingState.senderLiveLocation, '應具備寄貨人即時定位');
  assert.strictEqual(trackingState.senderLiveLocation!.lat, 25.045610);
  assert.ok(trackingState.travelerLiveLocation, '應具備旅人即時定位');
  assert.ok(trackingState.recipientLocation, '旅人端應能取得收貨人終點面交定位');
  assert.strictEqual(trackingState.recipientLocation.name, '台北 101 大樓 1 樓松智路大廳');

  assert.ok(trackingState.remainingDistanceKm > 0 && trackingState.remainingDistanceKm < 3, '取件前距離應在合理市區範圍 (約 1~2 km)');
  assert.ok(trackingState.remainingMinutes > 0, '應推算出剩餘取件時間');
  assert.ok(trackingState.etaStatusText.includes('預計剩餘'), '狀態說明文字應包含剩餘時間');
  console.log(`✅ 測試 1 通過: 媒合成功後取得寄件人定位，旅人端取得三方定位，推算取件剩餘時間: ${trackingState.remainingMinutes} 分鐘 (距離: ${trackingState.remainingDistanceKm} km)`);
}

// 測試 2: 旅人取件後進入運送中 (IN_TRANSIT)，收貨人端顯示旅人即時定位與動態送達時間
{
  const inTransitShipment: PackageShipment = {
    ...mockShipment,
    status: 'IN_TRANSIT',
  };

  // 旅人在市民大道與新生北路交叉口 (運送途中)
  const travelerLive: LiveLocationUpdate = {
    role: 'TRAVELER',
    lat: 25.044000,
    lng: 121.533000,
    speedKmh: 40,
    addressDescription: '市民大道二段路口，行進中',
    timestamp: new Date().toISOString(),
  };

  const trackingState = DynamicEtaEngine.computeTrackingState({
    shipment: inTransitShipment,
    travelerLiveUpdate: travelerLive,
  });

  assert.strictEqual(trackingState.targetPhase, 'IN_TRANSIT_DROPOFF', '取件後目標階段應為 IN_TRANSIT_DROPOFF');
  assert.ok(trackingState.travelerLiveLocation, '收貨人端應能即時讀取旅人即時定位');
  assert.strictEqual(trackingState.travelerLiveLocation!.lat, 25.044000);
  assert.ok(trackingState.remainingDistanceKm > 2 && trackingState.remainingDistanceKm < 6, '市民大道至台北 101 道路距離約在 3.5~4.5 km');
  assert.ok(trackingState.remainingMinutes >= 5 && trackingState.remainingMinutes <= 20, '機車運送該距離應在 6~15 分鐘左右');
  assert.ok(trackingState.estimatedArrivalTime.includes(':'), '預估到達時間應為 HH:mm 格式');
  console.log(`✅ 測試 2 通過: 旅人取件後運送中，收貨人端取得旅人實時 GPS，動態推算送達時間: 剩餘 ${trackingState.remainingMinutes} 分鐘 (${trackingState.estimatedArrivalTime} 抵達，距離: ${trackingState.remainingDistanceKm} km)`);
}

// 測試 3: 旅人即時行進，剩餘距離與時間動態隨 GPS 座標即時縮短更新
{
  const inTransitShipment: PackageShipment = {
    ...mockShipment,
    status: 'IN_TRANSIT',
  };

  // 位置 A: 距離 101 較遠 (光復南路口)
  const locA: LiveLocationUpdate = {
    role: 'TRAVELER',
    lat: 25.041000,
    lng: 121.556000,
    speedKmh: 35,
    timestamp: new Date().toISOString(),
  };
  const stateA = DynamicEtaEngine.computeTrackingState({
    shipment: inTransitShipment,
    travelerLiveUpdate: locA,
  });

  // 位置 B: 接近 101 (世貿一館對面)
  const locB: LiveLocationUpdate = {
    role: 'TRAVELER',
    lat: 25.034500,
    lng: 121.563000,
    speedKmh: 25,
    timestamp: new Date().toISOString(),
  };
  const stateB = DynamicEtaEngine.computeTrackingState({
    shipment: inTransitShipment,
    travelerLiveUpdate: locB,
  });

  assert.ok(stateA.remainingDistanceKm > stateB.remainingDistanceKm, '位置 A 剩餘距離應大於位置 B');
  assert.ok(stateA.remainingMinutes >= stateB.remainingMinutes, '位置 A 剩餘時間應大於等於位置 B');
  console.log(`✅ 測試 3 通過: GPS 行進動態更新測試通過 (距離: ${stateA.remainingDistanceKm}km ➔ ${stateB.remainingDistanceKm}km，時間: ${stateA.remainingMinutes}分 ➔ ${stateB.remainingMinutes}分)`);
}

// 測試 4: 運具速度係數驗證 (高鐵 HSR 跨城 vs 機車 MOTORCYCLE vs 腳踏車 BICYCLE)
{
  const testDist = 15; // 15 km
  const minsBicycle = DynamicEtaEngine.calculateRemainingMinutes(testDist, 'BICYCLE');
  const minsMoto = DynamicEtaEngine.calculateRemainingMinutes(testDist, 'MOTORCYCLE');
  const minsHsr = DynamicEtaEngine.calculateRemainingMinutes(testDist, 'HSR');

  assert.ok(minsBicycle > minsMoto, '腳踏車時間應大於機車');
  assert.ok(minsMoto > minsHsr, '機車時間應大於高鐵');
  console.log(`✅ 測試 4 通過: 運具時速模型符合常理 (15km: 腳踏車 ${minsBicycle}分, 機車 ${minsMoto}分, 高鐵 ${minsHsr}分)`);
}

console.log('\n🎉 所有 [DynamicEtaEngine] 即時定位與動態剩餘時間單元測試均 100% 通過！');
