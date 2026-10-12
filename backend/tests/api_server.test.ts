import assert from 'node:assert';
import http from 'node:http';
import { createServer } from '../src/server.ts';

console.log('🧪 正在執行 [API Server] 整合端點測試 (含法規庫、Google Maps、AI審核與雙照一致性)...\n');

const server = createServer();
const TEST_PORT = 3199;

server.listen(TEST_PORT, async () => {
  try {
    const baseUrl = `http://localhost:${TEST_PORT}`;

    // 1. 測試 /health
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = await healthRes.json();
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthJson.status, 'ok');
    console.log('✅ GET /health 通過');

    // 2. 測試 /api/hubs
    const hubsRes = await fetch(`${baseUrl}/api/hubs`);
    const hubsJson = await hubsRes.json();
    assert.strictEqual(hubsRes.status, 200);
    assert.ok(hubsJson.data.length >= 13, '應返回包含國內機場與自行車站點的樞紐清單');
    console.log(`✅ GET /api/hubs 通過 (共 ${hubsJson.data.length} 個大眾運輸/國內航空/單車樞紐)`);

    // 3. 測試 /api/quote 報價試算 (含腳踏車與國內航空)
    const quoteRes = await fetch(`${baseUrl}/api/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transportMode: 'DOMESTIC_FLIGHT',
        distanceKm: 300,
        weightKg: 2,
        declaredValueTwd: 5000,
      }),
    });
    const quoteJson = await quoteRes.json();
    assert.strictEqual(quoteRes.status, 200);
    assert.strictEqual(quoteJson.data.transportMode, 'DOMESTIC_FLIGHT');
    assert.ok(quoteJson.data.travelerEarnings > 0);
    console.log('✅ POST /api/quote 通過 (試算國內航空離島報價成功)');

    // 4. 測試 /api/matching/shipments/:id 時空走廊媒合
    const matchRes = await fetch(`${baseUrl}/api/matching/shipments/PKG_HSR_01`);
    const matchJson = await matchRes.json();
    assert.strictEqual(matchRes.status, 200);
    assert.ok(matchJson.totalMatches >= 1, '應成功媒合到高鐵商務客行程');
    console.log(`✅ GET /api/matching/shipments/:id 通過 (媒合命中 ${matchJson.totalMatches} 筆旅人行程)`);

    // 5. 測試 AI 違禁品攔截防禦
    const contrabandRes = await fetch(`${baseUrl}/api/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '生鮮黑豬肉香腸火腿',
        description: '真空生肉',
        isInternational: true,
      }),
    });
    const contrabandJson = await contrabandRes.json();
    assert.strictEqual(contrabandRes.status, 400);
    assert.strictEqual(contrabandJson.error, 'CONTRABAND_REJECTED');
    console.log('✅ POST /api/shipments 違禁品 AI 防護直接攔截通過');

    // 5.1 測試寄件人缺少收件人詳細資訊 (姓名/電話/準確位置) 正確被攔截
    const missingRecipientRes = await fetch(`${baseUrl}/api/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '精密筆記型電腦',
        description: '盒裝完整',
        // 未提供 recipientName, recipientPhone, dropoffLocation
      }),
    });
    const missingRecipientJson = await missingRecipientRes.json();
    assert.strictEqual(missingRecipientRes.status, 400);
    assert.ok(missingRecipientJson.error.startsWith('MISSING_RECIPIENT_'), '缺少收件人姓名/電話應被嚴格攔截');
    console.log('✅ POST /api/shipments 寄件人未填寫收件人詳細資訊正確被攔截');

    // 5.2 測試寄件人完整填寫收件人詳細資訊並成功發布
    const createShipmentRes = await fetch(`${baseUrl}/api/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '重要商務合約正本',
        description: '加蓋公司印鑑之公文袋',
        category: 'DOCUMENT',
        recipientName: '林董事長特助李明',
        recipientPhone: '0933-777-888',
        dropoffLocation: {
          name: '台北 101 大樓 1 樓松智路大廳會面點',
          address: '台北市信義區信義路五段7號',
          lat: 25.0339,
          lng: 121.5645,
        },
        pickupLocation: {
          name: '台北車站 M8 出口前',
          address: '台北市中正區忠孝西路一段49號',
          lat: 25.0462,
          lng: 121.5175,
        },
        transportModePreference: 'MRT',
      }),
    });
    const createShipmentJson = await createShipmentRes.json();
    assert.strictEqual(createShipmentRes.status, 201);
    const createdShipmentId = createShipmentJson.data.id;
    assert.strictEqual(createShipmentJson.data.recipientName, '林董事長特助李明');
    console.log(`✅ POST /api/shipments 完整收件人資訊發布成功 (ID: ${createdShipmentId})`);

    // 5.3 測試查詢三方透明化資訊 (確保旅人知悉貨由誰寄出、貨寄到誰手上與準確面交位置)
    const triRes = await fetch(`${baseUrl}/api/shipments/${createdShipmentId}/tripartite`);
    const triJson = await triRes.json();
    assert.strictEqual(triRes.status, 200);
    assert.strictEqual(triJson.data.recipient.realName, '林董事長特助李明');
    assert.strictEqual(triJson.data.recipient.phone, '0933-777-888');
    assert.ok(triJson.data.recipient.dropoffLocation.name.includes('台北 101'), '終點面交位置需透明可見');
    console.log('✅ GET /api/shipments/:id/tripartite 三方身分與面交位置透明化查詢通過');

    // 5.4 測試三方雙向溝通對話板 (訊息收發)
    const postMsgRes = await fetch(`${baseUrl}/api/shipments/${createdShipmentId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderRole: 'TRAVELER',
        senderName: '陳旅人 (捷運通勤族)',
        message: '您好！我預計 15 分鐘後抵達 101 松智路大廳，請收件人備妥身分證件進行現場開箱驗收。',
      }),
    });
    const postMsgJson = await postMsgRes.json();
    assert.strictEqual(postMsgRes.status, 201);

    const getMsgRes = await fetch(`${baseUrl}/api/shipments/${createdShipmentId}/messages`);
    const getMsgJson = await getMsgRes.json();
    assert.strictEqual(getMsgRes.status, 200);
    assert.ok(getMsgJson.data.length >= 2, '應包含系統初始訊息與旅人發送訊息');
    console.log(`✅ /api/shipments/:id/messages 三方即時雙向溝通訊息收發通過 (目前 ${getMsgJson.data.length} 則通訊紀錄)`);

    // 6. 測試 /api/compliance/regulations 航空各國法規庫
    const regsRes = await fetch(`${baseUrl}/api/compliance/regulations`);
    const regsJson = await regsRes.json();
    assert.strictEqual(regsRes.status, 200);
    assert.ok(regsJson.data.length >= 5, '應包含 IATA DGR, ICAO, 台灣 CAA, 日本稅關等權威法規');
    console.log(`✅ GET /api/compliance/regulations 通過 (共 ${regsJson.data.length} 條權威航空海關法規)`);

    // 7. 測試 /api/maps/places/autocomplete Google Maps 地點自動完成整合
    const mapsRes = await fetch(`${baseUrl}/api/maps/places/autocomplete?input=台北車站`);
    const mapsJson = await mapsRes.json();
    assert.strictEqual(mapsRes.status, 200);
    assert.ok(mapsJson.data.length > 0, '應成功返回 Google Places 建議候選');
    console.log(`✅ GET /api/maps/places/autocomplete 通過 (搜尋命中 ${mapsJson.data.length} 處地點)`);

    // 8. 測試 /api/auth/send-otp 發送手機驗證碼 (含 Email 帳號與真實證件姓名)
    const otpRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'chen.xiaomei@globalcourier.com',
        realName: '陳小美',
        phone: '0977-888-999',
        purpose: 'REGISTER',
      }),
    });
    const otpJson = await otpRes.json();
    assert.strictEqual(otpRes.status, 200);
    assert.ok(otpJson.debugOtp, '應回傳動態驗證碼供客戶端模擬驗收');
    console.log(`✅ POST /api/auth/send-otp 通過 (產生驗證碼: ${otpJson.debugOtp})`);

    // 9. 測試 /api/auth/verify-otp 完成新用戶 Email 帳號、真實姓名與手機雙重驗證註冊
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'chen.xiaomei@globalcourier.com',
        realName: '陳小美',
        phone: '0977-888-999',
        otp: otpJson.debugOtp,
        preferredRole: 'SENDER',
      }),
    });
    const verifyJson = await verifyRes.json();
    assert.strictEqual(verifyRes.status, 200);
    assert.ok(verifyJson.session && verifyJson.session.token, '應核發 Session Token');
    assert.strictEqual(verifyJson.session.user.email, 'chen.xiaomei@globalcourier.com', '帳號名稱應為 Email');
    assert.strictEqual(verifyJson.session.user.realName, '陳小美', '真實姓名應與證件登記相符');
    assert.strictEqual(verifyJson.session.user.isPhoneVerified, true, '手機狀態應為已驗證');
    console.log(`✅ POST /api/auth/verify-otp 通過 (用戶 [${verifyJson.session.user.realName} (${verifyJson.session.user.email})] 成功雙重驗證註冊啟用帳號)`);

    // 10. 測試 /api/auth/me 憑 Token 查詢當前登入者
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${verifyJson.session.token}` },
    });
    const meJson = await meRes.json();
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meJson.user.realName, '陳小美');
    assert.strictEqual(meJson.user.email, 'chen.xiaomei@globalcourier.com');
    console.log('✅ GET /api/auth/me 憑 Token 驗證當前登入者資訊通過');

    // 10.1 測試 /api/escrow/topup 模擬線上金流儲值
    const topupRes = await fetch(`${baseUrl}/api/escrow/topup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${verifyJson.session.token}`,
      },
      body: JSON.stringify({ amount: 1500, paymentMethod: 'CREDIT_CARD' }),
    });
    const topupJson = await topupRes.json();
    assert.strictEqual(topupRes.status, 200);
    assert.strictEqual(topupJson.newBalance, 2500, '儲值 1500 + 原體驗金 1000 應為 2500');
    console.log(`✅ POST /api/escrow/topup 通過 (金流儲值 NT$ 1,500 成功，新餘額: NT$ ${topupJson.newBalance})`);

    // 11. 測試 /api/auth/logout 安全登出
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${verifyJson.session.token}` },
    });
    assert.strictEqual(logoutRes.status, 200);
    console.log('✅ POST /api/auth/logout 安全登出通過');

    console.log('\n🎉 所有 [API Server] 整合測試均順利通過！');
  } catch (err) {
    console.error('❌ API 測試失敗:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
