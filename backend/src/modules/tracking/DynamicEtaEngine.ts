import type {
  GeoCoordinate,
  LocationPoint,
  PackageShipment,
  TransportMode,
  LiveTrackingState,
  LiveLocationUpdate,
} from '../../types/index.ts';

export class DynamicEtaEngine {
  /**
   * 各運具之實時平均運行速度基準 (km/h)
   */
  public static readonly TRANSPORT_SPEED_KMH: Record<TransportMode, number> = {
    WALKING: 4.5,
    BICYCLE: 15,
    MOTORCYCLE: 32,
    MRT: 35,
    BUS: 20,
    CAR: 50,
    TRAIN: 80,
    HSR: 230,
    DOMESTIC_FLIGHT: 450,
    FLIGHT: 750,
  };

  /**
   * 計算兩 GPS 點之間的地面球面距離 (Haversine Formula，回傳公里)
   */
  public static calculateDistanceKm(coord1: GeoCoordinate, coord2: GeoCoordinate): number {
    const R = 6371; // 地球半徑 (km)
    const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1.lat * Math.PI) / 180) *
        Math.cos((coord2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightKm = R * c;

    return Math.round(straightKm * 100) / 100;
  }

  /**
   * 根據運具折算道路/路線實際行走距離 (道路繞路係數)
   */
  public static getRouteDistanceKm(straightKm: number, mode: TransportMode): number {
    let routeFactor = 1.25; // 市區道路平均折算係數
    if (mode === 'DOMESTIC_FLIGHT' || mode === 'FLIGHT') {
      routeFactor = 1.05; // 航空航線直線度高
    } else if (mode === 'HSR' || mode === 'TRAIN') {
      routeFactor = 1.15; // 軌道走廊
    } else if (mode === 'WALKING' || mode === 'BICYCLE') {
      routeFactor = 1.20; // 巷弄穿透性
    }
    return Math.round(straightKm * routeFactor * 100) / 100;
  }

  /**
   * 依據即時剩餘距離與運具速度，動態推算預估剩餘時間 (分鐘)
   */
  public static calculateRemainingMinutes(
    distanceKm: number,
    mode: TransportMode,
    realtimeSpeedKmh?: number
  ): number {
    if (distanceKm <= 0.05) {
      return 1; // 已在現場 100m 內
    }

    // 若有感測器實時速度且合理 (>5km/h)，結合基準速度加權平滑
    const baseSpeed = this.TRANSPORT_SPEED_KMH[mode] || 30;
    let effectiveSpeed = baseSpeed;

    if (realtimeSpeedKmh && realtimeSpeedKmh > 5 && realtimeSpeedKmh < baseSpeed * 1.8) {
      effectiveSpeed = Math.round(baseSpeed * 0.4 + realtimeSpeedKmh * 0.6);
    }

    // 計算純行車時數
    const travelHours = distanceKm / effectiveSpeed;
    let travelMinutes = travelHours * 60;

    // 加入紅綠燈、進出站或會面等待緩衝時間 (Buffer Minutes)
    let bufferMinutes = 2;
    if (mode === 'HSR' || mode === 'TRAIN') bufferMinutes = 5;
    if (mode === 'DOMESTIC_FLIGHT' || mode === 'FLIGHT') bufferMinutes = 15;

    const totalMinutes = Math.max(1, Math.round(travelMinutes + bufferMinutes));
    return totalMinutes;
  }

  /**
   * 格式化預估到達時間字串 (HH:mm)
   */
  public static formatArrivalTime(remainingMinutes: number, fromDate: Date = new Date()): string {
    const arrivalTime = new Date(fromDate.getTime() + remainingMinutes * 60 * 1000);
    const hours = String(arrivalTime.getHours()).padStart(2, '0');
    const minutes = String(arrivalTime.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * 核心推算方法：綜合計算全單實時追蹤狀態與動態剩餘時間
   *
   * 涵蓋：
   * 1. 媒合成功後 (ACCEPTED / MATCHING)：取得寄件人即時定位，於旅人端顯示寄貨人與收貨人定位，推算抵達取件點剩餘時間。
   * 2. 取件後運送中 (IN_TRANSIT)：於收貨人端顯示旅人即時定位，推算抵達終點收貨人所剩餘時間。
   */
  public static computeTrackingState(params: {
    shipment: PackageShipment;
    senderLiveUpdate?: LiveLocationUpdate;
    travelerLiveUpdate?: LiveLocationUpdate;
    travelerDefaultLocation?: GeoCoordinate;
  }): LiveTrackingState {
    const { shipment, senderLiveUpdate, travelerLiveUpdate, travelerDefaultLocation } = params;
    const mode = shipment.transportModePreference || 'MOTORCYCLE';
    const baseSpeed = this.TRANSPORT_SPEED_KMH[mode] || 32;

    // 1. 判定寄件人當前位置 (即時 GPS 優先，否則取包裹 pickupLocation)
    const senderCoord: GeoCoordinate = senderLiveUpdate
      ? { lat: senderLiveUpdate.lat, lng: senderLiveUpdate.lng }
      : { lat: shipment.pickupLocation.lat, lng: shipment.pickupLocation.lng };

    // 2. 判定收件人終點位置
    const recipientCoord: GeoCoordinate = {
      lat: shipment.dropoffLocation.lat,
      lng: shipment.dropoffLocation.lng,
    };

    // 3. 判定旅人當前位置 (即時 GPS 優先，否則取預設位置或起點)
    const travelerCoord: GeoCoordinate = travelerLiveUpdate
      ? { lat: travelerLiveUpdate.lat, lng: travelerLiveUpdate.lng }
      : travelerDefaultLocation || {
          lat: shipment.pickupLocation.lat - 0.015, // 模擬距起點約 1.8km 處
          lng: shipment.pickupLocation.lng - 0.012,
        };

    const status = shipment.status;
    let targetPhase: 'APPROACHING_PICKUP' | 'IN_TRANSIT_DROPOFF' | 'COMPLETED' = 'APPROACHING_PICKUP';
    let targetDestCoord: GeoCoordinate = senderCoord;
    let targetDestName = shipment.pickupLocation.name;
    let remainingDistanceKm = 0;
    let remainingMinutes = 0;
    let etaStatusText = '';

    if (status === 'DELIVERED') {
      targetPhase = 'COMPLETED';
      remainingDistanceKm = 0;
      remainingMinutes = 0;
      etaStatusText = `🏆 包裹已於現場完成雙照比對並簽收交付！Escrow 資金託管已解鎖撥付。`;
    } else if (
      status === 'IN_TRANSIT' ||
      status === 'INSPECTED_PICKED_UP' ||
      status === 'ARRIVED_DROPOFF' ||
      status === 'AWAITING_CONSISTENCY'
    ) {
      // 階段二：取件後運送中 ➔ 旅人前往收貨人終點
      targetPhase = 'IN_TRANSIT_DROPOFF';
      targetDestCoord = recipientCoord;
      targetDestName = shipment.dropoffLocation.name;

      const straightKm = this.calculateDistanceKm(travelerCoord, recipientCoord);
      remainingDistanceKm = this.getRouteDistanceKm(straightKm, mode);
      remainingMinutes = this.calculateRemainingMinutes(
        remainingDistanceKm,
        mode,
        travelerLiveUpdate?.speedKmh
      );

      const arrivalTime = this.formatArrivalTime(remainingMinutes);
      etaStatusText = `🚀 運送中 (旅人即時定位追蹤中)：距離收貨人 [${shipment.recipientName}] 約 ${remainingDistanceKm} km，依照 ${mode} 運具即時路況推算，預計剩餘 ${remainingMinutes} 分鐘後送達 (${arrivalTime} 抵達)。`;
    } else {
      // 階段一：媒合成功後 ➔ 旅人前往寄貨人起點取件
      targetPhase = 'APPROACHING_PICKUP';
      targetDestCoord = senderCoord;
      targetDestName = shipment.pickupLocation.name;

      const straightKm = this.calculateDistanceKm(travelerCoord, senderCoord);
      remainingDistanceKm = this.getRouteDistanceKm(straightKm, mode);
      remainingMinutes = this.calculateRemainingMinutes(
        remainingDistanceKm,
        mode,
        travelerLiveUpdate?.speedKmh
      );

      const arrivalTime = this.formatArrivalTime(remainingMinutes);
      etaStatusText = `🛵 媒合成功！旅人已接單並取得寄貨人 [${shipment.senderName}] 即時定位，距離約 ${remainingDistanceKm} km，預計剩餘 ${remainingMinutes} 分鐘後抵達取件點 (${arrivalTime} 抵達)。`;
    }

    const estimatedArrivalTime = this.formatArrivalTime(remainingMinutes);

    return {
      shipmentId: shipment.id,
      status,
      transportMode: mode,
      targetPhase,
      senderLiveLocation: {
        lat: senderCoord.lat,
        lng: senderCoord.lng,
        updatedAt: senderLiveUpdate?.timestamp || new Date().toISOString(),
        addressDescription: senderLiveUpdate?.addressDescription || shipment.pickupLocation.address,
      },
      travelerLiveLocation: {
        lat: travelerCoord.lat,
        lng: travelerCoord.lng,
        speedKmh: travelerLiveUpdate?.speedKmh || baseSpeed,
        updatedAt: travelerLiveUpdate?.timestamp || new Date().toISOString(),
        addressDescription: travelerLiveUpdate?.addressDescription || '旅人移動動態坐標',
      },
      recipientLocation: shipment.dropoffLocation,
      remainingDistanceKm,
      remainingMinutes,
      estimatedArrivalTime,
      averageSpeedKmh: baseSpeed,
      etaStatusText,
      lastCalculatedAt: new Date().toISOString(),
    };
  }
}
