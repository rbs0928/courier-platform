import type {
  UserAccount,
  AuthSession,
  SendOtpRequest,
  VerifyOtpRequest,
  UserRole,
} from '../../types/index.ts';

interface StoredOtp {
  phone: string;
  code: string;
  expiresAt: number;
  purpose: 'REGISTER' | 'LOGIN';
}

export class AuthService {
  private usersByPhone: Map<string, UserAccount> = new Map();
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
      phone: '0912345678',
      name: '林晨旅 (示範旅人/寄件者)',
      roles: ['TRAVELER', 'SENDER', 'RECIPIENT'],
      isPhoneVerified: true,
      kycLevel: 'PHONE_VERIFIED',
      rating: 5.0,
      walletBalanceTwd: 1000,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    this.usersByPhone.set(demoUser.phone, demoUser);
    this.usersById.set(demoUser.id, demoUser);
  }

  /**
   * 格式化電話號碼 (去除非數字字元)
   */
  public sanitizePhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * 發送 6 位數手機動態驗證碼 (OTP)
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

    // 產生 6 位數動態 OTP 碼
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 分鐘有效

    this.activeOtps.set(cleanPhone, {
      phone: cleanPhone,
      code,
      expiresAt,
      purpose: params.purpose,
    });

    console.log(`📱 [SMS Gateway] 向 ${cleanPhone} 發送 OTP 驗證碼: [${code}] (有效期限 5 分鐘)`);

    return {
      success: true,
      message: `驗證碼已發送至 ${cleanPhone}！請於 5 分鐘內輸入。`,
      debugOtp: code, // 在開發/展示環境中提供，使前端能自動提示或帶入
    };
  }

  /**
   * 校驗 OTP 並完成註冊／登入
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

    // 驗證通過，清除已使用 OTP
    this.activeOtps.delete(cleanPhone);

    // 檢核用戶是否存在
    let user = this.usersByPhone.get(cleanPhone);
    let isNewUser = false;

    if (!user) {
      // 初次使用用戶：自動完成帳號註冊
      isNewUser = true;
      const userId = `USR_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const preferredRole = params.preferredRole || 'ALL';
      const roles: UserRole[] = preferredRole === 'ALL'
        ? ['SENDER', 'TRAVELER', 'RECIPIENT']
        : [preferredRole];

      user = {
        id: userId,
        phone: cleanPhone,
        name: params.name?.trim() || `順路會員_${cleanPhone.slice(-4)}`,
        roles,
        isPhoneVerified: true,
        kycLevel: 'PHONE_VERIFIED',
        rating: 5.0,
        walletBalanceTwd: 1000, // 新用戶贈送 $1,000 平台體驗金
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      this.usersByPhone.set(cleanPhone, user);
      this.usersById.set(user.id, user);
      console.log(`🎉 [新用戶註冊] 建立新帳號: ${user.name} (${cleanPhone}), ID: ${user.id}`);
    } else {
      user.lastLoginAt = new Date().toISOString();
      if (params.name && params.name.trim() && user.name.startsWith('順路會員_')) {
        user.name = params.name.trim();
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
        ? `🎉 註冊成功！歡迎加入全運具順路快遞平台，已贈送 $1,000 TWD 體驗金至您的錢包！`
        : `👋 歡迎回來，${user.name}！已順利完成登入。`,
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
   * 取得指定用戶資料
   */
  public getUserById(userId: string): UserAccount | null {
    return this.usersById.get(userId) || null;
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
