/**
 * 核心資料型別定義 - 全運具跨城／跨國順路捎帶媒合平台
 */

export type TransportMode =
  | 'WALKING'
  | 'MOTORCYCLE'        // 機車/速克達 (同城到府直送、穿梭巷弄、通勤順路)
  | 'MRT'
  | 'BUS'
  | 'TRAIN'
  | 'HSR'
  | 'FLIGHT'
  | 'CAR';

export type LuggageType =
  | 'POCKET_HANDHELD'   // 手提小袋/隨身物品 (<= 1kg)
  | 'BACKPACK'          // 雙肩背包 (<= 5kg)
  | 'SCOOTER_CARRIER'   // 機車前踏板/後行李箱/保溫箱 (<= 15kg)
  | 'CARRY_ON_20INCH'   // 登機箱/小手提箱 (<= 10kg)
  | 'CHECKED_28INCH'    // 大行李箱/托運空間 (<= 25kg)
  | 'CAR_TRUNK';        // 後車廂空間 (<= 50kg)

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface LocationPoint extends GeoCoordinate {
  name: string;
  address: string;
  hubCode?: string; // 若位於車站/機場節點 (如 THSR_TPE, TPE_T2, MRT_BL12)
}

export interface StationHub extends LocationPoint {
  code: string;
  type: 'MRT_STATION' | 'HSR_STATION' | 'TRAIN_STATION' | 'AIRPORT' | 'BUS_STATION' | 'HIGHWAY_HUB';
  city: string;
  country: string;
}

export type ItineraryStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface ItineraryCapacity {
  maxWeightKg: number;
  remainingWeightKg: number;
  maxVolumeCm3: number;
  remainingVolumeCm3: number;
  luggageType: LuggageType;
}

export interface Itinerary {
  id: string;
  travelerId: string;
  travelerName: string;
  travelerPhone: string;
  travelerRating: number;
  isKycVerified: boolean;
  transportMode: TransportMode;
  tripNumber?: string; // 如 高鐵 115 次、長榮航空 BR198、捷運板南線
  origin: LocationPoint;
  destination: LocationPoint;
  departureTime: string; // ISO 8601
  arrivalTime: string;   // ISO 8601
  capacity: ItineraryCapacity;
  maxDetourKm: number;   // 旅客願意為面交繞路的最大半徑 (km)
  status: ItineraryStatus;
  createdAt: string;
}

export type PackageCategory =
  | 'DOCUMENT'
  | 'ELECTRONICS'
  | 'CLOTHING'
  | 'FOOD_PACKAGED'
  | 'LUXURY_GIFT'
  | 'OTHER';

export type ShipmentStatus =
  | 'DRAFT'
  | 'MATCHING'
  | 'ACCEPTED'
  | 'INSPECTED_PICKED_UP'
  | 'IN_TRANSIT'
  | 'ARRIVED_DROPOFF'
  | 'DELIVERED'
  | 'CANCELLED';

export interface PackageDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface PricingQuote {
  transportMode: TransportMode;
  baseFare: number;
  weightFee: number;
  distanceFee: number;
  insuranceFee: number;
  customsFee: number;
  platformCommission: number;
  travelerEarnings: number;
  totalAmount: number;
  currency: 'TWD' | 'USD';
}

export interface InspectionChecklist {
  noContrabandConfirmed: boolean;    // 無違禁品確認
  physicalAppearanceChecked: boolean; // 外觀無破損與異味
  packageOpenedAndInspected: boolean; // 實體驗貨確認符合申報
  sealedInPresenceOfSender: boolean;  // 寄件人當面封箱
  notes?: string;
}

export interface PackageShipment {
  id: string;
  senderId: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  title: string;
  description: string;
  category: PackageCategory;
  weightKg: number;
  dimensions: PackageDimensions;
  declaredValue: number; // 申報貨品價值 (用於保險與遺失賠償)
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  earliestPickupTime: string;
  deliveryDeadline: string;
  transportModePreference?: TransportMode;
  status: ShipmentStatus;
  
  // 安全與驗證欄位
  pickupOtp: string;       // 取件動態碼 (寄件人給旅客)
  dropoffOtp: string;      // 簽收動態碼 (收件人給旅客)
  inspectionRecord?: {
    inspectedAt: string;
    travelerId: string;
    checklist: InspectionChecklist;
    photoUrls: string[];
  };
  deliveryRecord?: {
    deliveredAt: string;
    photoUrls: string[];
  };

  assignedTravelerId?: string;
  assignedItineraryId?: string;
  pricingQuote: PricingQuote;
  createdAt: string;
}

export interface MatchResult {
  itinerary: Itinerary;
  shipment: PackageShipment;
  score: number; // 0 ~ 100 媒合推薦分數
  pickupDetourKm: number;
  dropoffDetourKm: number;
  totalDetourKm: number;
  timeFitMarginMinutes: number; // 距離截止時間的餘裕時間 (分鐘)
  pricingQuote: PricingQuote;
  matchReasons: string[];
}
