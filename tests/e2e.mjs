const BASE = 'http://localhost:3001'

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`)
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts)
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, ok: res.ok, json, text }
}

async function main() {
  console.log('1. Checking unauthenticated /api/admin/users, /api/courses POST, /api/sync/status, and IDOR /api/user/profile?userId=8723192 return 401...')
  const unauth = await req('/api/admin/users')
  assert(unauth.status === 401, `Expected 401 for /api/admin/users, got ${unauth.status}`)
  const unauthCourse = await req('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  assert(unauthCourse.status === 401, `Expected 401 for POST /api/courses, got ${unauthCourse.status}`)
  const unauthSync = await req('/api/sync/status')
  assert(unauthSync.status === 401, `Expected 401 for /api/sync/status, got ${unauthSync.status}`)
  const idorTry = await req('/api/user/profile?userId=8723192')
  assert(idorTry.status === 401, `Expected 401 for unauthenticated /api/user/profile?userId=8723192, got ${idorTry.status}`)

  console.log('1b. Checking security headers on /api/health...')
  const healthRes = await fetch(`${BASE}/api/health`)
  assert(healthRes.headers.get('x-content-type-options') === 'nosniff', 'Missing X-Content-Type-Options: nosniff')
  assert(healthRes.headers.get('x-frame-options') === 'SAMEORIGIN', 'Missing X-Frame-Options: SAMEORIGIN')

  console.log('2. Logging in as immutable super admin (admin / AsAhouse34231724)...')
  const adminLogin = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'AsAhouse34231724' }),
  })
  assert(adminLogin.ok && adminLogin.json?.token, `Admin login failed: ${adminLogin.text}`)
  const adminToken = adminLogin.json.token
  const adminHeaders = { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken }

  console.log('3. Checking immutable admin username change rejection (403) & SSRF block on /api/sync/remote...')
  const ssrfTry = await req('/api/sync/remote', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ remoteUrl: 'http://169.254.169.254/latest/meta-data/' }),
  })
  assert(!ssrfTry.ok && ssrfTry.text.includes('安全防护'), `Expected SSRF block, got: ${ssrfTry.text}`)
  const renameTry = await req('/api/admin/change-password', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ oldPassword: 'AsAhouse34231724', newPassword: 'AsAhouse34231724', newUsername: 'hacker' }),
  })
  assert(renameTry.status === 403, `Expected 403 for newUsername on immutable admin, got ${renameTry.status}`)

  console.log('4. Creating test user via email + vip_monthly...')
  const testEmail = `e2e_test_${Date.now()}@yanxidao.com`
  const createRes = await req('/api/admin/users', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email: testEmail, nickname: 'E2E测试学员', vipType: 'vip_monthly', status: 'active' }),
  })
  assert(createRes.ok && createRes.json?.tempPassword?.length === 8, `Create user failed: ${createRes.text}`)
  const userId = createRes.json.id
  const tempPwd = createRes.json.tempPassword
  const resetLink = createRes.json.resetLink || ''
  const tokenMatch = resetLink.match(/token=([^&]+)/)
  assert(tokenMatch, `Missing reset token in link: ${resetLink}`)
  const resetToken = tokenMatch[1]
  console.log(`   Created user ${userId}, tempPwd=${tempPwd}, emailStatus=${createRes.json.emailStatus}`)

  console.log('5. Verifying Option A reset token & setting new password...')
  const verifyTok = await req(`/api/auth/verify-reset-token?token=${encodeURIComponent(resetToken)}`)
  assert(verifyTok.ok && verifyTok.json?.valid, `verify-reset-token failed: ${verifyTok.text}`)

  const resetRes = await req('/api/auth/reset-by-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: resetToken, newPassword: 'NewPassword123' }),
  })
  assert(resetRes.ok && resetRes.json?.token, `reset-by-token failed: ${resetRes.text}`)
  const userToken = resetRes.json.token

  console.log('6. Checking EXP gain & DAILY_EXP_CAP (1200) with active VIP (1.25x)...')
  const expRes = await req('/api/user/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify({ addStudySeconds: 600, addSentenceCount: 50 }),
  })
  assert(expRes.ok && expRes.json?.profile, `PUT /api/user/profile failed: ${expRes.text}`)
  const prof = expRes.json.profile
  assert(prof.todayExp <= 1200 && prof.todayExp > 0, `Unexpected todayExp: ${prof.todayExp}`)
  console.log(`   todayExp=${prof.todayExp}, expGained=${expRes.json.expGained}, level=${prof.level}, isVipActive=${prof.isVipActive}`)

  console.log('7. Checking VIP expiration auto-downgrade preserves level & sets hasEverVip=true...')
  const pastExpire = await req(`/api/admin/users/${userId}/vip`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ vipType: 'vip_monthly', customExpireAt: '2020-01-01 00:00:00' }),
  })
  assert(pastExpire.ok, `Set past VIP failed: ${pastExpire.text}`)
  const profileAfterExpire = await req('/api/user/profile', {
    headers: { 'Authorization': `Bearer ${userToken}` },
  })
  assert(profileAfterExpire.ok, `Get profile failed: ${profileAfterExpire.text}`)
  assert(profileAfterExpire.json.vipType === 'free', `Expected auto-downgrade to free, got ${profileAfterExpire.json.vipType}`)
  assert(profileAfterExpire.json.hasEverVip === true, `Expected hasEverVip=true`)
  assert(profileAfterExpire.json.isVipActive === false, `Expected isVipActive=false`)
  assert(profileAfterExpire.json.level >= prof.level, `Expected level preserved`)

  console.log('7b. Checking VIP upgrade applications & two-way messaging...')
  const userHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` }
  // Free user cannot apply for 'free'
  const badTier = await req('/api/user/vip-requests', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({ targetVipType: 'free', note: 'bad' }),
  })
  assert(badTier.status === 400, `Expected 400 for same/lower tier 'free', got ${badTier.status}`)

  // Free user applies for vip_monthly
  const applyMonthly = await req('/api/user/vip-requests', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({ targetVipType: 'vip_monthly', note: '我想申请升级月度会员' }),
  })
  assert(applyMonthly.ok && applyMonthly.json?.request?.id, `Apply vip_monthly failed: ${applyMonthly.text}`)
  const req1Id = applyMonthly.json.request.id

  // Admin lists requests & replies with payment link
  const adminList1 = await req('/api/admin/vip-requests', { headers: adminHeaders })
  assert(adminList1.ok && adminList1.json.requests.some(r => r.id === req1Id), 'Admin did not see req1Id')
  const adminReply1 = await req(`/api/admin/vip-requests/${req1Id}/reply`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ content: '请点击支付链接：https://pay.yanxidao.example/order/123' }),
  })
  assert(adminReply1.ok && adminReply1.json.status === 'replied', `Admin reply failed: ${adminReply1.text}`)

  // User replies back
  const userReply1 = await req(`/api/user/vip-requests/${req1Id}/messages`, {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({ content: '链接打开报错，请确认' }),
  })
  assert(userReply1.ok, `User reply failed: ${userReply1.text}`)

  // Admin rejects req1Id
  const adminReject = await req(`/api/admin/vip-requests/${req1Id}/status`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'rejected' }),
  })
  assert(adminReject.ok && adminReject.json.status === 'rejected', `Admin reject failed: ${adminReject.text}`)

  // Both sides can still reply back and forth after rejection
  const adminReplyAfterReject = await req(`/api/admin/vip-requests/${req1Id}/reply`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ content: '请换用此链接：https://pay.yanxidao.example/order/456' }),
  })
  assert(adminReplyAfterReject.ok, `Admin reply after reject failed: ${adminReplyAfterReject.text}`)
  const userReplyAfterReject = await req(`/api/user/vip-requests/${req1Id}/messages`, {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({ content: '好的我重新申请半年会员' }),
  })
  assert(userReplyAfterReject.ok, `User reply after reject failed: ${userReplyAfterReject.text}`)

  // User CANNOT re-apply for processed targetVipType 'vip_monthly'
  const reapplyMonthly = await req('/api/user/vip-requests', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({ targetVipType: 'vip_monthly', note: '再次申请月度' }),
  })
  assert(reapplyMonthly.status === 400, `Expected 400 for processed vip_monthly, got ${reapplyMonthly.status}`)

  // User CAN apply for vip_half_year
  const applyHalf = await req('/api/user/vip-requests', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({ targetVipType: 'vip_half_year', note: '申请半年VIP' }),
  })
  assert(applyHalf.ok && applyHalf.json?.request?.id, `Apply vip_half_year failed: ${applyHalf.text}`)
  const req2Id = applyHalf.json.request.id

  // Admin approves req2Id -> user automatically upgraded to vip_half_year
  const adminApprove = await req(`/api/admin/vip-requests/${req2Id}/status`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'approved' }),
  })
  assert(adminApprove.ok && adminApprove.json.status === 'approved', `Admin approve failed: ${adminApprove.text}`)

  const profAfterApprove = await req('/api/user/profile', { headers: userHeaders })
  assert(profAfterApprove.ok && profAfterApprove.json.vipType === 'vip_half_year' && profAfterApprove.json.isVipActive === true, `Expected vip_half_year active, got ${profAfterApprove.text}`)

  // Verify user's higherTypes is now only ['vip_lifetime'] and processedTypes contains vip_monthly & vip_half_year
  const userReqList = await req('/api/user/vip-requests', { headers: userHeaders })
  assert(userReqList.ok, `Get user vip-requests failed: ${userReqList.text}`)
  assert(userReqList.json.higherTypes.length === 1 && userReqList.json.higherTypes[0] === 'vip_lifetime', `Expected higherTypes=['vip_lifetime'], got ${JSON.stringify(userReqList.json.higherTypes)}`)
  assert(userReqList.json.processedTypes.includes('vip_monthly') && userReqList.json.processedTypes.includes('vip_half_year'), `Expected processedTypes to include monthly & half_year`)

  console.log('7c. Checking dual-client single-slot session kick (1 Web + 1 Desktop) & idempotent sync...')
  // Reset userToken came from reset-by-token (defaults to web). Now login 1 desktop session:
  const deskLogin1 = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'NewPassword123', clientType: 'desktop' }),
  })
  assert(deskLogin1.ok && deskLogin1.json.token && deskLogin1.json.clientType === 'desktop', `Desktop login 1 failed: ${deskLogin1.text}`)
  const deskToken1 = deskLogin1.json.token

  // Both web (userToken) and desktop (deskToken1) must work concurrently!
  const webCheck1 = await req('/api/user/sync', { headers: { Authorization: `Bearer ${userToken}` } })
  const deskCheck1 = await req('/api/user/sync', { headers: { Authorization: `Bearer ${deskToken1}` } })
  assert(webCheck1.ok && deskCheck1.ok, `Expected both 1 web & 1 desktop active concurrently`)

  // Login 2nd web session -> must kick 1st web session (userToken), while deskToken1 stays alive!
  const webLogin2 = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'NewPassword123', clientType: 'web' }),
  })
  assert(webLogin2.ok && webLogin2.json.token, `Web login 2 failed: ${webLogin2.text}`)
  const webToken2 = webLogin2.json.token
  const kickedWeb = await req('/api/user/sync', { headers: { Authorization: `Bearer ${userToken}` } })
  assert(kickedWeb.status === 401 && kickedWeb.json?.code === 'SESSION_KICKED', `Expected SESSION_KICKED for old web, got ${kickedWeb.status} ${kickedWeb.text}`)
  const deskStillAlive = await req('/api/user/sync', { headers: { Authorization: `Bearer ${deskToken1}` } })
  assert(deskStillAlive.ok, `Expected desktop session still alive after web kick, got ${deskStillAlive.text}`)

  // Login 2nd desktop session -> must kick 1st desktop session (deskToken1), while webToken2 stays alive!
  const deskLogin2 = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'NewPassword123', clientType: 'desktop' }),
  })
  assert(deskLogin2.ok && deskLogin2.json.token, `Desktop login 2 failed: ${deskLogin2.text}`)
  const deskToken2 = deskLogin2.json.token
  const kickedDesk = await req('/api/user/sync', { headers: { Authorization: `Bearer ${deskToken1}` } })
  assert(kickedDesk.status === 401 && kickedDesk.json?.code === 'SESSION_KICKED', `Expected SESSION_KICKED for old desktop, got ${kickedDesk.status} ${kickedDesk.text}`)
  const webStillAlive = await req('/api/user/sync', { headers: { Authorization: `Bearer ${webToken2}` } })
  assert(webStillAlive.ok, `Expected webToken2 still alive after desktop kick`)

  // Idempotent sync replay via POST /api/user/sync
  const evId = `e2e_ev_${Date.now()}`
  const syncPush1 = await req('/api/user/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deskToken2}` },
    body: JSON.stringify({ events: [{ eventId: evId, addStudySeconds: 60, addSentenceCount: 5 }] }),
  })
  assert(syncPush1.ok && syncPush1.json.appliedCount === 1, `Sync push 1 failed: ${syncPush1.text}`)
  const expAfterSync1 = syncPush1.json.profile.exp

  // Replay exact same eventId from webToken2 -> must deduplicate!
  const syncPush2 = await req('/api/user/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${webToken2}` },
    body: JSON.stringify({ events: [{ eventId: evId, addStudySeconds: 60, addSentenceCount: 5 }] }),
  })
  assert(syncPush2.ok && syncPush2.json.deduplicatedCount === 1 && syncPush2.json.profile.exp === expAfterSync1, `Expected deduplicatedCount=1 and unchanged exp, got ${syncPush2.text}`)

  console.log('8. Checking disabled user login returns 403...')
  const banRes = await req(`/api/admin/users/${userId}/status`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'disabled' }),
  })
  assert(banRes.ok, `Ban failed: ${banRes.text}`)
  const bannedLogin = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'NewPassword123' }),
  })
  assert(bannedLogin.status === 403, `Expected 403 for banned user login, got ${bannedLogin.status}`)

  console.log('9. Checking reset-password generates new 8-char temp password...')
  const resetPwdAdmin = await req(`/api/admin/users/${userId}/reset-password`, {
    method: 'POST',
    headers: adminHeaders,
  })
  assert(resetPwdAdmin.ok && resetPwdAdmin.json?.tempPassword?.length === 8, `Reset pwd failed: ${resetPwdAdmin.text}`)

  console.log('10. Checking demoLogin for default user 8723192...')
  const demoRes = await req('/api/auth/demo-login', { method: 'POST' })
  assert(demoRes.ok && demoRes.json?.user?.id === '8723192', `demoLogin failed: ${demoRes.text}`)

  console.log('11. Cleaning up test user...')
  const delRes = await req(`/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  })
  assert(delRes.ok, `Cleanup delete failed: ${delRes.text}`)

  console.log('ALL E2E CHECKS PASSED!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
