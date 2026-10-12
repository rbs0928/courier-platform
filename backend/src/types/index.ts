/**
 * 核心資料型別定義 - 全運具跨城／跨國順路捎帶媒合平台 v2.0
 */

// 10 大運具型別定義
export type TransportMode =
  | 'WALKING'           // 步行捷運站周邊面交 (<= 1.5km)
  | 'BICYCLE'           // 腳踏車/YouBike (市區短程綠色捎帶 <= 5km)
  | 'MOTORCYCLE'        // 機車/速克達 (同城直送、穿梭巷弄、通勤順路)
  | 'MRT'               // 市區捷運 (台北/新北/台中/高雄捷運、機捷)
  | 'BUS'               // 市區公車/客運
  | 'CAR'               // 私家小客車/休旅車 (國道長途自駕)
  | 'TRAIN'             // 台鐵火車
  | 'HSR'               // 台灣高鐵 (西部走廊 1~2 小時極速跨城)
  | 'DOMESTIC_FLIGHT'   // 國內航空 (台北/高雄/台中飛澎湖馬公、金門、台東、花蓮、馬祖)
  | 'FLIGHT';           // 國際航班 (東北亞、東南亞、歐美跨國行李箱捎帶)

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
  hubCode?: string;       // 若位於車站/機場節點 (如 THSR_TPE, DOM_TSA, MRT_BL12)
  googlePlaceId?: string; // 整合 Google Places API 地點識別碼
  formattedAddress?: string;
}

export interface StationHub extends LocationPoint {
  code: string;
  type:
    | 'MRT_STATION'
    | 'HSR_STATION'
    | 'TRAIN_STATION'
    | 'AIRPORT'
    | 'DOMESTIC_AIRPORT'
    | 'BIKE_HUB'
    | 'BUS_STATION'
    | 'HIGHWAY_HUB';
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
  tripNumber?: string; // 如 高鐵 115 次、立榮航空 B7-8825、長榮航空 BR198
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
  | 'SCREENING_SUSPECT'    // AI 初審標記為疑似違禁品，等待人工審核
  | 'SCREENING_REJECTED'   // 違禁品審查遭駁回
  | 'MATCHING'
  | 'ACCEPTED'
  | 'INSPECTED_PICKED_UP'  // 寄件派發驗視完成，已建立防調包基準照片
  | 'IN_TRANSIT'
  | 'ARRIVED_DROPOFF'      // 抵達現場，等待拆箱雙照比對
  | 'AWAITING_CONSISTENCY' // 現場拆箱照片上傳，進行雙照一致性審核
  | 'DELIVERED'
  | 'DISPUTE_HOLD'         // 雙照不符或調包爭議凍結
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

// -------------------------------------------------------------
// AI 違禁品審查與人工工單 (AI-First + Human-in-the-Loop) 型別
// -------------------------------------------------------------
export type AiScreeningDecision = 'CLEARED' | 'SUSPECT_MANUAL_REVIEW' | 'REJECTED';

export interface AiScreeningResult {
  decision: AiScreeningDecision;
  confidenceScore: number;          // 0.0 ~ 1.0 AI 信心指數
  detectedKeywords: string[];       // 命中危險品關鍵字
  riskCategory?: string;            // 如 'LITHIUM_BATTERY_AIR', 'ANIMAL_MEAT_BORDER', 'POWDER_SUSPECT'
  requiresHumanReview: boolean;     // 是否排入人工審核佇列
  reasonExplanation: string;        // 繁體中文說明
  screenedAt: string;
}

export interface ManualReviewTicket {
  ticketId: string;
  shipmentId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewerId?: string;
  reviewerNotes?: string;
  createdAt: string;
  decidedAt?: string;
}

// -------------------------------------------------------------
// 雙向照片一致性審核 (Photo Consistency Verification) 型別
// -------------------------------------------------------------
export type ConsistencyDecision =
  | 'CONSISTENCY_PENDING'
  | 'CONSISTENCY_APPROVED'
  | 'TAMPER_OR_DAMAGE_FLAGGED';

export interface PhotoConsistencyResult {
  decision: ConsistencyDecision;
  similarityScore: number;         // 0 ~ 100 視覺特徵比對相符度
  isApproved: boolean;             // 是否允許進行後續簽收與撥款
  inspectedPhotoUrls: string[];    // 派發取件基準照片
  unboxingPhotoUrls: string[];     // 送達現場拆箱照片
  reviewerType: 'AI_AUTOMATED' | 'HUMAN_AUDITOR';
  remarks: string;
  verifiedAt: string;
}

// -------------------------------------------------------------
// 國際航空與各國海關法規規約
// -------------------------------------------------------------
export interface AviationRegulationRule {
  ruleCode: string;
  authority: 'ICAO' | 'IATA_DGR' | 'TAIWAN_CAA' | 'JAPAN_MLIT' | 'US_TSA' | 'EU_EASA';
  category: 'BATTERY' | 'LIQUID_AEROSOL_GEL' | 'POWDER' | 'QUARANTINE_MEAT' | 'CUSTOMS_DUTY';
  title: string;
  restrictionDetail: string;
  penaltyWarning?: string;
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
  dropoffOtp: string;      // 簽收動態碼 (收件人給旅客，需在雙照審核通過後方可產生與生效)
  
  // AI 初審與人工審查記錄
  aiScreening?: AiScreeningResult;
  manualReviewTicket?: ManualReviewTicket;

  // 開箱派發驗視存證 (Baseline)
  inspectionRecord?: {
    inspectedAt: string;
    travelerId: string;
    checklist: InspectionChecklist;
    photoUrls: string[];
  };

  // 送達現場拆箱與雙照一致性審核記錄 (Consistency)
  photoConsistencyRecord?: PhotoConsistencyResult;

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

// -------------------------------------------------------------
// 用戶帳號、實名驗證 (KYC) 與 手機動態 OTP 驗證型別
// -------------------------------------------------------------
export type UserRole = 'SENDER' | 'TRAVELER' | 'RECIPIENT' | 'ALL';

export interface UserAccount {
  id: string;
  phone: string;
  name: string;
  roles: UserRole[];
  isPhoneVerified: boolean;
  kycLevel: 'UNVERIFIED' | 'PHONE_VERIFIED' | 'ID_VERIFIED';
  rating: number;
  walletBalanceTwd: number;
  createdAt: string;
  lastLoginAt: string;
}

export interface AuthSession {
  token: string;
  user: UserAccount;
  expiresAt: string;
}

export interface SendOtpRequest {
  phone: string;
  purpose: 'REGISTER' | 'LOGIN';
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
  name?: string;
  preferredRole?: UserRole;
}

