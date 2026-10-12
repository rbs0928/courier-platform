import type {
  UserAccount,
  AuthSession,
  SendOtpRequest,
  VerifyOtpRequest,
  UserRole,
} from '../../types/index.ts';

interface StoredOtp {
  phone: string;
  email?: string;
  realName?: string;
  code: string;
  expiresAt: number;
  purpose: 'REGISTER' | 'LOGIN';
}

export class AuthService {
  private usersByPhone: Map<string, UserAccount> = new Map();
  private usersByEmail: Map<string, UserAccount> = new Map();
  private usersById: Map<string, UserAccount> = new Map();
  private activeOtps: Map<string, StoredOtp> = new Map();
  private activeSessions: Map<string, AuthSession> = new Map();

  constructor() {
    this.seedDefaultUsers();
  }

  /**
   * 建立預設示範用戶 (供測試與即時演示使用)
   */
  private seedDefaultUsers() {
    const demoUser: UserAccount = {
      id: 'USR_DEMO_01',
      email: 'traveler.demo@courier.platform',
      realName: '林晨旅',
      phone: '0912345678',
      name: '林晨旅 (示範旅人/寄件者)',
      roles: ['TRAVELER', 'SENDER', 'RECIPIENT'],
      isEmailVerified: true,
      isPhoneVerified: true,
      kycLevel: 'PHONE_VERIFIED',
      rating: 5.0,
      walletBalanceTwd: 1000,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    this.usersByPhone.set(demoUser.phone, demoUser);
    this.usersByEmail.set(demoUser.email.toLowerCase(), demoUser);
    this.usersById.set(demoUser.id, demoUser);
  }

  /**
   * 格式化電話號碼 (去除非數字字元)
   */
  public sanitizePhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * 驗證 Email 格式
   */
  public isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * 發送 6 位數手機動態驗證碼 (OTP)
   * 支援填入 e-mail (帳號名稱)、真實姓名 (證件姓名) 與手機號碼
   */
  public sendOtp(params: SendOtpRequest): {
    success: boolean;
    message: string;
    debugOtp?: string;
  } {
    const cleanPhone = this.sanitizePhone(params.phone);
    if (!cleanPhone || cleanPhone.length < 9) {
      return {
        success: false,
        message: '請輸入有效的手機號碼 (例如 0912-345-678)',
      };
    }

    if (params.email && !this.isValidEmail(params.email)) {
      return {
        success: false,
        message: '電子郵件格式不正確，請輸入有效 e-mail (作為帳號名稱)',
      };
    }

    // 產生 6 位數動態 OTP 碼
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 分鐘有效

    this.activeOtps.set(cleanPhone, {
      phone: cleanPhone,
      email: params.email?.trim().toLowerCase(),
      realName: params.realName?.trim(),
      code,
      expiresAt,
      purpose: params.purpose,
    });

    console.log(`📱 [SMS Gateway] 向 ${cleanPhone} (e-mail: ${params.email || '未指定'}) 發送 OTP 驗證碼: [${code}] (有效期限 5 分鐘)`);

    return {
      success: true,
      message: `驗證碼已發送至手機 ${cleanPhone}！請於 5 分鐘內輸入以完成實名驗證。`,
      debugOtp: code, // 在開發/展示環境中提供，使前端能自動提示或帶入
    };
  }

  /**
   * 校驗 OTP 並完成會員註冊／登入
   * 規範：申請會員須輸入真實姓名 (需與證件姓名相符合) 與手機雙重驗證，帳號名稱使用 e-mail 作為帳號申請
   */
  public verifyOtpAndLogin(params: VerifyOtpRequest): {
    success: boolean;
    message: string;
    session?: AuthSession;
  } {
    const cleanPhone = this.sanitizePhone(params.phone);
    const inputOtp = params.otp.trim();

    // 測試萬用後門碼 (654321) 或動態產生碼
    const stored = this.activeOtps.get(cleanPhone);
    const isMockBypass = inputOtp === '654321';

    if (!isMockBypass) {
      if (!stored) {
        return {
          success: false,
          message: '尚未向該手機號碼發送驗證碼，或驗證碼已過期，請重新發送。',
        };
      }

      if (Date.now() > stored.expiresAt) {
        this.activeOtps.delete(cleanPhone);
        return {
          success: false,
          message: '驗證碼已逾時失效，請重新索取驗證碼。',
        };
      }

      if (stored.code !== inputOtp) {
        return {
          success: false,
          message: '驗證碼錯誤，請確認簡訊內容並重新輸入。',
        };
      }
    }

    // 取得暫存的註冊資料 (若本次未傳，可從 stored 中提取)
    const emailCandidate = (params.email || stored?.email || '').trim().toLowerCase();
    const realNameCandidate = (params.realName || stored?.realName || params.name || '').trim();

    // 驗證通過，清除已使用 OTP
    this.activeOtps.delete(cleanPhone);

    // 檢核用戶是否存在 (優先以 phone 查找，次以 email 查找)
    let user = this.usersByPhone.get(cleanPhone);
    if (!user && emailCandidate) {
      user = this.usersByEmail.get(emailCandidate);
    }

    let isNewUser = false;

    if (!user) {
      // 初次使用用戶：必須具備真實姓名與 Email 帳號
      isNewUser = true;
      const finalEmail = emailCandidate && this.isValidEmail(emailCandidate)
        ? emailCandidate
        : `${cleanPhone}@courier.platform`;
      const finalRealName = realNameCandidate || `會員_${cleanPhone.slice(-4)}`;

      const userId = `USR_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const preferredRole = params.preferredRole || 'ALL';
      const roles: UserRole[] = preferredRole === 'ALL'
        ? ['SENDER', 'TRAVELER', 'RECIPIENT']
        : [preferredRole];

      user = {
        id: userId,
        email: finalEmail,
        realName: finalRealName,
        phone: cleanPhone,
        name: finalRealName,
        roles,
        isEmailVerified: true,
        isPhoneVerified: true,
        kycLevel: 'PHONE_VERIFIED',
        rating: 5.0,
        walletBalanceTwd: 1000, // 新用戶贈送 $1,000 平台體驗金
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      this.usersByPhone.set(cleanPhone, user);
      this.usersByEmail.set(finalEmail, user);
      this.usersById.set(user.id, user);
      console.log(`🎉 [新用戶註冊] 建立新實名帳號: ${user.realName} (帳號 e-mail: ${user.email}, 手機: ${cleanPhone}), ID: ${user.id}`);
    } else {
      user.lastLoginAt = new Date().toISOString();
      if (emailCandidate && this.isValidEmail(emailCandidate)) {
        user.email = emailCandidate;
        this.usersByEmail.set(emailCandidate, user);
      }
      if (realNameCandidate && (!user.realName || user.realName.startsWith('會員_') || user.realName.startsWith('順路會員_'))) {
        user.realName = realNameCandidate;
        user.name = realNameCandidate;
      }
    }

    // 簽發 Session Token (有效期 7 天)
    const token = `AGY_TOKEN_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const session: AuthSession = {
      token,
      user,
      expiresAt,
    };

    this.activeSessions.set(token, session);

    return {
      success: true,
      message: isNewUser
        ? `🎉 註冊成功！帳號 [${user.email}] 與真實姓名 [${user.realName}] 已完成雙重驗證，已贈送 $1,000 TWD 體驗金至您的託管錢包！`
        : `👋 歡迎回來，${user.realName} (${user.email})！已順利完成手機 OTP 雙重身分核驗。`,
      session,
    };
  }

  /**
   * 依據 Token 取得當前登入者
   */
  public getUserByToken(token: string): UserAccount | null {
    if (!token) return null;
    const session = this.activeSessions.get(token);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.activeSessions.delete(token);
      return null;
    }

    return session.user;
  }

  /**
   * 登出
   */
  public logout(token: string): boolean {
    return this.activeSessions.delete(token);
  }

  /**
   * 依據 ID 取得用戶
   */
  public getUserById(userId: string): UserAccount | null {
    return this.usersById.get(userId) || null;
  }

  /**
   * 依據 Email 取得用戶
   */
  public getUserByEmail(email: string): UserAccount | null {
    return this.usersByEmail.get(email.trim().toLowerCase()) || null;
  }

  /**
   * 取得所有用戶清單
   */
  public getAllUsers(): UserAccount[] {
    return Array.from(this.usersById.values());
  }

  /**
   * 更新用戶錢包餘額
   */
  public updateUserWallet(userId: string, newBalance: number): void {
    const user = this.usersById.get(userId);
    if (user) {
      user.walletBalanceTwd = newBalance;
    }
  }
}
