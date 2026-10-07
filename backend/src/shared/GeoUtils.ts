import type { GeoCoordinate, StationHub } from '../types/index.ts';
import { MAJOR_HUBS } from '../database/StationHubs.ts';

export class GeoUtils {
  /**
   * 使用半正矢公式 (Haversine Formula) 計算兩經緯度點間的大圓距離 (公里)
   */
  public static calculateDistanceKm(
    point1: GeoCoordinate,
    point2: GeoCoordinate
  ): number {
    const R = 6371.0088; // 地球半徑 (km)
    const lat1Rad = this.toRadians(point1.lat);
    const lon1Rad = this.toRadians(point1.lng);
    const lat2Rad = this.toRadians(point2.lat);
    const lon2Rad = this.toRadians(point2.lng);

    const dLat = lat2Rad - lat1Rad;
    const dLon = lon2Rad - lon1Rad;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  /**
   * 搜尋距離特定座標最近的交通節點 (捷運站/高鐵站/機場)
   */
  public static findNearestHub(
    point: GeoCoordinate,
    filterType?: StationHub['type']
  ): { hub: StationHub; distanceKm: number } | null {
    let nearest: StationHub | null = null;
    let minDistance = Infinity;

    for (const hub of MAJOR_HUBS) {
      if (filterType && hub.type !== filterType) {
        continue;
      }
      const dist = this.calculateDistanceKm(point, hub);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = hub;
      }
    }

    if (!nearest) return null;
    return { hub: nearest, distanceKm: minDistance };
  }

  private static toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
