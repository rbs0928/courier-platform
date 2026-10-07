import 'package:flutter/material.dart';

class TravelerScreen extends StatefulWidget {
  const TravelerScreen({super.key});

  @override
  State<TravelerScreen> createState() => _TravelerScreenState();
}

class _TravelerScreenState extends State<TravelerScreen> {
  int _orderStatus = 0; // 0: Available, 1: Accepted, 2: InTransit, 3: Delivered
  final TextEditingController _pickupOtpController = TextEditingController(text: '882314');
  final TextEditingController _dropoffOtpController = TextEditingController(text: '991205');

  void _acceptOrder() {
    setState(() {
      _orderStatus = 1;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('🎉 接單成功！請前往取件點執行開箱驗視協議')),
    );
  }

  void _verifyPickup() {
    if (_pickupOtpController.text.trim() == '882314') {
      setState(() {
        _orderStatus = 2;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('✅ 取件 OTP 驗證通過！包裹正式進入運送中 [IN_TRANSIT]')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('❌ 取件驗證碼錯誤，請向寄件人確認')),
      );
    }
  }

  void _verifyDropoff() {
    if (_dropoffOtpController.text.trim() == '991205') {
      setState(() {
        _orderStatus = 3;
      });
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('🎉 交付完成！'),
          content: const Text('收件人簽收成功！平台資金託管 (Escrow) 已即時解鎖，收益 +664 TWD 已匯入您的個人錢包！'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('完成'),
            ),
          ],
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('❌ 簽收驗證碼錯誤，請向收件人確認')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('順路接單大廳', style: TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.account_balance_wallet),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('💰 錢包餘額: \$1,520 TWD ｜ 託管中: \$664 TWD')),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 當前登記行程卡片
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              color: Colors.blue.withOpacity(0.08),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('🚄 台灣高鐵 115 次 (直達車)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: Colors.green.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                          child: const Text('時空走廊匹配中', style: TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text('高鐵台北站 ➔ 高鐵左營站 ｜ 14:00 發車', style: TextStyle(fontSize: 13, color: Colors.grey)),
                    const SizedBox(height: 4),
                    const Text('閒置載重空間: 剩餘 8.0 kg (登機箱容積)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),
            const Text('🎯 時空走廊推薦順路包裹', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),

            // 推薦包裹卡片
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('工控高精密通訊備品晶片', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                        const Text('+$664 TWD', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 18)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text('取件: 台北車站 M8 門市 ➔ 送達: 左營站 4 號出入口', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.near_me, size: 14, color: Colors.blue),
                        const SizedBox(width: 4),
                        const Text('繞路偏差: 0 km (站點面交)', style: TextStyle(fontSize: 12, color: Colors.blue)),
                        const SizedBox(width: 12),
                        const Icon(Icons.timer, size: 14, color: Colors.orange),
                        const SizedBox(width: 4),
                        const Text('餘裕: 120 分鐘', style: TextStyle(fontSize: 12, color: Colors.orange)),
                      ],
                    ),
                    const SizedBox(height: 16),

                    if (_orderStatus == 0)
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _acceptOrder,
                          style: ElevatedButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                          child: const Text('立即接單並鎖定託管資金'),
                        ),
                      ),

                    if (_orderStatus == 1) ...[
                      const Divider(),
                      const Text('📍 步驟 1：開箱驗視存證與取件', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _pickupOtpController,
                        decoration: const InputDecoration(
                          labelText: '寄件人取件 OTP',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _verifyPickup,
                          child: const Text('核驗開箱拍照並完成取件'),
                        ),
                      ),
                    ],

                    if (_orderStatus == 2) ...[
                      const Divider(),
                      const Text('🚆 步驟 2：抵達目的地並交付簽收', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _dropoffOtpController,
                        decoration: const InputDecoration(
                          labelText: '收件人簽收 OTP',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _verifyDropoff,
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                          child: const Text('核驗簽收並解鎖託管資金'),
                        ),
                      ),
                    ],

                    if (_orderStatus == 3) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                        child: const Row(
                          children: [
                            Icon(Icons.check_circle, color: Colors.green),
                            SizedBox(width: 8),
                            Text('訂單已順利簽收完成 [DELIVERED]', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
