import assert from 'node:assert';
import http from 'node:http';
import { createServer } from '../src/server.ts';

console.log('🧪 正在執行 [API Server] 整合端點測試...\n');

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
    assert.ok(hubsJson.data.length > 0, '應返回樞紐站點清單');
    console.log(`✅ GET /api/hubs 通過 (共 ${hubsJson.data.length} 個大眾運輸/航空樞紐)`);

    // 3. 測試 /api/quote 報價試算
    const quoteRes = await fetch(`${baseUrl}/api/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transportMode: 'HSR',
        distanceKm: 300,
        weightKg: 2,
        declaredValueTwd: 10000,
      }),
    });
    const quoteJson = await quoteRes.json();
    assert.strictEqual(quoteRes.status, 200);
    assert.strictEqual(quoteJson.data.transportMode, 'HSR');
    assert.ok(quoteJson.data.travelerEarnings > 0);
    console.log('✅ POST /api/quote 通過 (試算高鐵報價成功)');

    // 4. 測試 /api/matching/shipments/:id 時空走廊媒合
    const matchRes = await fetch(`${baseUrl}/api/matching/shipments/PKG_HSR_01`);
    const matchJson = await matchRes.json();
    assert.strictEqual(matchRes.status, 200);
    assert.ok(matchJson.totalMatches >= 1, '應成功媒合到高鐵商務客行程');
    console.log(`✅ GET /api/matching/shipments/:id 通過 (媒合命中 ${matchJson.totalMatches} 筆旅人行程)`);

    // 5. 測試違禁品攔截防禦
    const contrabandRes = await fetch(`${baseUrl}/api/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '生鮮黑豬肉火腿',
        description: '真空生肉',
        isInternational: true,
      }),
    });
    const contrabandJson = await contrabandRes.json();
    assert.strictEqual(contrabandRes.status, 400);
    assert.strictEqual(contrabandJson.error, 'CONTRABAND_DETECTED');
    console.log('✅ POST /api/shipments 違禁品防護攔截通過');

    console.log('\n🎉 所有 [API Server] 整合測試均順利通過！');
  } catch (err) {
    console.error('❌ API 測試失敗:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
