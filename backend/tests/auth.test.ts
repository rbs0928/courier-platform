import assert from 'node:assert';
import { AuthService } from '../src/modules/auth/AuthService.ts';

console.log('🧪 正在執行 [AuthService] 用戶註冊、手機動態 OTP 驗證與 Session 單元測試...\n');

const authService = new AuthService();

// 測試 1: 發送手機 OTP 驗證碼
{
  // 1.1 無效手機號碼攔截
  const badPhoneRes = authService.sendOtp({ phone: '123', purpose: 'REGISTER' });
  assert.strictEqual(badPhoneRes.success, false, '過短手機號碼應攔截');

  // 1.2 正確手機號碼發送成功
  const goodPhoneRes = authService.sendOtp({ phone: '0988-123-456', purpose: 'REGISTER' });
  assert.strictEqual(goodPhoneRes.success, true, '正確手機號碼應發送成功');
  assert.ok(goodPhoneRes.debugOtp && goodPhoneRes.debugOtp.length === 6, '應產出 6 位數動態 OTP');
  console.log(`✅ 測試 1 通過: 手機 OTP 發送正常 (產生驗證碼: ${goodPhoneRes.debugOtp})`);

  // 測試 2: 錯誤 OTP 攔截
  const badVerifyRes = authService.verifyOtpAndLogin({
    phone: '0988-123-456',
    otp: '000000', // 錯誤碼
    name: '王小華',
  });
  assert.strictEqual(badVerifyRes.success, false, '錯誤 OTP 應無法通過');
  console.log('✅ 測試 2 通過: 錯誤 OTP 驗證碼正確被攔截');

  // 測試 3: 正確 OTP 驗證並完成【初次使用用戶新註冊】
  const goodVerifyRes = authService.verifyOtpAndLogin({
    phone: '0988-123-456',
    otp: goodPhoneRes.debugOtp!,
    name: '王小華',
    preferredRole: 'SENDER',
  });
  assert.strictEqual(goodVerifyRes.success, true, '正確 OTP 應順利完成註冊與登入');
  assert.ok(goodVerifyRes.session, '應核發 Session 憑證');
  assert.strictEqual(goodVerifyRes.session!.user.name, '王小華');
  assert.strictEqual(goodVerifyRes.session!.user.phone, '0988123456');
  assert.strictEqual(goodVerifyRes.session!.user.isPhoneVerified, true, '手機狀態應標記為已驗證');
  assert.strictEqual(goodVerifyRes.session!.user.kycLevel, 'PHONE_VERIFIED', 'KYC 等級應為 PHONE_VERIFIED');
  assert.strictEqual(goodVerifyRes.session!.user.walletBalanceTwd, 1000, '新註冊用戶應獲贈 $1,000 體驗金');
  console.log(`✅ 測試 3 通過: 新用戶 [${goodVerifyRes.session!.user.name}] 完成手機 OTP 驗證註冊，獲發 Session Token`);

  // 測試 4: 憑 Session Token 驗證身分
  const token = goodVerifyRes.session!.token;
  const user = authService.getUserByToken(token);
  assert.ok(user, '應能根據 Token 取得用戶');
  assert.strictEqual(user!.id, goodVerifyRes.session!.user.id);
  console.log('✅ 測試 4 通過: Session Token 驗證身分正常');

  // 測試 5: 再次使用相同手機登入 (非新用戶)
  authService.sendOtp({ phone: '0988-123-456', purpose: 'LOGIN' });
  const reLoginRes = authService.verifyOtpAndLogin({
    phone: '0988-123-456',
    otp: '654321', // 支援測試通用碼
  });
  assert.strictEqual(reLoginRes.success, true);
  assert.strictEqual(reLoginRes.session!.user.id, user!.id, '已註冊用戶登入應為同一帳號 ID');
  console.log('✅ 測試 5 通過: 舊用戶再次 OTP 登入識別同一帳號 ID');

  // 測試 6: 登出
  const logoutOk = authService.logout(token);
  assert.strictEqual(logoutOk, true, '登出應成功');
  const loggedOutUser = authService.getUserByToken(token);
  assert.strictEqual(loggedOutUser, null, '已登出 Token 應失效');
  console.log('✅ 測試 6 通過: 登出後 Token 正常失效');
}

console.log('\n🎉 所有 [AuthService] 用戶註冊與 OTP 驗證單元測試均 100% 通過！');
