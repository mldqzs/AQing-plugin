import test from 'node:test'
import assert from 'node:assert/strict'
import { closeQr, pollKugouQr, pollQQMusicQr } from '../utils/musicLogin.js'

function mockQr (cookies) {
  let reads = 0
  let closes = 0
  return {
    page: {
      async cookies () {
        reads++
        return Object.entries(cookies(reads)).map(([name, value]) => ({ name, value }))
      }
    },
    browser: { async close () { closes++ } },
    get closes () { return closes }
  }
}

test('QQ 临时 Cookie 不应被保存为成功登录', async () => {
  const qr = mockQr(() => ({ uin: 'o12345', skey: 'temporary', qqmusic_fromtag: '66' }))
  await assert.rejects(pollQQMusicQr(qr, { timeoutSec: 0.02, intervalMs: 1 }), /扫码超时/)
  assert.equal(qr.closes, 1)
})

test('QQ 等待音乐登录凭据后才返回成功', async () => {
  const qr = mockQr(reads => reads <= 5
    ? { uin: 'o12345', skey: 'temporary' }
    : { qqmusic_uin: '12345', qm_keyst: 'music-key' })
  const login = await pollQQMusicQr(qr, { timeoutSec: 1, intervalMs: 1 })
  assert.equal(login.uin, '12345')
  assert.match(login.cookie, /qm_keyst=music-key/)
  assert.equal(qr.closes, 1)
})

test('酷狗收集账号和 Token 并关闭浏览器', async () => {
  const qr = mockQr(() => ({ KugooID: '12345', t: 'music-token' }))
  const login = await pollKugouQr(qr, { timeoutSec: 1, intervalMs: 1 })
  assert.equal(login.userId, '12345')
  assert.equal(login.token, 'music-token')
  assert.match(login.cookie, /token=music-token/)
  assert.equal(qr.closes, 1)
})

test('二维码发送失败时也可安全清理浏览器', async () => {
  await closeQr(undefined)
  const qr = mockQr(() => ({}))
  await closeQr(qr)
  assert.equal(qr.closes, 1)
})
