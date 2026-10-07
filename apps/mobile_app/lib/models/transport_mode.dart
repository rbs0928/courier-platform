import 'package:flutter/material.dart';

enum TransportMode {
  motorcycle,
  mrt,
  car,
  hsr,
  flight,
}

extension TransportModeExtension on TransportMode {
  String get code {
    switch (this) {
      case TransportMode.motorcycle:
        return 'MOTORCYCLE';
      case TransportMode.mrt:
        return 'MRT';
      case TransportMode.car:
        return 'CAR';
      case TransportMode.hsr:
        return 'HSR';
      case TransportMode.flight:
        return 'FLIGHT';
    }
  }

  String get label {
    switch (this) {
      case TransportMode.motorcycle:
        return '機車外送';
      case TransportMode.mrt:
        return '捷運通勤';
      case TransportMode.car:
        return '私家車';
      case TransportMode.hsr:
        return '台灣高鐵';
      case TransportMode.flight:
        return '國際航班';
    }
  }

  IconData get icon {
    switch (this) {
      case TransportMode.motorcycle:
        return Icons.two_wheeler;
      case TransportMode.mrt:
        return Icons.subway;
      case TransportMode.car:
        return Icons.directions_car;
      case TransportMode.hsr:
        return Icons.train;
      case TransportMode.flight:
        return Icons.flight;
    }
  }

  String get description {
    switch (this) {
      case TransportMode.motorcycle:
        return '同城即時到府直送';
      case TransportMode.mrt:
        return '市區捷運站點面交';
      case TransportMode.car:
        return '跨城自駕後車廂油資補貼';
      case TransportMode.hsr:
        return '3hr 北高極速互達';
      case TransportMode.flight:
        return '出國行李空間跨境捎帶';
    }
  }
}
