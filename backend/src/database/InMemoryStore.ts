import type {
  Itinerary,
  PackageShipment,
} from '../types/index.ts';
import { MAJOR_HUBS } from './StationHubs.ts';
import { ComplianceAndSafetyModule } from '../modules/compliance/ComplianceAndSafetyModule.ts';
import { PricingEngine } from '../modules/pricing/PricingEngine.ts';
import { GeoUtils } from '../shared/GeoUtils.ts';

export class InMemoryStore {
  private itineraries: Map<string, Itinerary> = new Map();
  private shipments: Map<string, PackageShipment> = new Map();

  constructor() {
    this.seedInitialData();
  }

  public saveItinerary(itinerary: Itinerary): void {
    this.itineraries.set(itinerary.id, itinerary);
  }

  public getItinerary(id: string): Itinerary | undefined {
    return this.itineraries.get(id);
  }

  public getAllItineraries(): Itinerary[] {
    return Array.from(this.itineraries.values());
  }

  public saveShipment(shipment: PackageShipment): void {
    this.shipments.set(shipment.id, shipment);
  }

  public getShipment(id: string): PackageShipment | undefined {
    return this.shipments.get(id);
  }

  public getAllShipments(): PackageShipment[] {
    return Array.from(this.shipments.values());
  }

  /**
   * 預填經典情境示範資料 (台北捷運通勤族、高鐵北高差旅商務客、飛日本羽田國際旅客)
   */
  private seedInitialData(): void {
    const now = new Date();

    // 1. 台北捷運通勤族 (日常順路送文件/忘記帶鑰匙)
    const mrtDep = new Date(now.getTime() + 60 * 60 * 1000); // 1 小時後出發
    const mrtArr = new Date(mrtDep.getTime() + 35 * 60 * 1000); // 35 分鐘後抵達

    const mrtItinerary: Itinerary = {
      id: 'ITIN_MRT_01',
      travelerId: 'USR_TRAVELER_ALICE',
      travelerName: 'Alice (捷運通勤族)',
      travelerPhone: '0912-345-678',
      travelerRating: 4.9,
      isKycVerified: true,
      transportMode: 'MRT',
      tripNumber: '台北捷運板南線',
      origin: {
        name: '台北車站 (捷運站)',
        address: '台北市中正區忠孝西路一段49號',
        lat: 25.046255,
        lng: 121.517532,
        hubCode: 'MRT_TPE_MAIN',
      },
      destination: {
        name: '南港展覽館站 (捷運站)',
        address: '台北市南港區南港路一段32號',
        lat: 25.055278,
        lng: 121.617222,
        hubCode: 'MRT_NANGANG',
      },
      departureTime: mrtDep.toISOString(),
      arrivalTime: mrtArr.toISOString(),
      capacity: {
        maxWeightKg: 4,
        remainingWeightKg: 4,
        maxVolumeCm3: 15000,
        remainingVolumeCm3: 15000,
        luggageType: 'BACKPACK',
      },
      maxDetourKm: 1.5,
      status: 'PLANNED',
      createdAt: now.toISOString(),
    };
    this.saveItinerary(mrtItinerary);

    // 2. 台灣高鐵商務旅客 (出差順路帶高價值硬碟/急件合約)
    const hsrDep = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 小時後出發
    const hsrArr = new Date(hsrDep.getTime() + 95 * 60 * 1000); // 1.5 小時後抵達高雄左營

    const hsrItinerary: Itinerary = {
      id: 'ITIN_HSR_02',
      travelerId: 'USR_TRAVELER_BOB',
      travelerName: 'Bob (工程師南下出差)',
      travelerPhone: '0922-888-999',
      travelerRating: 5.0,
      isKycVerified: true,
      transportMode: 'HSR',
      tripNumber: '高鐵 115 次 直達車',
      origin: {
        name: '高鐵台北站',
        address: '台北市中正區北平西路3號',
        lat: 25.047924,
        lng: 121.517081,
        hubCode: 'THSR_TPE',
      },
      destination: {
        name: '高鐵左營站',
        address: '高雄市左營區高鐵路105號',
        lat: 22.687445,
        lng: 120.307556,
        hubCode: 'THSR_ZUY',
      },
      departureTime: hsrDep.toISOString(),
      arrivalTime: hsrArr.toISOString(),
      capacity: {
        maxWeightKg: 8,
        remainingWeightKg: 8,
        maxVolumeCm3: 35000,
        remainingVolumeCm3: 35000,
        luggageType: 'CARRY_ON_20INCH',
      },
      maxDetourKm: 2.5,
      status: 'PLANNED',
      createdAt: now.toISOString(),
    };
    this.saveItinerary(hsrItinerary);

    // 3. 跨國航班旅客 (台北松山飛日本東京羽田，提供行李箱閒置空間)
    const flightDep = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 明天出發
    const flightArr = new Date(flightDep.getTime() + 3.5 * 60 * 60 * 1000);

    const flightItinerary: Itinerary = {
      id: 'ITIN_FLIGHT_03',
      travelerId: 'USR_TRAVELER_CAROL',
      travelerName: 'Carol (赴日留學/旅遊)',
      travelerPhone: '+886-933-111-222',
      travelerRating: 4.95,
      isKycVerified: true,
      transportMode: 'FLIGHT',
      tripNumber: '長榮航空 BR192 (TSA -> HND)',
      origin: {
        name: '台北松山機場 (TSA)',
        address: '台北市松山區敦化北路340-9號',
        lat: 25.069722,
        lng: 121.552500,
        hubCode: 'AIR_TSA',
      },
      destination: {
        name: '東京羽田機場 (HND)',
        address: 'Hanedakuko, Ota City, Tokyo 144-0041, Japan',
        lat: 35.549393,
        lng: 139.779839,
        hubCode: 'AIR_HND',
      },
      departureTime: flightDep.toISOString(),
      arrivalTime: flightArr.toISOString(),
      capacity: {
        maxWeightKg: 15,
        remainingWeightKg: 15,
        maxVolumeCm3: 65000,
        remainingVolumeCm3: 65000,
        luggageType: 'CHECKED_28INCH',
      },
      maxDetourKm: 5.0,
      status: 'PLANNED',
      createdAt: now.toISOString(),
    };
    this.saveItinerary(flightItinerary);

    // 4. 境內私家車/自駕車旅客 (台北內湖開車南下新竹科學園區，休旅車後車廂大空間)
    const carDep = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 小時後出發
    const carArr = new Date(carDep.getTime() + 70 * 60 * 1000); // 70 分鐘後抵達新竹

    const carItinerary: Itinerary = {
      id: 'ITIN_CAR_04',
      travelerId: 'USR_TRAVELER_DAVID',
      travelerName: 'David (工程師南下新竹，休旅車 SUV 後車廂)',
      travelerPhone: '0955-666-777',
      travelerRating: 4.88,
      isKycVerified: true,
      transportMode: 'CAR',
      tripNumber: '國道一號南下 (台北內湖 -> 新竹科學園區)',
      origin: {
        name: '內湖科學園區 (靠近成功路交流道)',
        address: '台北市內湖區瑞光路500號',
        lat: 25.0805,
        lng: 121.5678,
      },
      destination: {
        name: '國道一號新竹科學園區交流道 (公道五路交會口)',
        address: '新竹市東區公道五路二段與園區二路口',
        lat: 24.7958,
        lng: 121.0028,
        hubCode: 'HWY_HSINCHU_IC',
      },
      departureTime: carDep.toISOString(),
      arrivalTime: carArr.toISOString(),
      capacity: {
        maxWeightKg: 40,
        remainingWeightKg: 40,
        maxVolumeCm3: 150000,
        remainingVolumeCm3: 150000,
        luggageType: 'CAR_TRUNK',
      },
      maxDetourKm: 4.5,
      status: 'PLANNED',
      createdAt: now.toISOString(),
    };
    this.saveItinerary(carItinerary);

    // 示範待媒合包裹 2：自駕車後車廂大件物品（露營充氣帳篷與折疊桌椅組）
    const pkgCarDeadline = new Date(carArr.getTime() + 3 * 60 * 60 * 1000);
    const carQuote = PricingEngine.calculateQuote({
      transportMode: 'CAR',
      distanceKm: 75,
      weightKg: 18.0,
      declaredValueTwd: 12000,
    });

    const shipmentCar: PackageShipment = {
      id: 'PKG_CAR_02',
      senderId: 'USR_SENDER_CAMPING',
      senderName: '戶外露營用品行',
      senderPhone: '02-8765-4321',
      recipientName: '新竹露營愛好者李先生',
      recipientPhone: '0977-888-999',
      title: '大型充氣帳篷與折疊戶外裝備組',
      description: '原廠收納提袋包裝，附購買證明與配件清單',
      category: 'OTHER',
      weightKg: 18.0,
      dimensions: { lengthCm: 85, widthCm: 45, heightCm: 35 },
      declaredValue: 12000,
      pickupLocation: {
        name: '台北市內湖區行愛路門市',
        address: '台北市內湖區行愛路140號',
        lat: 25.0645,
        lng: 121.5792,
      },
      dropoffLocation: {
        name: '新竹市東區公道五路交流道旁交接點',
        address: '新竹市東區公道五路二段100號',
        lat: 24.8012,
        lng: 121.0045,
        hubCode: 'HWY_HSINCHU_IC',
      },
      earliestPickupTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      deliveryDeadline: pkgCarDeadline.toISOString(),
      transportModePreference: 'CAR',
      status: 'MATCHING',
      pickupOtp: ComplianceAndSafetyModule.generateSecureOtp(),
      dropoffOtp: ComplianceAndSafetyModule.generateSecureOtp(),
      pricingQuote: carQuote,
      createdAt: now.toISOString(),
    };
    this.saveShipment(shipmentCar);

    // 示範待媒合包裹 1：高鐵急件（台北送到高雄巨蛋的關鍵伺服器備品晶片）
    const pkgHsrDeadline = new Date(hsrArr.getTime() + 2 * 60 * 60 * 1000); // 抵達後2小時前送到即可
    const hsrQuote = PricingEngine.calculateQuote({
      transportMode: 'HSR',
      distanceKm: 300,
      weightKg: 1.2,
      declaredValueTwd: 15000,
    });

    const shipmentHsr: PackageShipment = {
      id: 'PKG_HSR_01',
      senderId: 'USR_SENDER_TECH_CORP',
      senderName: '科技公司研發部',
      senderPhone: '02-2345-6789',
      recipientName: '高雄廠區王廠長',
      recipientPhone: '0988-123-456',
      title: '工控高精密通訊備品晶片',
      description: '防靜電袋密封，附出廠序號與原廠發票',
      category: 'ELECTRONICS',
      weightKg: 1.2,
      dimensions: { lengthCm: 20, widthCm: 15, heightCm: 8 },
      declaredValue: 15000,
      pickupLocation: {
        name: '台北車站 M8 出口旁便利商店',
        address: '台北市中正區忠孝西路一段49號',
        lat: 25.0465,
        lng: 121.5178,
        hubCode: 'THSR_TPE',
      },
      dropoffLocation: {
        name: '高鐵左營站 4 號出入口',
        address: '高雄市左營區高鐵路105號',
        lat: 22.6875,
        lng: 120.3076,
        hubCode: 'THSR_ZUY',
      },
      earliestPickupTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      deliveryDeadline: pkgHsrDeadline.toISOString(),
      transportModePreference: 'HSR',
      status: 'MATCHING',
      pickupOtp: ComplianceAndSafetyModule.generateSecureOtp(),
      dropoffOtp: ComplianceAndSafetyModule.generateSecureOtp(),
      pricingQuote: hsrQuote,
      createdAt: now.toISOString(),
    };
    this.saveShipment(shipmentHsr);

    // 5. 機車外送／通勤順路騎士 (新莊騎車經重新橋前往台北信義區，機車保溫箱/踏板有空間)
    const motoDep = new Date(now.getTime() + 45 * 60 * 1000); // 45 分鐘後出發
    const motoArr = new Date(motoDep.getTime() + 35 * 60 * 1000); // 35 分鐘後抵達

    const motoItinerary: Itinerary = {
      id: 'ITIN_MOTO_05',
      travelerId: 'USR_TRAVELER_ERIC',
      travelerName: 'Eric (速克達機車騎士，同城靈活穿梭)',
      travelerPhone: '0966-123-456',
      travelerRating: 4.95,
      isKycVerified: true,
      transportMode: 'MOTORCYCLE',
      tripNumber: '雙北同城順路 (三重菜寮 -> 台北大安區)',
      origin: {
        name: '三重菜寮捷運站周邊',
        address: '新北市三重區重新路三段150號',
        lat: 25.0605,
        lng: 121.4925,
      },
      destination: {
        name: '台北忠孝敦化商圈 (辦公大樓門口)',
        address: '台北市大安區忠孝東路四段180號',
        lat: 25.0415,
        lng: 121.5512,
      },
      departureTime: motoDep.toISOString(),
      arrivalTime: motoArr.toISOString(),
      capacity: {
        maxWeightKg: 10,
        remainingWeightKg: 10,
        maxVolumeCm3: 40000,
        remainingVolumeCm3: 40000,
        luggageType: 'SCOOTER_CARRIER',
      },
      maxDetourKm: 2.0,
      status: 'PLANNED',
      createdAt: now.toISOString(),
    };
    this.saveItinerary(motoItinerary);

    // 示範待媒合包裹 3：機車同城急件（精緻生乳捲甜點禮盒，需 1 小時內到府直送）
    const pkgMotoDeadline = new Date(motoArr.getTime() + 45 * 60 * 1000);
    const motoQuote = PricingEngine.calculateQuote({
      transportMode: 'MOTORCYCLE',
      distanceKm: 7.2,
      weightKg: 2.5,
      declaredValueTwd: 1200,
    });

    const shipmentMoto: PackageShipment = {
      id: 'PKG_MOTO_03',
      senderId: 'USR_SENDER_BAKERY',
      senderName: '法式甜點烘焙坊',
      senderPhone: '02-2987-6543',
      recipientName: '大安區商辦陳特助',
      recipientPhone: '0933-777-888',
      title: '現作手工生乳捲與冰滴咖啡禮盒',
      description: '保溫袋平放，需防傾倒，專人專送',
      category: 'FOOD_PACKAGED',
      weightKg: 2.5,
      dimensions: { lengthCm: 32, widthCm: 22, heightCm: 18 },
      declaredValue: 1200,
      pickupLocation: {
        name: '法式甜點三重門市',
        address: '新北市三重區重新路三段168號',
        lat: 25.0608,
        lng: 121.4928,
      },
      dropoffLocation: {
        name: '台北敦化南路金融大樓 1 樓大廳',
        address: '台北市大安區忠孝東路四段170號',
        lat: 25.0416,
        lng: 121.5508,
      },
      earliestPickupTime: new Date(now.getTime() + 20 * 60 * 1000).toISOString(),
      deliveryDeadline: pkgMotoDeadline.toISOString(),
      transportModePreference: 'MOTORCYCLE',
      status: 'MATCHING',
      pickupOtp: ComplianceAndSafetyModule.generateSecureOtp(),
      dropoffOtp: ComplianceAndSafetyModule.generateSecureOtp(),
      pricingQuote: motoQuote,
      createdAt: now.toISOString(),
    };
    this.saveShipment(shipmentMoto);
  }
}
