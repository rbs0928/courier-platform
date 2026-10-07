import type {
  PackageShipment,
  InspectionChecklist,
  PackageCategory,
} from '../../types/index.ts';

export interface ContrabandCheckResult {
  isAllowed: boolean;
  violations: string[];
}

export class ComplianceAndSafetyModule {
  // 通用大眾運輸與航空危險品清單關鍵字
  private static readonly DANGEROUS_GOODS_KEYWORDS = [
    '爆竹', '煙火', '瓦斯罐', '高壓氣體', '強酸', '強鹼', '腐蝕',
    '易燃液體', '汽油', '酒精燈', '槍械', '彈藥', '刀械', '開山刀',
    '毒品', '大麻', '安非他命', '海洛因', '笑氣',
  ];

  // 跨國境航空檢疫禁運關鍵字 (動植物檢疫與海關限制)
  private static readonly CROSS_BORDER_RESTRICTIONS = [
    '生肉', '肉乾', '香腸', '肉鬆', '火腿', '新鮮水果', '生鮮蔬菜',
    '活體動物', '未經檢疫種子', '超過免稅額香煙', '雪茄', '未申報大量現金',
  ];

  /**
   * 物品合規性與違禁品過濾檢核
   */
  public static checkContraband(
    title: string,
    description: string,
    category: PackageCategory,
    isInternational = false
  ): ContrabandCheckResult {
    const textToCheck = `${title} ${description}`.toLowerCase();
    const violations: string[] = [];

    // 檢查通用危險品
    for (const keyword of this.DANGEROUS_GOODS_KEYWORDS) {
      if (textToCheck.includes(keyword.toLowerCase())) {
        violations.push(`含有交通運輸危險管制物品: "${keyword}"`);
      }
    }

    // 若為跨國境捎帶，加入航空檢疫與海關申報檢核
    if (isInternational) {
      for (const keyword of this.CROSS_BORDER_RESTRICTIONS) {
        if (textToCheck.includes(keyword.toLowerCase())) {
          violations.push(`觸犯跨國境出入境海關/動植物防檢疫禁令: "${keyword}"`);
        }
      }
    }

    return {
      isAllowed: violations.length === 0,
      violations,
    };
  }

  /**
   * 生成 6 位數高安全性動態 OTP 驗證碼
   */
  public static generateSecureOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 取件面交檢驗：執行開箱驗視存證與 OTP 校驗
   */
  public static verifyPickupAndInspection(params: {
    shipment: PackageShipment;
    travelerId: string;
    inputOtp: string;
    checklist: InspectionChecklist;
    photoUrls: string[];
  }): { success: boolean; message: string } {
    const { shipment, travelerId, inputOtp, checklist, photoUrls } = params;

    // 1. 狀態檢核
    if (shipment.status !== 'ACCEPTED') {
      return {
        success: false,
        message: `包裹目前狀態為 [${shipment.status}]，非待取件狀態`,
      };
    }

    // 2. 實名旅人身分檢核
    if (shipment.assignedTravelerId !== travelerId) {
      return {
        success: false,
        message: '操作者非此訂單指派之合法順路旅人',
      };
    }

    // 3. 取件 OTP 比對
    if (shipment.pickupOtp !== inputOtp.trim()) {
      return {
        success: false,
        message: '取件動態驗證碼 (OTP) 不符，請向寄件人確認',
      };
    }

    // 4. 開箱驗視照片存證檢核 (至少需 2 張照片：開箱內容物 + 封箱外觀)
    if (!photoUrls || photoUrls.length < 2) {
      return {
        success: false,
        message: '安全協定未達成：必須上傳至少 2 張開箱驗視與封箱存證照片',
      };
    }

    // 5. 檢核清單完整性
    if (
      !checklist.noContrabandConfirmed ||
      !checklist.physicalAppearanceChecked ||
      !checklist.packageOpenedAndInspected ||
      !checklist.sealedInPresenceOfSender
    ) {
      return {
        success: false,
        message: '旅人安全承諾未完整勾選（確認無違禁品、當面開箱、當面封箱）',
      };
    }

    // 通過驗證，寫入開箱紀錄
    shipment.inspectionRecord = {
      inspectedAt: new Date().toISOString(),
      travelerId,
      checklist,
      photoUrls,
    };
    shipment.status = 'IN_TRANSIT';

    return {
      success: true,
      message: '開箱驗視合格！已完成安全交接，包裹正式進入運送狀態 [IN_TRANSIT]',
    };
  }

  /**
   * 送達面交檢驗：比對簽收 OTP 與交付存證照片
   */
  public static verifyDropoff(params: {
    shipment: PackageShipment;
    travelerId: string;
    inputOtp: string;
    photoUrls: string[];
  }): { success: boolean; message: string } {
    const { shipment, travelerId, inputOtp, photoUrls } = params;

    if (shipment.status !== 'IN_TRANSIT' && shipment.status !== 'ARRIVED_DROPOFF') {
      return {
        success: false,
        message: `包裹狀態為 [${shipment.status}]，非運送中或抵達待簽收狀態`,
      };
    }

    if (shipment.assignedTravelerId !== travelerId) {
      return {
        success: false,
        message: '操作者非此訂單指派之合法順路旅人',
      };
    }

    // 比對收件人簽收 OTP
    if (shipment.dropoffOtp !== inputOtp.trim()) {
      return {
        success: false,
        message: '簽收動態驗證碼 (OTP) 錯誤，請向現場收件人索取簽收碼',
      };
    }

    if (!photoUrls || photoUrls.length < 1) {
      return {
        success: false,
        message: '必須提供現場簽收存證照片 (POD)',
      };
    }

    shipment.deliveryRecord = {
      deliveredAt: new Date().toISOString(),
      photoUrls,
    };
    shipment.status = 'DELIVERED';

    return {
      success: true,
      message: '簽收成功！包裹已安全交付收件人 [DELIVERED]，即時觸發資金託管結算',
    };
  }
}
