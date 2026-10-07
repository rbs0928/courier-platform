import assert from 'node:assert';
import { ComplianceAndSafetyModule } from '../src/modules/compliance/ComplianceAndSafetyModule.ts';
import { EscrowWalletService } from '../src/modules/escrow/EscrowWalletService.ts';
import type { PackageShipment } from '../src/types/index.ts';
import { PricingEngine } from '../src/modules/pricing/PricingEngine.ts';

console.log('🧪 正在執行 [Compliance & Safety & Escrow] 安全合規與資金託管單元測試...\n');

// 測試 1: 違禁品與危險品智能偵測
{
  // 國內易燃危險品
  const domesticCheck = ComplianceAndSafetyModule.checkContraband(
    '野營專用瓦斯罐二組',
    '未拆封全新高壓氣體',
    'OTHER',
    false
  );
  assert.strictEqual(domesticCheck.isAllowed, false, '危險氣體應被攔截');
  assert.ok(domesticCheck.violations.length > 0, '需回傳違禁原因');

  // 國際航空邊境防檢疫違規
  const intlCheck = ComplianceAndSafetyModule.checkContraband(
    '台灣名產香腸肉乾禮盒',
    '真空包裝豬肉乾',
    'FOOD_PACKAGED',
    true // 國際境內
  );
  assert.strictEqual(intlCheck.isAllowed, false, '未檢疫肉製品跨國境應被攔截');
  console.log('違禁品檢測結果 (正確攔截):', intlCheck.violations);

  // 合規合法物件
  const safeCheck = ComplianceAndSafetyModule.checkContraband(
    '文創手帳本與筆記本',
    '純紙本文具商品',
    'DOCUMENT',
    true
  );
  assert.strictEqual(safeCheck.isAllowed, true, '合規物件應予以放行');
  console.log('✅ 測試 1 通過: 違禁品與航空海關防檢疫過濾正常運作');
}

// 測試 2: 開箱驗視存證與雙重動態 OTP 交接狀態機
{
  const escrowService = new EscrowWalletService();
  const travelerId = 'TRV_ALICE_01';
  const senderId = 'SND_BOB_01';

  // 寄件人初始充值 $3,000 元
  const senderWallet = escrowService.getOrCreateWallet(senderId, '寄件人 Bob', 3000);
  const travelerWallet = escrowService.getOrCreateWallet(travelerId, '旅人 Alice', 0);

  const quote = PricingEngine.calculateQuote({
    transportMode: 'HSR',
    distanceKm: 300,
    weightKg: 2.0,
    declaredValueTwd: 10000,
  });

  const pickupOtp = '882314';
  const dropoffOtp = '991205';

  const shipment: PackageShipment = {
    id: 'PKG_ESCROW_TEST',
    senderId,
    senderName: '寄件人 Bob',
    senderPhone: '0911-111-111',
    recipientName: '收件人 Charlie',
    recipientPhone: '0922-222-222',
    title: '無人機備用鏡頭模組',
    description: '精密光學鏡頭，附發票',
    category: 'ELECTRONICS',
    weightKg: 1.8,
    dimensions: { lengthCm: 20, widthCm: 15, heightCm: 10 },
    declaredValue: 10000,
    pickupLocation: {
      name: '台北車站北二門',
      address: '台北市北平西路3號',
      lat: 25.048,
      lng: 121.517,
      hubCode: 'THSR_TPE',
    },
    dropoffLocation: {
      name: '左營高鐵站站前',
      address: '高雄市高鐵路105號',
      lat: 22.687,
      lng: 120.307,
      hubCode: 'THSR_ZUY',
    },
    earliestPickupTime: new Date().toISOString(),
    deliveryDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    status: 'ACCEPTED',
    assignedTravelerId: travelerId,
    pickupOtp,
    dropoffOtp,
    pricingQuote: quote,
    createdAt: new Date().toISOString(),
  };

  // 步驟 A: 鎖定寄件人資金進入 Escrow
  const escrowTx = escrowService.holdEscrowForShipment(shipment);
  assert.strictEqual(escrowTx.status, 'HELD_IN_ESCROW', '資金應處於託管鎖定狀態');
  assert.strictEqual(senderWallet.lockedEscrowTwd, quote.totalAmount, '寄件人款項應被全額鎖定');
  assert.strictEqual(senderWallet.balanceTwd, 3000 - quote.totalAmount, '寄件人可用餘額應相應扣減');

  // 步驟 B: 嘗試用錯誤取件 OTP -> 應被拒絕
  const badOtpResult = ComplianceAndSafetyModule.verifyPickupAndInspection({
    shipment,
    travelerId,
    inputOtp: '000000', // 錯誤 OTP
    checklist: {
      noContrabandConfirmed: true,
      physicalAppearanceChecked: true,
      packageOpenedAndInspected: true,
      sealedInPresenceOfSender: true,
    },
    photoUrls: ['https://cdn.example.com/photo1.jpg', 'https://cdn.example.com/photo2.jpg'],
  });
  assert.strictEqual(badOtpResult.success, false, '錯誤 OTP 應無法通過取件');
  assert.strictEqual(shipment.status, 'ACCEPTED', '狀態應維持在 ACCEPTED');

  // 步驟 C: 未上傳足夠開箱存證照片 -> 應被拒絕
  const missingPhotoResult = ComplianceAndSafetyModule.verifyPickupAndInspection({
    shipment,
    travelerId,
    inputOtp: pickupOtp,
    checklist: {
      noContrabandConfirmed: true,
      physicalAppearanceChecked: true,
      packageOpenedAndInspected: true,
      sealedInPresenceOfSender: true,
    },
    photoUrls: ['https://cdn.example.com/only_one.jpg'], // 缺少第二張照片
  });
  assert.strictEqual(missingPhotoResult.success, false, '缺少封箱照片應無法通過安全驗證');

  // 步驟 D: 完整開箱驗視照片 + 正確取件 OTP -> 取件成功並進入運送狀態
  const goodPickupResult = ComplianceAndSafetyModule.verifyPickupAndInspection({
    shipment,
    travelerId,
    inputOtp: pickupOtp,
    checklist: {
      noContrabandConfirmed: true,
      physicalAppearanceChecked: true,
      packageOpenedAndInspected: true,
      sealedInPresenceOfSender: true,
    },
    photoUrls: [
      'https://cdn.example.com/open_inspection.jpg',
      'https://cdn.example.com/sealed_package.jpg',
    ],
  });
  assert.strictEqual(goodPickupResult.success, true, '正確交接應回傳成功');
  assert.strictEqual(shipment.status, 'IN_TRANSIT', '訂單狀態應更新為 IN_TRANSIT');
  assert.ok(shipment.inspectionRecord, '應已記錄開箱存證詳情');

  // 步驟 E: 嘗試送達時使用錯誤簽收 OTP -> 應被拒絕
  const badDropoffResult = ComplianceAndSafetyModule.verifyDropoff({
    shipment,
    travelerId,
    inputOtp: '123456',
    photoUrls: ['https://cdn.example.com/delivery_handover.jpg'],
  });
  assert.strictEqual(badDropoffResult.success, false, '錯誤簽收碼不可完成送達');
  assert.strictEqual(shipment.status, 'IN_TRANSIT', '狀態應維持 IN_TRANSIT');

  // 步驟 F: 現場出示正確簽收碼與交付拍照 -> 完成交付並觸發資金託管分帳
  const goodDropoffResult = ComplianceAndSafetyModule.verifyDropoff({
    shipment,
    travelerId,
    inputOtp: dropoffOtp,
    photoUrls: ['https://cdn.example.com/delivery_handover.jpg'],
  });
  assert.strictEqual(goodDropoffResult.success, true, '簽收成功');
  assert.strictEqual(shipment.status, 'DELIVERED', '狀態應變更為 DELIVERED');

  // 解鎖資金分帳
  const payout = escrowService.releaseEscrowToTraveler(shipment);
  assert.strictEqual(payout.travelerEarnings, quote.travelerEarnings, '旅人應如數收到收益');
  assert.strictEqual(travelerWallet.balanceTwd, quote.travelerEarnings, '旅人錢包餘額應增加');
  assert.strictEqual(senderWallet.lockedEscrowTwd, 0, '寄件人鎖定託管金應歸零');
  assert.strictEqual(escrowService.getPlatformRevenue(), quote.platformCommission, '平台應成功獲取佣金');

  console.log('✅ 測試 2 通過: 雙重動態 OTP + 開箱驗視協定 + 資金託管解鎖閉環完整可靠');
}

console.log('\n🎉 所有 [Compliance & Safety & Escrow] 測試均順利通過！');
