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

    // 8. 測試 /api/auth/send-otp 發送手機驗證碼
    const otpRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0977-888-999', purpose: 'REGISTER' }),
    });
    const otpJson = await otpRes.json();
    assert.strictEqual(otpRes.status, 200);
    assert.ok(otpJson.debugOtp, '應回傳動態驗證碼供客戶端模擬驗收');
    console.log(`✅ POST /api/auth/send-otp 通過 (產生驗證碼: ${otpJson.debugOtp})`);

    // 9. 測試 /api/auth/verify-otp 完成新用戶手機驗證與帳號啟用
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '0977-888-999',
        otp: otpJson.debugOtp,
        name: '陳小美 (寄件兼收件人)',
        preferredRole: 'SENDER',
      }),
    });
    const verifyJson = await verifyRes.json();
    assert.strictEqual(verifyRes.status, 200);
    assert.ok(verifyJson.session && verifyJson.session.token, '應核發 Session Token');
    assert.strictEqual(verifyJson.session.user.isPhoneVerified, true, '手機狀態應為已驗證');
    console.log(`✅ POST /api/auth/verify-otp 通過 (用戶 [${verifyJson.session.user.name}] 成功註冊啟用帳號)`);

    // 10. 測試 /api/auth/me 憑 Token 查詢當前登入者
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${verifyJson.session.token}` },
    });
    const meJson = await meRes.json();
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meJson.user.name, '陳小美 (寄件兼收件人)');
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
