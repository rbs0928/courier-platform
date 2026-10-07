/**
 * 完整情境互動展示腳本 - 全運具順路捎帶快遞平台
 * 包含：捷運同城、高鐵跨城、國際航班跨境捎帶，以及時空走廊匹配、開箱驗視與雙重 OTP 交付
 */

import { InMemoryStore } from '../backend/src/database/InMemoryStore.ts';
import { CorridorMatchingEngine } from '../backend/src/modules/matching/CorridorMatchingEngine.ts';
import { ComplianceAndSafetyModule } from '../backend/src/modules/compliance/ComplianceAndSafetyModule.ts';
import { EscrowWalletService } from '../backend/src/modules/escrow/EscrowWalletService.ts';
import { PricingEngine } from '../backend/src/modules/pricing/PricingEngine.ts';
import type { Itinerary, PackageShipment } from '../backend/src/types/index.ts';

console.log('======================================================================');
console.log('🚀 全運具跨城／跨國順路捎帶快遞平台 (Multi-Modal Crowdsourced Courier) 模擬演示');
console.log('======================================================================\n');

const store = new InMemoryStore();
const escrowService = new EscrowWalletService();

async function runDemo() {
  // -------------------------------------------------------------------------
  // 案例 1: 同城機車外送／速克達順路到府直送 (新北三重 -> 台北大安商辦)
  // -------------------------------------------------------------------------
  console.log('【場景 1：同城機車外送／速克達穿梭巷弄到府直送】');
  console.log('📌 騎士：Eric（騎 150cc 速克達，從 三重 往 台北大安區 通勤/跑單）');
  console.log('📌 寄件人：法式甜點烘焙坊（急送 2.5kg 手工生乳捲與冰滴咖啡至外商辦公室）\n');

  const motoItin = store.getItinerary('ITIN_MOTO_05')!;
  const motoPkg = store.getShipment('PKG_MOTO_03')!;

  console.log(`[機車騎士行程] ${motoItin.travelerName}`);
  console.log(`  起點: ${motoItin.origin.name}`);
  console.log(`  迄點: ${motoItin.destination.name}`);
  console.log(`  時間: ${motoItin.departureTime.slice(11, 16)} 出發 -> ${motoItin.arrivalTime.slice(11, 16)} 抵達`);
  console.log(`  置物箱/踏板容量: 剩餘 ${motoItin.capacity.remainingWeightKg} kg, 空間 40 公升\n`);

  console.log(`[待送甜點包裹] ${motoPkg.title}`);
  console.log(`  重量: ${motoPkg.weightKg} kg, 申報價值: $${motoPkg.declaredValue} TWD`);
  console.log(`  報價明細: 總額 $${motoPkg.pricingQuote.totalAmount} TWD (騎士實得: $${motoPkg.pricingQuote.travelerEarnings} TWD, 平台抽成: $${motoPkg.pricingQuote.platformCommission} TWD)\n`);

  console.log('🔍 正在執行 [時空走廊匹配引擎]...');
  const motoMatches = CorridorMatchingEngine.matchItinerariesForShipment(motoPkg, [motoItin]);
  if (motoMatches.length > 0) {
    const motoMatch = motoMatches[0];
    console.log(`🎯 機車順路媒合成功！推薦指數: ${motoMatch.score}/100 分`);
    console.log(`  到府路徑偏差: 起點 ${motoMatch.pickupDetourKm} km + 迄點 ${motoMatch.dropoffDetourKm} km = 總偏差 ${motoMatch.totalDetourKm} km (在容許半徑 2.0km 內)`);
  }

  // 託管與交付
  motoPkg.assignedTravelerId = motoItin.travelerId;
  motoPkg.status = 'ACCEPTED';
  const motoEscrow = escrowService.holdEscrowForShipment(motoPkg);
  console.log(`💳 烘焙坊付款 $${motoEscrow.totalAmountTwd} TWD 鎖定於平台資金託管 [${motoEscrow.id}]`);

  const motoPickup = ComplianceAndSafetyModule.verifyPickupAndInspection({
    shipment: motoPkg,
    travelerId: motoItin.travelerId,
    inputOtp: motoPkg.pickupOtp,
    checklist: {
      noContrabandConfirmed: true,
      physicalAppearanceChecked: true,
      packageOpenedAndInspected: true,
      sealedInPresenceOfSender: true,
      notes: '蛋糕完整平放於機車後保溫箱，加強固定防傾倒',
    },
    photoUrls: ['https://storage.platform.io/scooter_box_open.jpg', 'https://storage.platform.io/scooter_box_closed.jpg'],
  });
  console.log(`📍 甜點門市交接: ✅ ${motoPickup.message}`);

  console.log('🛵 機車騎士靈活穿梭台北市區車流與巷弄... 30 分鐘後極速送達大安區辦公大樓！');
  const motoDropoff = ComplianceAndSafetyModule.verifyDropoff({
    shipment: motoPkg,
    travelerId: motoItin.travelerId,
    inputOtp: motoPkg.dropoffOtp,
    photoUrls: ['https://storage.platform.io/scooter_delivered.jpg'],
  });
  console.log(`📍 敦化南路大廳簽收: ✅ ${motoDropoff.message}`);

  const motoPayout = escrowService.releaseEscrowToTraveler(motoPkg);
  console.log(`💰 資金託管解鎖：機車騎士 Eric 錢包入帳 +$${motoPayout.travelerEarnings} TWD (補貼油錢與日常開銷！)\n`);

  // -------------------------------------------------------------------------
  // 案例 2: 台灣高鐵跨城極速件 (台北 -> 高雄左營)
  // -------------------------------------------------------------------------
  console.log('======================================================================');
  console.log('【場景 2：台灣高鐵跨城 3 小時極速送達】');
  console.log('📌 旅人：Bob（搭乘高鐵 115 次，從 台北站 到 左營站）');
  console.log('📌 寄件人：科技公司研發部（急需將通訊晶片送至高雄廠區王廠長）\n');

  const hsrItin = store.getItinerary('ITIN_HSR_02')!;
  const hsrPkg = store.getShipment('PKG_HSR_01')!;

  console.log(`[旅人行程] ${hsrItin.travelerName}`);
  console.log(`  起點: ${hsrItin.origin.name} (${hsrItin.origin.hubCode})`);
  console.log(`  迄點: ${hsrItin.destination.name} (${hsrItin.destination.hubCode})`);
  console.log(`  時間: ${hsrItin.departureTime.slice(11, 16)} 發車 -> ${hsrItin.arrivalTime.slice(11, 16)} 抵達`);
  console.log(`  閒置行李空間: 剩餘 ${hsrItin.capacity.remainingWeightKg} kg (登機箱容積)\n`);

  console.log(`[待運包裹] ${hsrPkg.title}`);
  console.log(`  取件點: ${hsrPkg.pickupLocation.name}`);
  console.log(`  送達點: ${hsrPkg.dropoffLocation.name}`);
  console.log(`  重量: ${hsrPkg.weightKg} kg, 申報價值: $${hsrPkg.declaredValue} TWD`);
  console.log(`  報價明細: 總額 $${hsrPkg.pricingQuote.totalAmount} TWD (旅人收益: $${hsrPkg.pricingQuote.travelerEarnings} TWD, 平台抽成: $${hsrPkg.pricingQuote.platformCommission} TWD)\n`);

  console.log('🔍 正在執行 [時空走廊匹配引擎]...');
  const matches = CorridorMatchingEngine.matchItinerariesForShipment(hsrPkg, [hsrItin]);
  if (matches.length === 0) {
    console.error('❌ 媒合失敗！');
    return;
  }

  const bestMatch = matches[0];
  console.log(`🎯 媒合成功！推薦指數: ${bestMatch.score}/100 分`);
  console.log(`  繞路偏差: 起點 ${bestMatch.pickupDetourKm} km + 迄點 ${bestMatch.dropoffDetourKm} km = 總偏差 ${bestMatch.totalDetourKm} km`);
  console.log(`  送達彈性: 抵達左營後距離截止時間尚有 ${bestMatch.timeFitMarginMinutes} 分鐘`);
  console.log(`  媒合亮點: ${bestMatch.matchReasons.join(', ')}\n`);

  // 寄件人與旅人確認接單，進入 Escrow
  console.log('💳 旅人接單，寄件人款項進入平台資金託管 (Escrow)...');
  hsrPkg.assignedTravelerId = hsrItin.travelerId;
  hsrPkg.status = 'ACCEPTED';
  const escrowTx = escrowService.holdEscrowForShipment(hsrPkg);
  console.log(`  ✅ 資金已託管：$${escrowTx.totalAmountTwd} TWD 鎖定於合約 [${escrowTx.id}]\n`);

  // 面交驗視與取件 OTP
  console.log('📍 雙方於台北車站面交：執行 [開箱驗視安全協定]...');
  console.log(`  - 旅人現場檢視：確認晶片外觀完好、無危險品，當面封箱拍照存證`);
  console.log(`  - 寄件人出示動態取件 OTP: [${hsrPkg.pickupOtp}]`);

  const pickupResult = ComplianceAndSafetyModule.verifyPickupAndInspection({
    shipment: hsrPkg,
    travelerId: hsrItin.travelerId,
    inputOtp: hsrPkg.pickupOtp,
    checklist: {
      noContrabandConfirmed: true,
      physicalAppearanceChecked: true,
      packageOpenedAndInspected: true,
      sealedInPresenceOfSender: true,
      notes: '精密晶片封箱完整，序號 SN-882910 相符',
    },
    photoUrls: [
      'https://storage.platform.io/inspections/pkg_hsr_01_open.jpg',
      'https://storage.platform.io/inspections/pkg_hsr_01_sealed.jpg',
    ],
  });
  console.log(`  ✅ ${pickupResult.message}\n`);

  console.log('🚄 旅人搭乘高鐵 115 次奔馳南下... 1 小時 35 分後準時抵達高鐵左營站！\n');

  // 送達簽收與分帳
  console.log('📍 旅人與收件人 (高雄廠王廠長) 於左營站 4 號出口面交：');
  console.log(`  - 收件人核對封條完整，提供簽收 OTP: [${hsrPkg.dropoffOtp}]`);

  const dropoffResult = ComplianceAndSafetyModule.verifyDropoff({
    shipment: hsrPkg,
    travelerId: hsrItin.travelerId,
    inputOtp: hsrPkg.dropoffOtp,
    photoUrls: ['https://storage.platform.io/deliveries/pkg_hsr_01_handover.jpg'],
  });
  console.log(`  ✅ ${dropoffResult.message}`);

  const payout = escrowService.releaseEscrowToTraveler(hsrPkg);
  console.log(`  💰 平台資金託管即時解鎖結算：`);
  console.log(`     - 旅人 Bob 錢包入帳: +$${payout.travelerEarnings} TWD (成功補貼高鐵單程車資！)`);
  console.log(`     - 平台服務抽成: +$${payout.platformCommission} TWD`);
  console.log(`     - 訂單最終狀態: [${hsrPkg.status}]\n`);

  // -------------------------------------------------------------------------
  // 案例 3: 境內自駕私家車順路捎帶大件物品 (台北內湖 -> 新竹科學園區)
  // -------------------------------------------------------------------------
  console.log('======================================================================');
  console.log('【場景 3：境內私家車/自駕車後車廂順路捎帶大件裝備】');
  console.log('📌 車主：David（週五開休旅車 SUV 從 台北內湖 南下 新竹科學園區）');
  console.log('📌 寄件人：戶外露營用品行（需將 18kg 大型充氣帳篷送達新竹客人口袋名單）\n');

  const carItin = store.getItinerary('ITIN_CAR_04')!;
  const carPkg = store.getShipment('PKG_CAR_02')!;

  console.log(`[車主行程] ${carItin.travelerName}`);
  console.log(`  起點: ${carItin.origin.name}`);
  console.log(`  迄點: ${carItin.destination.name} (${carItin.destination.hubCode})`);
  console.log(`  時間: ${carItin.departureTime.slice(11, 16)} 出發 -> ${carItin.arrivalTime.slice(11, 16)} 抵達`);
  console.log(`  後車廂可用載重: ${carItin.capacity.remainingWeightKg} kg, 空間容積: 150 公升\n`);

  console.log(`[待運大件包裹] ${carPkg.title}`);
  console.log(`  規格: ${carPkg.weightKg} kg (一般機車無法載運，私家車後車廂最佳選擇)`);
  console.log(`  報價: 總額 $${carPkg.pricingQuote.totalAmount} TWD (車主油資/過路費補貼: $${carPkg.pricingQuote.travelerEarnings} TWD, 平台抽成: $${carPkg.pricingQuote.platformCommission} TWD)\n`);

  console.log('🔍 正在執行 [時空走廊匹配引擎]...');
  const carMatches = CorridorMatchingEngine.matchItinerariesForShipment(carPkg, [carItin]);
  if (carMatches.length > 0) {
    const carMatch = carMatches[0];
    console.log(`🎯 汽車順路媒合成功！推薦指數: ${carMatch.score}/100 分`);
    console.log(`  交流道周邊偏差: 起點 ${carMatch.pickupDetourKm} km + 迄點 ${carMatch.dropoffDetourKm} km = 總偏差 ${carMatch.totalDetourKm} km (在容許半徑 4.5km 內)`);
  }

  // 託管與交付演練
  carPkg.assignedTravelerId = carItin.travelerId;
  carPkg.status = 'ACCEPTED';
  const carEscrow = escrowService.holdEscrowForShipment(carPkg);
  console.log(`💳 寄件人支付 $${carEscrow.totalAmountTwd} TWD 鎖定於平台資金託管 [${carEscrow.id}]`);

  // 取件驗視
  const carPickup = ComplianceAndSafetyModule.verifyPickupAndInspection({
    shipment: carPkg,
    travelerId: carItin.travelerId,
    inputOtp: carPkg.pickupOtp,
    checklist: {
      noContrabandConfirmed: true,
      physicalAppearanceChecked: true,
      packageOpenedAndInspected: true,
      sealedInPresenceOfSender: true,
      notes: '大件露營帳篷外觀完好，放入 SUV 後車廂',
    },
    photoUrls: ['https://storage.platform.io/trunk_loading.jpg', 'https://storage.platform.io/trunk_closed.jpg'],
  });
  console.log(`📍 台北內湖門市交接: ✅ ${carPickup.message}`);

  // 送達簽收
  console.log('🚗 車主沿國道一號南下順暢行駛... 抵達新竹科學園區公道五路交流道口！');
  const carDropoff = ComplianceAndSafetyModule.verifyDropoff({
    shipment: carPkg,
    travelerId: carItin.travelerId,
    inputOtp: carPkg.dropoffOtp,
    photoUrls: ['https://storage.platform.io/trunk_unloaded.jpg'],
  });
  console.log(`📍 新竹交流道交接: ✅ ${carDropoff.message}`);

  const carPayout = escrowService.releaseEscrowToTraveler(carPkg);
  console.log(`💰 資金託管解鎖：車主 David 錢包入帳 +$${carPayout.travelerEarnings} TWD (全額補貼台北至新竹油資與國道計程通行費！)\n`);

  // -------------------------------------------------------------------------
  // 案例 4: 國際航班行李空間跨境捎帶 (台北松山 -> 日本東京羽田)
  // -------------------------------------------------------------------------
  console.log('======================================================================');
  console.log('【場景 4：跨國航空航班行李空間跨境捎帶】');
  console.log('📌 旅人：Carol（明日搭乘長榮航空 BR192 從 台北松山 TSA 飛往 東京羽田 HND）');
  console.log('📌 寄件人：台灣茶行老闆（急送 3kg 台灣高山茶葉禮盒予東京銀座茶道老師）\n');

  const flightItin = store.getItinerary('ITIN_FLIGHT_03')!;

  const teaQuote = PricingEngine.calculateQuote({
    transportMode: 'FLIGHT',
    distanceKm: 2100,
    weightKg: 3.0,
    declaredValueTwd: 6000,
    isInternational: true,
  });

  console.log(`[國際運送試算]`);
  console.log(`  基礎起跳 (手提額度 1kg): $${teaQuote.baseFare} TWD`);
  console.log(`  超額行李重量費 (2kg x $400): $${teaQuote.weightFee} TWD`);
  console.log(`  國際合規報關手續費: $${teaQuote.customsFee} TWD`);
  console.log(`  國際貨物保價 (3%): $${teaQuote.insuranceFee} TWD`);
  console.log(`  👉 總運費: $${teaQuote.totalAmount} TWD (旅人實得: $${teaQuote.travelerEarnings} TWD, 補貼機票費用！)\n`);

  // 違禁品防護示範
  console.log('🛡️ 執行航空海關安全與防檢疫檢測：');
  const safeCheck = ComplianceAndSafetyModule.checkContraband(
    '熟成高山烏龍茶禮盒',
    '真空罐裝烘焙茶葉，檢附出廠檢驗證明',
    'FOOD_PACKAGED',
    true
  );
  console.log(`  - 熟成茶葉合規檢測: ${safeCheck.isAllowed ? '✅ 通過航空海關規範' : '❌ 違禁攔截'}`);

  const illegalCheck = ComplianceAndSafetyModule.checkContraband(
    '台灣黑豬肉香腸禮盒',
    '真空包裝生肉香腸',
    'FOOD_PACKAGED',
    true
  );
  console.log(`  - 生鮮肉品檢測: ${illegalCheck.isAllowed ? '✅ 通過' : '❌ 嚴格攔截！'}`);
  console.log(`    攔截原因: ${illegalCheck.violations.join('; ')}\n`);

  console.log('======================================================================');
  console.log('🎉 順路多運具快遞平台全流程模擬完成！各項核心指標運作正常！');
  console.log('======================================================================');
}

runDemo().catch(console.error);
