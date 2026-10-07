import assert from 'node:assert';
import { PricingEngine } from '../src/modules/pricing/PricingEngine.ts';

console.log('🧪 正在執行 [PricingEngine] 多運具計費引擎單元測試...\n');

// 測試 1: 捷運市區通勤小資件 (台北捷運板南線 8km, 1.2kg, 價值 $800)
{
  const quote = PricingEngine.calculateQuote({
    transportMode: 'MRT',
    distanceKm: 8,
    weightKg: 1.2,
    declaredValueTwd: 800,
  });

  console.log('測試 1 (捷運):', quote);
  assert.strictEqual(quote.baseFare, 80, '捷運起跳價應為 $80');
  assert.strictEqual(quote.weightFee, 0, '1.2kg 在 2kg 免費額度內應為 $0');
  // distance fee: (8 - 3) * 5 = $25
  assert.strictEqual(quote.distanceFee, 25, '超額 5km 費用應為 $25');
  assert.strictEqual(quote.customsFee, 0, '境內無需報關費');
  assert.ok(quote.totalAmount > quote.travelerEarnings, '總金額需大於旅人收益');
  assert.strictEqual(quote.totalAmount, quote.travelerEarnings + quote.platformCommission, '總金額應等於旅人收益加平台抽成');
  console.log('✅ 測試 1 通過: 捷運市區計費符合預期');
}

// 測試 2: 高鐵跨城極速件 (台北至左營高鐵 300km, 2.5kg, 價值 $15000)
{
  const quote = PricingEngine.calculateQuote({
    transportMode: 'HSR',
    distanceKm: 300,
    weightKg: 2.5,
    declaredValueTwd: 15000,
  });

  console.log('測試 2 (高鐵):', quote);
  assert.strictEqual(quote.baseFare, 350, '高鐵起跳價應為 $350');
  // distance fee: floor((300 - 100) / 50) * 40 = 4 * 40 = $160
  assert.strictEqual(quote.distanceFee, 160, '300km 距離加成應為 $160');
  assert.strictEqual(quote.insuranceFee, 300, '保價 $15000 費率 2% 應為 $300');
  assert.ok(quote.travelerEarnings >= 600, '旅人收益應補貼高鐵單程票 (約 $600 以上)');
  console.log('✅ 測試 2 通過: 高鐵跨城計費符合預期');
}

// 測試 3: 國際航班行李空間捎帶 (台北松山飛日本東京羽田, 5kg, 價值 $10000)
{
  const quote = PricingEngine.calculateQuote({
    transportMode: 'FLIGHT',
    distanceKm: 2100,
    weightKg: 5,
    declaredValueTwd: 10000,
    isInternational: true,
  });

  console.log('測試 3 (國際航空):', quote);
  assert.strictEqual(quote.baseFare, 800, '國際航空起跳費應為 $800');
  // weight fee: (5 - 1) * 400 = $1600
  assert.strictEqual(quote.weightFee, 1600, '超重 4kg 每公斤 $400 應為 $1600');
  assert.strictEqual(quote.customsFee, 200, '國際報關合規處理費應為 $200');
  assert.strictEqual(quote.insuranceFee, 300, '國際保價 3% 應為 $300');
  assert.strictEqual(quote.totalAmount, 800 + 1600 + 200 + 300, '國際航班總費用應為 $2900');
  console.log('✅ 測試 3 通過: 國際航空行李空間計費符合預期');
}

// 測試 4: 境內私家車/自駕車順路捎帶 (台北內湖至新竹科學園區 75km, 18kg 大件露營/設備包裹, 價值 $12000)
{
  const quote = PricingEngine.calculateQuote({
    transportMode: 'CAR',
    distanceKm: 75,
    weightKg: 18,
    declaredValueTwd: 12000,
  });

  console.log('測試 4 (境內自駕私家車):', quote);
  assert.strictEqual(quote.baseFare, 160, '汽車起跳價應為 $160');
  // weight fee: (18 - 5) * 10 = $130
  assert.strictEqual(quote.weightFee, 130, '超重 13kg 後車廂載重費用應為 $130');
  // distance fee: 180 + (75 - 20) * 7 = 180 + 385 = $565
  assert.strictEqual(quote.distanceFee, 565, '國道 75km 里程與過路費補貼應為 $565');
  assert.strictEqual(quote.insuranceFee, 180, '保價 $12000 費率 1.5% 應為 $180');
  assert.strictEqual(quote.totalAmount, 160 + 130 + 565 + 180, '汽車總費用應為 $1035');
  assert.ok(quote.travelerEarnings >= 850, '車主實得收益應超過 $850 (足額補貼油資與 eTag 過路費)');
  console.log('✅ 測試 4 通過: 境內自駕私家車長途油資與大件計費符合預期');
}

// 測試 5: 同城機車外送／通勤順路 (三重至台北大安區 6.0km, 3.5kg, 價值 $1500)
{
  const quote = PricingEngine.calculateQuote({
    transportMode: 'MOTORCYCLE',
    distanceKm: 6.0,
    weightKg: 3.5,
    declaredValueTwd: 1500,
  });

  console.log('測試 5 (機車外送/速克達順路):', quote);
  assert.strictEqual(quote.baseFare, 75, '機車起跳價應為 $75');
  // weight fee: (3.5 - 2) * 12 = $18
  assert.strictEqual(quote.weightFee, 18, '超重 1.5kg 置物空間費用應為 $18');
  // distance fee: (6.0 - 3) * 12 = $36
  assert.strictEqual(quote.distanceFee, 36, '超額 3km 機車里程油耗費用應為 $36');
  assert.strictEqual(quote.insuranceFee, 15, '保價 $1500 費率 1% 應為 $15');
  assert.strictEqual(quote.totalAmount, 75 + 18 + 36 + 15, '機車總費用應為 $144');
  assert.strictEqual(quote.travelerEarnings, 144 - Math.round(144 * 0.15), '騎士收益應為扣除 15% 抽成後實得 $122');
  console.log('✅ 測試 5 通過: 同城機車外送即時到府計費符合預期');
}

console.log('\n🎉 所有 [PricingEngine] 測試均順利通過！');
