import 'package:flutter/material.dart';
import '../models/transport_mode.dart';
import '../services/api_service.dart';

class SenderScreen extends StatefulWidget {
  const SenderScreen({super.key});

  @override
  State<SenderScreen> createState() => _SenderScreenState();
}

class _SenderScreenState extends State<SenderScreen> {
  TransportMode _selectedMode = TransportMode.motorcycle;
  String _pickupLocation = '台北車站 M8 門市';
  String _dropoffLocation = '台北市大安區忠孝敦化商辦';
  final TextEditingController _titleController = TextEditingController(text: '手工生乳捲蛋糕禮盒');
  double _weightKg = 2.5;
  double _declaredValue = 1200;
  double _distanceKm = 6.5;

  Map<String, dynamic>? _quote;
  bool _hasContraband = false;
  String _contrabandWarning = '';

  @override
  void initState() {
    super.initState();
    _recalculate();
  }

  void _onModeChanged(TransportMode mode) {
    setState(() {
      _selectedMode = mode;
      if (mode == TransportMode.motorcycle) {
        _pickupLocation = '新北三重菜寮門市';
        _dropoffLocation = '台北市大安區忠孝敦化商辦';
        _distanceKm = 6.5;
        _weightKg = 2.5;
        _titleController.text = '手工生乳捲蛋糕禮盒';
      } else if (mode == TransportMode.hsr) {
        _pickupLocation = '高鐵台北站 (THSR_TPE)';
        _dropoffLocation = '高鐵左營站 (THSR_ZUY)';
        _distanceKm = 300;
        _weightKg = 1.2;
        _titleController.text = '工控高精密通訊備品晶片';
      } else if (mode == TransportMode.car) {
        _pickupLocation = '台北內湖科學園區';
        _dropoffLocation = '國道一號新竹科學園區交流道';
        _distanceKm = 75;
        _weightKg = 18.0;
        _titleController.text = '大型充氣帳篷與折疊裝備組';
      } else if (mode == TransportMode.flight) {
        _pickupLocation = '台北松山機場 (TSA)';
        _dropoffLocation = '日本東京羽田機場 (HND)';
        _distanceKm = 2100;
        _weightKg = 3.0;
        _titleController.text = '台灣熟成高山茶葉禮盒';
      }
    });
    _recalculate();
  }

  void _checkContraband(String text) {
    const banned = ['瓦斯', '香腸', '肉乾', '生肉', '毒品', '大麻', '爆竹'];
    String? found;
    for (final b in banned) {
      if (text.contains(b)) {
        found = b;
        break;
      }
    }
    setState(() {
      if (found != null) {
        _hasContraband = true;
        _contrabandWarning = '智慧風控攔截：此品項包含大眾運輸或航空禁運字樣 "$found"';
      } else {
        _hasContraband = false;
        _contrabandWarning = '';
      }
    });
  }

  Future<void> _recalculate() async {
    final quote = await ApiService.getQuote(
      mode: _selectedMode,
      distanceKm: _distanceKm,
      weightKg: _weightKg,
      declaredValueTwd: _declaredValue,
    );
    setState(() {
      _quote = quote;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('順路快遞寄件', style: TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 運具選單
            const Text('選擇捎帶運具', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            SizedBox(
              height: 90,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: TransportMode.values.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final mode = TransportMode.values[index];
                  final isSelected = mode == _selectedMode;
                  return InkWell(
                    onTap: () => _onModeChanged(mode),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: 85,
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: isSelected ? Theme.of(context).primaryColor.withOpacity(0.12) : Theme.of(context).cardColor,
                        border: Border.all(
                          color: isSelected ? Theme.of(context).primaryColor : Colors.grey.withOpacity(0.3),
                          width: isSelected ? 2 : 1,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(mode.icon, color: isSelected ? Theme.of(context).primaryColor : Colors.grey, size: 28),
                          const SizedBox(height: 4),
                          Text(
                            mode.label,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                              color: isSelected ? Theme.of(context).primaryColor : null,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),

            // 地址與貨物輸入卡片
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.my_location, color: Colors.blue),
                      title: const Text('取件點', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      subtitle: Text(_pickupLocation, style: const TextStyle(fontWeight: FontWeight.w600)),
                    ),
                    const Divider(),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.location_on, color: Colors.red),
                      title: const Text('送達點', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      subtitle: Text(_dropoffLocation, style: const TextStyle(fontWeight: FontWeight.w600)),
                    ),
                    const Divider(),
                    TextField(
                      controller: _titleController,
                      decoration: const InputDecoration(
                        labelText: '貨物內容',
                        prefixIcon: Icon(Icons.inventory_2),
                        border: InputBorder.none,
                      ),
                      onChanged: _checkContraband,
                    ),
                  ],
                ),
              ),
            ),

            if (_hasContraband) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning, color: Colors.red, size: 20),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_contrabandWarning, style: const TextStyle(color: Colors.red, fontSize: 12))),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 16),

            // 報價明細卡片
            if (_quote != null) ...[
              Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('費用透明明細', style: TextStyle(fontWeight: FontWeight.bold)),
                          Text('${_quote!['totalAmount']} TWD', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.blue)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('旅人/騎士補貼收益:', style: TextStyle(color: Colors.grey, fontSize: 13)),
                          Text('+${_quote!['travelerEarnings']} TWD', style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 14)),
                        ],
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('平台營運服務費:', style: TextStyle(color: Colors.grey, fontSize: 13)),
                          Text('${_quote!['platformCommission']} TWD', style: const TextStyle(fontSize: 13)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _hasContraband
                    ? null
                    : () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('✅ 訂單已發布！款項已安全存入平台 Escrow 資金託管')),
                        );
                      },
                style: ElevatedButton.styleFrom(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: const Text('發布委託並鎖定託管資金', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
