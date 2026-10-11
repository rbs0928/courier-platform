import assert from 'node:assert';
import { ComplianceAndSafetyModule } from '../src/modules/compliance/ComplianceAndSafetyModule.ts';
import { EscrowWalletService } from '../src/modules/escrow/EscrowWalletService.ts';
import type { PackageShipment } from '../src/types/index.ts';
import { PricingEngine } from '../src/modules/pricing/PricingEngine.ts';

console.log('🧪 正在執行 [Compliance & Safety & Escrow] 安全合規、AI審核與雙照一致性單元測試...\n');

// 測試 1: 違禁品、危險品與 AI 審核分流
{
  // 1.1 明確危險品 -> AI REJECTED
  const rejectedCheck = ComplianceAndSafetyModule.aiScreenContraband({
    shipmentId: 'PKG_REJECT_01',
    title: '野營專用瓦斯罐二組',
    description: '全新高壓易燃氣體',
    category: 'OTHER',
  });
  assert.strictEqual(rejectedCheck.decision, 'REJECTED', '危險高壓氣體應直接拒絕');

  // 1.2 跨國生肉檢疫禁令 -> AI REJECTED
  const intlCheck = ComplianceAndSafetyModule.aiScreenContraband({
    shipmentId: 'PKG_REJECT_02',
    title: '台灣名產香腸肉乾禮盒',
    description: '未檢疫豬肉製品',
    category: 'FOOD_PACKAGED',
    isInternational: true,
  });
  assert.strictEqual(intlCheck.decision, 'REJECTED', '非洲豬瘟肉製品應直接拒絕');

  // 1.3 疑似違禁品 (粉末/中藥/未知品) -> AI SUSPECT_MANUAL_REVIEW (排入人工工單)
  const suspectCheck = ComplianceAndSafetyModule.aiScreenContraband({
    shipmentId: 'PKG_SUSPECT_01',
    title: '自製高山漢方養生粉末禮盒',
    description: '散裝中藥粉末，無標籤',
    category: 'OTHER',
  });
  assert.strictEqual(suspectCheck.decision, 'SUSPECT_MANUAL_REVIEW', '未知粉末應標記為疑似違禁品');
  assert.strictEqual(suspectCheck.requiresHumanReview, true, '需標記為需人工審查');

  // 檢查人工審核佇列是否已收到工單
  const queue = ComplianceAndSafetyModule.getReviewQueue();
  const ticket = queue.find(t => t.shipmentId === 'PKG_SUSPECT_01');
  assert.ok(ticket, '人工審核佇列應含有此工單');
  assert.strictEqual(ticket.status, 'PENDING');

  // 1.4 安全物品 -> AI CLEARED
  const safeCheck = ComplianceAndSafetyModule.aiScreenContraband({
    shipmentId: 'PKG_SAFE_01',
    title: '文創手帳本與筆記本',
    description: '純紙本文具商品',
    category: 'DOCUMENT',
  });
  assert.strictEqual(safeCheck.decision, 'CLEARED', '合規物件應放行');

  console.log('✅ 測試 1 通過: AI 違禁品初審與疑似品項分流至人工佇列機制完全正確');
}

// 測試 2: 人工審核工單裁定機制
{
  const mockShipment: PackageShipment = {
    id: 'PKG_MANUAL_01',
    senderId: 'USR_01',
    senderName: '寄件人',
    senderPhone: '0900',
    recipientName: '收件人',
    recipientPhone: '0911',
    title: '生技公司檢測試劑粉末',
    description: '附檢驗成分證明',
    category: 'OTHER',
    weightKg: 0.5,
    dimensions: { lengthCm: 10, widthCm: 10, heightCm: 10 },
    declaredValue: 2000,
    pickupLocation: { name: '台北', address: '台北', lat: 25, lng: 121 },
    dropoffLocation: { name: '新竹', address: '新竹', lat: 24, lng: 121 },
    earliestPickupTime: new Date().toISOString(),
    deliveryDeadline: new Date().toISOString(),
    status: 'SCREENING_SUSPECT',
    pickupOtp: '111222',
    dropoffOtp: '333444',
    pricingQuote: {} as any,
    createdAt: new Date().toISOString(),
  };

  const queue = ComplianceAndSafetyModule.getReviewQueue();
  const targetTicket = queue[0];
  assert.ok(targetTicket, '佇列應有待審工單');

  const decideRes = ComplianceAndSafetyModule.decideReviewTicket({
    ticketId: targetTicket.ticketId,
    decision: 'APPROVED',
    reviewerId: 'AUDITOR_CHENG',
    reviewerNotes: '檢驗報告無誤，予以放行',
    shipment: mockShipment,
  });

  assert.strictEqual(decideRes.success, true);
  assert.strictEqual(mockShipment.status, 'MATCHING', '核准後狀態應切換為 MATCHING 允許媒合');
  console.log('✅ 測試 2 通過: 風控人員人工審核工單裁定成功放行');
}

// 測試 3: 雙照一致性審核 (未審核前阻擋簽收，審核一致後放行並解鎖 Escrow)
{
  const escrowService = new EscrowWalletService();
  const travelerId = 'TRV_ALICE_01';
  const senderId = 'SND_BOB_01';

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
    id: 'PKG_CONSISTENCY_TEST',
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

  // 1. 託管資金
  escrowService.holdEscrowForShipment(shipment);

  // 2. 取件驗視 (建立基準照片)
  const pickupRes = ComplianceAndSafetyModule.verifyPickupAndInspection({
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
      'https://cdn.example.com/baseline_open.jpg',
      'https://cdn.example.com/baseline_sealed.jpg',
    ],
  });
  assert.strictEqual(pickupRes.success, true);
  assert.strictEqual(shipment.status, 'IN_TRANSIT');

  // 3. 關鍵測試：未完成雙照一致性審核前，嘗試輸入簽收 OTP -> 必須被安全阻擋！
  const blockedDropoff = ComplianceAndSafetyModule.verifyDropoff({
    shipment,
    travelerId,
    inputOtp: dropoffOtp,
    photoUrls: ['https://cdn.example.com/unboxing_photo.jpg'],
  });
  assert.strictEqual(blockedDropoff.success, false, '未通過雙照一致性審核前必須嚴格阻擋簽收');
  assert.ok(blockedDropoff.message.includes('雙照一致性審核'), '應提示未通過雙照一致性審核');
  assert.strictEqual(shipment.status, 'IN_TRANSIT');

  // 4. 執行【派發照片 vs 送達拆箱照片雙向一致性特徵比對】
  const consistencyRes = ComplianceAndSafetyModule.verifyPhotoConsistency({
    shipment,
    unboxingPhotoUrls: ['https://cdn.example.com/unboxing_photo.jpg'],
  });
  assert.strictEqual(consistencyRes.isApproved, true, '外觀完好比對應核准');
  assert.strictEqual(consistencyRes.decision, 'CONSISTENCY_APPROVED');
  assert.strictEqual(shipment.status, 'ARRIVED_DROPOFF', '狀態應更新為待簽收');

  // 5. 雙照一致性核准後，再次執行簽收 -> 順利通過並解鎖資金！
  const goodDropoff = ComplianceAndSafetyModule.verifyDropoff({
    shipment,
    travelerId,
    inputOtp: dropoffOtp,
    photoUrls: ['https://cdn.example.com/unboxing_photo.jpg'],
  });
  assert.strictEqual(goodDropoff.success, true, '審核通過後簽收應順利成功');
  assert.strictEqual(shipment.status, 'DELIVERED');

  // 解鎖資金
  const payout = escrowService.releaseEscrowToTraveler(shipment);
  assert.strictEqual(payout.travelerEarnings, quote.travelerEarnings);
  assert.strictEqual(travelerWallet.balanceTwd, quote.travelerEarnings);

  console.log('✅ 測試 3 通過: 雙照一致性審核前嚴格鎖定簽收，審核一致後順利完成簽收與 Escrow 解鎖撥款！');
}

console.log('\n🎉 所有 [Compliance & Safety & Escrow] 升級測試均 100% 順利通過！');
