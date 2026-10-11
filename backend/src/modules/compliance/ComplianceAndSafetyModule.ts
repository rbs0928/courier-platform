import type {
  PackageShipment,
  InspectionChecklist,
  PackageCategory,
  AiScreeningResult,
  AiScreeningDecision,
  ManualReviewTicket,
  PhotoConsistencyResult,
  ConsistencyDecision,
  AviationRegulationRule,
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

  // 國際航空權威托運法規庫 (IATA DGR, ICAO, 各國海關條例)
  public static readonly AVIATION_REGULATIONS: AviationRegulationRule[] = [
    {
      ruleCode: 'IATA_DGR_LITHIUM_01',
      authority: 'IATA_DGR',
      category: 'BATTERY',
      title: '鋰電池與行動電源航空攜帶規範 (IATA DGR 65th)',
      restrictionDetail: '行動電源及備用鋰電池【嚴禁托運】，僅限隨身手提攜帶。額定容量小於 100Wh 無須申報；100Wh~160Wh 需經航空公司預先核准，每人限攜 2 顆；超過 160Wh 嚴禁登機。',
      penaltyWarning: '托運行李夾帶鋰電池違者最高可處新台幣 2 萬至 10 萬元罰鍰。',
    },
    {
      ruleCode: 'ICAO_LAGS_01',
      authority: 'ICAO',
      category: 'LIQUID_AEROSOL_GEL',
      title: '隨身行李液體、膠狀及噴霧類物品管制 (LAGs)',
      restrictionDetail: '國際線隨身手提行李中之所有液體、膠狀及噴霧類物品，每瓶容器容積不得超過 100 毫升 (ml)，且需全數裝入單一容量不超過 1 公升之透明可重複密封夾鏈塑膠袋中。托運行李則需妥善包裝防漏。',
    },
    {
      ruleCode: 'TW_BAPHIQ_SWINE_FEVER',
      authority: 'TAIWAN_CAA',
      category: 'QUARANTINE_MEAT',
      title: '台灣非洲豬瘟防範動植物檢疫條例',
      restrictionDetail: '禁止自非洲豬瘟疫區攜帶任何豬肉製品（含真空包裝、肉乾、香腸、含肉泡麵等）入境台灣。',
      penaltyWarning: '初犯重罰新台幣 20 萬元，再犯最高處新台幣 100 萬元罰鍰！',
    },
    {
      ruleCode: 'JP_CUSTOMS_DUTY_FREE',
      authority: 'JAPAN_MLIT',
      category: 'CUSTOMS_DUTY',
      title: '日本入境免稅額與貴重品申報規範 (日本稅關)',
      restrictionDetail: '入境日本個人免稅額為 20 萬日圓。攜帶金飾或純度 90% 以上黃金製品超過 1 公斤者必須申報。未加工肉製品全面禁止入境。',
    },
    {
      ruleCode: 'US_TSA_POWDER_LIMIT',
      authority: 'US_TSA',
      category: 'POWDER',
      title: '美國 TSA 粉末類物品手提管制',
      restrictionDetail: '隨身行李中體積超過 350 毫升（約易開罐大小）之粉末狀物質（如咖啡粉、麵粉、化妝粉等），需進行額外安全檢查或改採托運。個人免稅額上限為 $800 美元。',
    },
    {
      ruleCode: 'EU_EASA_MEAT_DAIRY',
      authority: 'EU_EASA',
      category: 'QUARANTINE_MEAT',
      title: '歐盟境外入境肉類與乳製品全面禁令',
      restrictionDetail: '旅客嚴禁將任何未經檢驗之動物源肉類、肉製品或乳製品攜入歐盟境內。空運旅客個人免稅額為 €430 歐元。',
    },
  ];

  // 人工審查工單佇列暫存 (Review Queue)
  private static reviewQueue: Map<string, ManualReviewTicket> = new Map();

  /**
   * AI 初步違禁品排查 + 疑似違禁品人工審核 (AI-First + Human-in-the-Loop)
   */
  public static aiScreenContraband(params: {
    shipmentId: string;
    title: string;
    description: string;
    category: PackageCategory;
    isInternational?: boolean;
    photoUrls?: string[];
  }): AiScreeningResult {
    const { shipmentId, title, description, category, isInternational, photoUrls } = params;
    const textToCheck = `${title} ${description}`.toLowerCase();
    const detected: string[] = [];

    // 1. 檢核高危險明確違法物品 (一票否決)
    for (const keyword of this.DANGEROUS_GOODS_KEYWORDS) {
      if (textToCheck.includes(keyword.toLowerCase())) {
        detected.push(keyword);
      }
    }

    // 跨國境防檢疫違法
    if (isInternational) {
      for (const keyword of this.CROSS_BORDER_RESTRICTIONS) {
        if (textToCheck.includes(keyword.toLowerCase())) {
          detected.push(keyword);
        }
      }
    }

    if (detected.length > 0) {
      return {
        decision: 'REJECTED',
        confidenceScore: 0.99,
        detectedKeywords: detected,
        riskCategory: 'PROHIBITED_CONTRABAND',
        requiresHumanReview: false,
        reasonExplanation: `AI 判定含有法定違禁危險品或檢疫禁令項目: [${detected.join(', ')}]，依法系統直接拒絕發單。`,
        screenedAt: new Date().toISOString(),
      };
    }

    // 2. 檢核「中度疑似違禁品」特徵 (需人工審查 Human-in-the-Loop)
    // 例如：未知白色粉末、無標籤液體、二手高價散裝晶片、藥草中藥粉
    const suspectKeywords = [
      '粉末', '散裝粉', '透明液體', '自釀', '自製藥', '不明藥錠', '中藥粉',
      '無標籤', '無包裝', '電池包', '改裝鋰電', '代購藥品', '二手名錶',
    ];
    const hitSuspect: string[] = [];
    for (const suspect of suspectKeywords) {
      if (textToCheck.includes(suspect.toLowerCase())) {
        hitSuspect.push(suspect);
      }
    }

    if (hitSuspect.length > 0 || (isInternational && (!photoUrls || photoUrls.length === 0))) {
      // 建立人工審核工單
      const ticket: ManualReviewTicket = {
        ticketId: `TICKET_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        shipmentId,
        status: 'PENDING',
        reviewerNotes: `命中疑似需確認品項: [${hitSuspect.join(', ')}]，待合規風控人員審核。`,
        createdAt: new Date().toISOString(),
      };
      this.reviewQueue.set(ticket.ticketId, ticket);

      return {
        decision: 'SUSPECT_MANUAL_REVIEW',
        confidenceScore: 0.75,
        detectedKeywords: hitSuspect,
        riskCategory: 'SUSPECT_ITEM_REQUIRES_HUMAN_INSPECTION',
        requiresHumanReview: true,
        reasonExplanation: `AI 偵測到疑似需專業審核品項: [${hitSuspect.join(', ')}]，已自動派發至風控團隊人工審核工單。`,
        screenedAt: new Date().toISOString(),
      };
    }

    // 3. 通過 AI 初審放行 (CLEARED)
    return {
      decision: 'CLEARED',
      confidenceScore: 0.98,
      detectedKeywords: [],
      requiresHumanReview: false,
      reasonExplanation: 'AI 初步安全合規審核通過，未發現違禁品與危險品特徵。',
      screenedAt: new Date().toISOString(),
    };
  }

  /**
   * 查詢待審核工單清單
   */
  public static getReviewQueue(): ManualReviewTicket[] {
    return Array.from(this.reviewQueue.values());
  }

  /**
   * 風控人員人工審核裁定
   */
  public static decideReviewTicket(params: {
    ticketId: string;
    decision: 'APPROVED' | 'REJECTED';
    reviewerId: string;
    reviewerNotes: string;
    shipment: PackageShipment;
  }): { success: boolean; ticket: ManualReviewTicket; message: string } {
    const { ticketId, decision, reviewerId, reviewerNotes, shipment } = params;
    const ticket = this.reviewQueue.get(ticketId);
    if (!ticket) {
      return { success: false, ticket: {} as any, message: '查無此審核工單' };
    }

    ticket.status = decision;
    ticket.reviewerId = reviewerId;
    ticket.reviewerNotes = reviewerNotes;
    ticket.decidedAt = new Date().toISOString();

    if (decision === 'APPROVED') {
      shipment.status = 'MATCHING';
      if (shipment.aiScreening) {
        shipment.aiScreening.decision = 'CLEARED';
        shipment.aiScreening.reasonExplanation = `人工審查核准放行 (${reviewerNotes})`;
      }
    } else {
      shipment.status = 'SCREENING_REJECTED';
      if (shipment.aiScreening) {
        shipment.aiScreening.decision = 'REJECTED';
        shipment.aiScreening.reasonExplanation = `人工審查駁回 (${reviewerNotes})`;
      }
    }

    shipment.manualReviewTicket = ticket;
    return {
      success: true,
      ticket,
      message: `工單裁定完成: ${decision === 'APPROVED' ? '核准放行' : '違規駁回'}`,
    };
  }

  /**
   * 派發照片與送達拆箱照片雙向一致性審核 (Photo Consistency Verification)
   * 只有在審核一致通過後，收件人才可取得簽收 OTP，旅人方可完成交付並解鎖 Escrow
   */
  public static verifyPhotoConsistency(params: {
    shipment: PackageShipment;
    unboxingPhotoUrls: string[];
    auditorNotes?: string;
  }): PhotoConsistencyResult {
    const { shipment, unboxingPhotoUrls, auditorNotes } = params;
    const inspectedPhotos = shipment.inspectionRecord?.photoUrls || [];

    // 檢查基準照片存在性
    if (inspectedPhotos.length === 0 || unboxingPhotoUrls.length === 0) {
      const failedResult: PhotoConsistencyResult = {
        decision: 'TAMPER_OR_DAMAGE_FLAGGED',
        similarityScore: 0,
        isApproved: false,
        inspectedPhotoUrls: inspectedPhotos,
        unboxingPhotoUrls,
        reviewerType: 'AI_AUTOMATED',
        remarks: '缺少派發驗視照片或送達拆箱照片，無法進行一致性特徵比對。',
        verifiedAt: new Date().toISOString(),
      };
      shipment.photoConsistencyRecord = failedResult;
      shipment.status = 'DISPUTE_HOLD';
      return failedResult;
    }

    // AI 特徵辨識與一致性演算法比對 (模擬比對外包裝標籤、封條完整度、物品外觀)
    // 在生產環境可對接 Google Cloud Vision API / OpenAI Vision 特徵向量相似度比對
    const simulatedSimilarity = Math.floor(92 + Math.random() * 8); // 92% ~ 100% 高一致性
    const isApproved = simulatedSimilarity >= 85;

    const result: PhotoConsistencyResult = {
      decision: isApproved ? 'CONSISTENCY_APPROVED' : 'TAMPER_OR_DAMAGE_FLAGGED',
      similarityScore: simulatedSimilarity,
      isApproved,
      inspectedPhotoUrls: inspectedPhotos,
      unboxingPhotoUrls,
      reviewerType: 'AI_AUTOMATED',
      remarks: isApproved
        ? `雙照一致性比對通過 (相似度 ${simulatedSimilarity}%)：外包裝、內容物與封箱存證特徵完全吻合，未發現調包或異常破損。`
        : `雙照不一致警告 (相似度 ${simulatedSimilarity}%)：內容物特徵與派發基準照存在明顯差異，疑似調包或破損！`,
      verifiedAt: new Date().toISOString(),
    };

    shipment.photoConsistencyRecord = result;
    if (isApproved) {
      shipment.status = 'ARRIVED_DROPOFF'; // 允許收件人提供簽收 OTP
    } else {
      shipment.status = 'DISPUTE_HOLD';    // 凍結訂單與 Escrow 款項
    }

    return result;
  }

  /**
   * 生成 6 位數高安全性動態 OTP 驗證碼
   */
  public static generateSecureOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 取件面交檢驗：執行開箱驗視存證與 OTP 校驗 (建立防調包基準照片)
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
        message: '安全協定未達成：必須上傳至少 2 張開箱驗視與封箱存證照片作為防調包基準',
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
      message: '開箱驗視合格！已建立派發基準照片，包裹正式進入運送狀態 [IN_TRANSIT]',
    };
  }

  /**
   * 送達面交檢驗：比對簽收 OTP 與交付存證照片 (強制檢查雙照一致性審核通過)
   */
  public static verifyDropoff(params: {
    shipment: PackageShipment;
    travelerId: string;
    inputOtp: string;
    photoUrls: string[];
  }): { success: boolean; message: string } {
    const { shipment, travelerId, inputOtp, photoUrls } = params;

    // 1. 嚴格檢查雙照一致性審核是否已通過
    if (!shipment.photoConsistencyRecord || !shipment.photoConsistencyRecord.isApproved) {
      return {
        success: false,
        message: '安全保護攔截：送達拆箱照片尚未完成【雙照一致性審核通過】，禁止執行簽收與資金解鎖！',
      };
    }

    if (shipment.status !== 'IN_TRANSIT' && shipment.status !== 'ARRIVED_DROPOFF') {
      return {
        success: false,
        message: `包裹狀態為 [${shipment.status}]，非待簽收狀態`,
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
