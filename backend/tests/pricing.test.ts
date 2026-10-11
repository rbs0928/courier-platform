import assert from 'node:assert';
import { PricingEngine } from '../src/modules/pricing/PricingEngine.ts';

console.log('🧪 正在執行 [PricingEngine] 多運具計費引擎單元測試 (含腳踏車與國內航空)...\n');

// 測試 1: 捷運市區通勤小資件 (台北捷運板南線 8km, 1.2kg, 價值 $800)
{
  const quote = PricingEngine.calculateQuote({
    transportMode: 'MRT',
    distanceKm: 8,
    weightKg: 1.2,
    declaredValueTwd: 800,
  });

  assert.strictEqual(quote.baseFare, 80, '捷運起跳價應為 $80');
  assert.strictEqual(quote.weightFee, 0, '1.2kg 在 2kg 免費額度內應為 $0');
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

  assert.strictEqual(quote.baseFare, 350, '高鐵起跳價應為 $350');
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

  assert.strictEqual(quote.baseFare, 800, '國際航空起跳費應為 $800');
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

  assert.strictEqual(quote.baseFare, 160, '汽車起跳價應為 $160');
  assert.strictEqual(quote.weightFee, 130, '超重 13kg 後車廂載重費用應為 $130');
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

  assert.strictEqual(quote.baseFare, 75, '機車起跳價應為 $75');
  assert.strictEqual(quote.weightFee, 18, '超重 1.5kg 置物空間費用應為 $18');
  assert.strictEqual(quote.distanceFee, 36, '超額 3km 機車里程油耗費用應為 $36');
  assert.strictEqual(quote.insuranceFee, 15, '保價 $1500 費率 1% 應為 $15');
  assert.strictEqual(quote.totalAmount, 75 + 18 + 36 + 15, '機車總費用應為 $144');
  console.log('✅ 測試 5 通過: 同城機車外送即時到府計費符合預期');
}

// 測試 6: 腳踏車 / YouBike 2.0 綠色短程捎帶 (公館至大安區 3.8km, 1.5kg, 價值 $800)
{
  const quote = PricingEngine.calculateQuote({
    transportMode: 'BICYCLE',
    distanceKm: 3.8,
    weightKg: 1.5,
    declaredValueTwd: 800,
  });

  assert.strictEqual(quote.baseFare, 60, '腳踏車起跳價應為 $60');
  // distance fee: (3.8 - 2) * 8 = 1.8 * 8 = 14.4 -> 14
  assert.strictEqual(quote.distanceFee, 14, '超額 1.8km 腳踏車騎乘補貼應為 $14');
  assert.strictEqual(quote.weightFee, 0, '1.5kg 在 2kg 額度內應為 $0');
  assert.strictEqual(quote.insuranceFee, 10, '最低保費應為 $10');
  assert.strictEqual(quote.platformCommission, Math.round((60 + 14 + 10) * 0.12), '應享有 12% 綠色低碳優惠抽成');
  console.log('✅ 測試 6 通過: 腳踏車 / YouBike 綠色短程計費與低碳抽成優惠符合預期');
}

// 測試 7: 國內航空離島極速捎帶 (松山飛澎湖馬公 300km, 3.0kg, 價值 $5000)
{
  const quote = PricingEngine.calculateQuote({
    transportMode: 'DOMESTIC_FLIGHT',
    distanceKm: 300,
    weightKg: 3.0,
    declaredValueTwd: 5000,
  });

  assert.strictEqual(quote.baseFare, 480, '國內航空起跳價應為 $480');
  // weight fee: (3.0 - 2) * 120 = $120
  assert.strictEqual(quote.weightFee, 120, '國內線超重 1kg 費用應為 $120');
  assert.strictEqual(quote.distanceFee, 150, '離島跨海航線補貼應為 $150');
  assert.strictEqual(quote.customsFee, 0, '國內航線免報關費');
  assert.strictEqual(quote.insuranceFee, 100, '保價 $5000 費率 2% 應為 $100');
  assert.strictEqual(quote.totalAmount, 480 + 120 + 150 + 100, '國內航空總金額應為 $850');
  console.log('✅ 測試 7 通過: 國內航空離島航線空運計費符合預期');
}

console.log('\n🎉 所有 [PricingEngine] 測試均順利通過！');
