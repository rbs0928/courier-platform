import assert from 'node:assert';
import { AuthService } from '../src/modules/auth/AuthService.ts';

console.log('🧪 正在執行 [AuthService] 用戶註冊、Email 帳號、真實姓名(證件相符)與手機雙重 OTP 驗證測試...\n');

const authService = new AuthService();

// 測試 1: 發送手機 OTP 驗證碼 (驗證 email 與手機格式)
{
  // 1.1 無效手機號碼攔截
  const badPhoneRes = authService.sendOtp({ phone: '123', purpose: 'REGISTER' });
  assert.strictEqual(badPhoneRes.success, false, '過短手機號碼應攔截');

  // 1.2 無效 Email 格式攔截
  const badEmailRes = authService.sendOtp({
    phone: '0988-123-456',
    email: 'not-an-email',
    purpose: 'REGISTER',
  });
  assert.strictEqual(badEmailRes.success, false, '不合格 Email 格式應攔截');

  // 1.3 正確 Email 與手機號碼發送成功
  const goodPhoneRes = authService.sendOtp({
    phone: '0988-123-456',
    email: 'wang.xiaohua@tripcourier.com',
    realName: '王小華',
    purpose: 'REGISTER',
  });
  assert.strictEqual(goodPhoneRes.success, true, '正確手機號碼與 Email 應發送成功');
  assert.ok(goodPhoneRes.debugOtp && goodPhoneRes.debugOtp.length === 6, '應產出 6 位數動態 OTP');
  console.log(`✅ 測試 1 通過: Email 格式核驗與手機 OTP 發送正常 (產生驗證碼: ${goodPhoneRes.debugOtp})`);

  // 測試 2: 錯誤 OTP 攔截
  const badVerifyRes = authService.verifyOtpAndLogin({
    phone: '0988-123-456',
    email: 'wang.xiaohua@tripcourier.com',
    realName: '王小華',
    otp: '000000', // 錯誤碼
  });
  assert.strictEqual(badVerifyRes.success, false, '錯誤 OTP 應無法通過');
  console.log('✅ 測試 2 通過: 錯誤 OTP 驗證碼正確被攔截');

  // 測試 3: 正確 OTP 驗證並完成【初次使用用戶新註冊】(Email帳號 + 真實姓名證件相符)
  const goodVerifyRes = authService.verifyOtpAndLogin({
    phone: '0988-123-456',
    email: 'wang.xiaohua@tripcourier.com',
    realName: '王小華',
    otp: goodPhoneRes.debugOtp!,
    preferredRole: 'SENDER',
  });
  assert.strictEqual(goodVerifyRes.success, true, '正確 OTP 應順利完成註冊與登入');
  assert.ok(goodVerifyRes.session, '應核發 Session 憑證');
  assert.strictEqual(goodVerifyRes.session!.user.email, 'wang.xiaohua@tripcourier.com', '帳號名稱應為指定 Email');
  assert.strictEqual(goodVerifyRes.session!.user.realName, '王小華', '真實姓名應與證件登記相符');
  assert.strictEqual(goodVerifyRes.session!.user.phone, '0988123456');
  assert.strictEqual(goodVerifyRes.session!.user.isPhoneVerified, true, '手機狀態應標記為已驗證');
  assert.strictEqual(goodVerifyRes.session!.user.isEmailVerified, true, 'Email 狀態應標記為已驗證');
  assert.strictEqual(goodVerifyRes.session!.user.kycLevel, 'PHONE_VERIFIED', 'KYC 等級應為 PHONE_VERIFIED');
  assert.strictEqual(goodVerifyRes.session!.user.walletBalanceTwd, 1000, '新註冊用戶應獲贈 $1,000 體驗金');
  console.log(`✅ 測試 3 通過: 新用戶 [${goodVerifyRes.session!.user.realName} (${goodVerifyRes.session!.user.email})] 完成 Email 與手機雙重驗證註冊，獲發 Session Token`);

  // 測試 4: 憑 Session Token 驗證身分
  const token = goodVerifyRes.session!.token;
  const user = authService.getUserByToken(token);
  assert.ok(user, '應能根據 Token 取得用戶');
  assert.strictEqual(user!.id, goodVerifyRes.session!.user.id);
  console.log('✅ 測試 4 通過: Session Token 驗證身分正常');

  // 測試 5: 依據 Email 查找用戶
  const userByEmail = authService.getUserByEmail('wang.xiaohua@tripcourier.com');
  assert.ok(userByEmail, '應可依 Email 索引快速查得用戶帳號');
  assert.strictEqual(userByEmail!.id, user!.id);
  console.log('✅ 測試 5 通過: 依據 Email 帳號名稱快速查詢與識別');

  // 測試 6: 舊用戶再次登入
  authService.sendOtp({ phone: '0988-123-456', purpose: 'LOGIN' });
  const reLoginRes = authService.verifyOtpAndLogin({
    phone: '0988-123-456',
    otp: '654321', // 支援測試通用碼
  });
  assert.strictEqual(reLoginRes.success, true);
  assert.strictEqual(reLoginRes.session!.user.id, user!.id, '已註冊用戶登入應為同一帳號 ID');
  console.log('✅ 測試 6 通過: 舊用戶再次 OTP 登入識別同一帳號 ID');

  // 測試 7: 登出
  const logoutOk = authService.logout(token);
  assert.strictEqual(logoutOk, true, '登出應成功');
  const loggedOutUser = authService.getUserByToken(token);
  assert.strictEqual(loggedOutUser, null, '已登出 Token 應失效');
  console.log('✅ 測試 7 通過: 登出後 Token 正常失效');
}

console.log('\n🎉 所有 [AuthService] 用戶註冊、Email帳號與雙重驗證單元測試均 100% 通過！');
