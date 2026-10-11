import 'package:flutter/material.dart';

enum TransportMode {
  motorcycle,
  bicycle,
  mrt,
  car,
  hsr,
  domesticFlight,
  flight,
}

extension TransportModeExtension on TransportMode {
  String get code {
    switch (this) {
      case TransportMode.motorcycle:
        return 'MOTORCYCLE';
      case TransportMode.bicycle:
        return 'BICYCLE';
      case TransportMode.mrt:
        return 'MRT';
      case TransportMode.car:
        return 'CAR';
      case TransportMode.hsr:
        return 'HSR';
      case TransportMode.domesticFlight:
        return 'DOMESTIC_FLIGHT';
      case TransportMode.flight:
        return 'FLIGHT';
    }
  }

  String get label {
    switch (this) {
      case TransportMode.motorcycle:
        return '機車外送';
      case TransportMode.bicycle:
        return '腳踏車/YouBike';
      case TransportMode.mrt:
        return '捷運通勤';
      case TransportMode.car:
        return '私家車';
      case TransportMode.hsr:
        return '台灣高鐵';
      case TransportMode.domesticFlight:
        return '國內航空';
      case TransportMode.flight:
        return '國際航班';
    }
  }

  IconData get icon {
    switch (this) {
      case TransportMode.motorcycle:
        return Icons.two_wheeler;
      case TransportMode.bicycle:
        return Icons.pedal_bike;
      case TransportMode.mrt:
        return Icons.subway;
      case TransportMode.car:
        return Icons.directions_car;
      case TransportMode.hsr:
        return Icons.train;
      case TransportMode.domesticFlight:
        return Icons.flight_takeoff;
      case TransportMode.flight:
        return Icons.flight;
    }
  }

  String get description {
    switch (this) {
      case TransportMode.motorcycle:
        return '同城即時到府直送';
      case TransportMode.bicycle:
        return '市區短距低碳綠色捎帶';
      case TransportMode.mrt:
        return '市區捷運站點面交';
      case TransportMode.car:
        return '跨城自駕後車廂油資補貼';
      case TransportMode.hsr:
        return '3hr 北高極速互達';
      case TransportMode.domesticFlight:
        return '50分鐘金門/澎湖離島極速空運';
      case TransportMode.flight:
        return '出國行李空間跨境捎帶';
    }
  }
}
