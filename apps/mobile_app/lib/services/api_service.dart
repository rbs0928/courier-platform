import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/transport_mode.dart';

class ApiService {
  // 本機開發伺服器位址 (若使用 Android 模擬器可改為 http://10.0.2.2:3000)
  static const String baseUrl = 'http://localhost:3000';

  /// 即時費用試算
  static Future<Map<String, dynamic>> getQuote({
    required TransportMode mode,
    required double distanceKm,
    required double weightKg,
    required double declaredValueTwd,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/quote'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'transportMode': mode.code,
          'distanceKm': distanceKm,
          'weightKg': weightKg,
          'declaredValueTwd': declaredValueTwd,
          'isInternational': mode == TransportMode.flight,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['data'];
      }
    } catch (_) {
      // 離線或未連線時提供本機演算法計算備援
    }

    return _fallbackCalculateQuote(mode, distanceKm, weightKg, declaredValueTwd);
  }

  /// 本機備援計算法 (確保無伺服器時 App 亦能流暢展示)
  static Map<String, dynamic> _fallbackCalculateQuote(
    TransportMode mode,
    double distanceKm,
    double weightKg,
    double declaredValueTwd,
  ) {
    double base = 75;
    double distFee = 0;
    double weightFee = 0;
    double customs = 0;
    double ins = (declaredValueTwd * 0.01).clamp(10, 9999).toDouble();
    double rate = 0.15;

    switch (mode) {
      case TransportMode.motorcycle:
        base = 75;
        distFee = (distanceKm > 3 ? (distanceKm - 3) * 12 : 0);
        weightFee = (weightKg > 2 ? (weightKg - 2) * 12 : 0);
        rate = 0.15;
        break;
      case TransportMode.mrt:
        base = 80;
        distFee = (distanceKm > 3 ? (distanceKm - 3) * 5 : 0);
        weightFee = (weightKg > 2 ? (weightKg - 2) * 15 : 0);
        rate = 0.15;
        break;
      case TransportMode.car:
        base = 160;
        distFee = distanceKm <= 20 ? (distanceKm - 5).clamp(0, 999) * 12 : 180 + (distanceKm - 20) * 7;
        weightFee = (weightKg > 5 ? (weightKg - 5) * 10 : 0);
        ins = (declaredValueTwd * 0.015).clamp(15, 9999).toDouble();
        rate = 0.16;
        break;
      case TransportMode.hsr:
        base = 350;
        distFee = ((distanceKm - 100).clamp(0, 999) / 50).floor() * 40;
        weightFee = (weightKg > 3 ? (weightKg - 3) * 30 : 0);
        ins = (declaredValueTwd * 0.02).clamp(20, 9999).toDouble();
        rate = 0.18;
        break;
      case TransportMode.flight:
        base = 800;
        distFee = 0;
        weightFee = (weightKg > 1 ? (weightKg - 1) * 400 : 0);
        customs = 200;
        ins = (declaredValueTwd * 0.03).clamp(30, 9999).toDouble();
        rate = 0.20;
        break;
    }

    final total = (base + distFee + weightFee + ins + customs).round();
    final commission = (total * rate).round();
    final earnings = total - commission;

    return {
      'transportMode': mode.code,
      'baseFare': base.round(),
      'distanceFee': distFee.round(),
      'weightFee': weightFee.round(),
      'insuranceFee': ins.round(),
      'customsFee': customs.round(),
      'totalAmount': total,
      'travelerEarnings': earnings,
      'platformCommission': commission,
    };
  }
}
