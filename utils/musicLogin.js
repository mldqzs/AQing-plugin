/**
 * QQ音乐 / 酷狗音乐 扫码登录
 *
 * 默认走纯 HTTP 协议（只用 Node 自带 fetch，几乎不占内存/CPU），
 * 只有协议接口失效时才回退到 puppeteer 打开网页截图（按需加载、精简参数、拦截无用资源）。
 */
import crypto from 'node:crypto'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const QQ_PROFILE = 'https://y.qq.com/n/ryqq_v2/profile'
const QQ_REFERER = 'https://y.qq.com/'
const KG_HOME = 'https://www.kugou.com/'

// QQ 互联登录 QQ音乐 所用的固定参数
const QQ_APPID = '716027609'
const QQ_DAID = '383'
const QQ_3RD_AID = '100497308'
const QQ_LOGIN_JUMP = 'https://graph.qq.com/oauth2.0/login_jump'
const QQ_REDIRECT = 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/'

// 酷狗网页端
const KG_APPID = 1014
const KG_SRCAPPID = 2919
const KG_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex')

function mergeCookie (...cookies) {
  const map = new Map()
  for (const cookie of cookies.flat()) {
    for (const part of String(cookie || '').split(';')) {
      const s = part.trim()
      const i = s.indexOf('=')
      if (i <= 0) continue
      const v = s.slice(i + 1)
      // 服务端用空值/deleted 清除的 Cookie 不覆盖已有值
      if (!v || v === 'deleted') continue
      map.set(s.slice(0, i), v)
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function cookieValue (cookie = '', name) {
  return (String(cookie).match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`, 'i')) || [])[1] || ''
}

function cookieNames (cookie = '') {
  return [...new Set(String(cookie).split(';').map(v => v.trim().split('=')[0]).filter(Boolean))]
}

/** 取响应里的 Set-Cookie，转成 "k=v; k2=v2" */
function responseCookie (res) {
  const list = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie') || '']
  return list.map(v => String(v || '').split(';')[0].trim()).filter(v => v.includes('=')).join('; ')
}

async function request (url, { timeout = 15000, headers = {}, ...opt } = {}) {
  return fetch(url, {
    redirect: 'manual',
    ...opt,
    headers: { 'User-Agent': UA, ...headers },
    signal: AbortSignal.timeout(timeout)
  })
}

/** 多个调用方共享的取消判断 */
function isTimeout (start, timeoutSec) {
  return Date.now() - start >= timeoutSec * 1000
}

// ============================ QQ音乐（HTTP） ============================

function qqHash (str, init = 0) {
  let h = init
  for (const c of String(str)) h += (h << 5) + c.charCodeAt(0)
  return h & 0x7fffffff
}

function parsePtuiCB (text = '') {
  return [...String(text).matchAll(/'([^']*)'/g)].map(v => v[1])
}

async function createQQHttpQr ({ timeout }) {
  const url = `https://ssl.ptlogin2.qq.com/ptqrshow?appid=${QQ_APPID}&e=2&l=M&s=6&d=72&v=4&t=${Math.random()}&daid=${QQ_DAID}&pt_3rd_aid=${QQ_3RD_AID}`
  const res = await request(url, { timeout, headers: { Referer: 'https://xui.ptlogin2.qq.com/' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const cookie = responseCookie(res)
  const qrsig = cookieValue(cookie, 'qrsig')
  const image = Buffer.from(await res.arrayBuffer())
  if (!qrsig || image.length < 100) throw new Error('未获取到 qrsig')
  return { platform: 'qq', mode: 'http', image, qrsig, token: qqHash(qrsig), timeout }
}

async function qqHttpCheck (qr) {
  const params = new URLSearchParams({
    u1: QQ_LOGIN_JUMP,
    ptqrtoken: qr.token,
    ptredirect: '0',
    h: '1',
    t: '1',
    g: '1',
    from_ui: '1',
    ptlang: '2052',
    action: `0-0-${Date.now()}`,
    js_ver: '24112817',
    js_type: '1',
    login_sig: '',
    pt_uistyle: '40',
    aid: QQ_APPID,
    daid: QQ_DAID,
    pt_3rd_aid: QQ_3RD_AID,
    has_onekey: '1'
  })
  const res = await request(`https://ssl.ptlogin2.qq.com/ptqrlogin?${params}`, {
    timeout: qr.timeout,
    headers: { Cookie: `qrsig=${qr.qrsig}`, Referer: 'https://xui.ptlogin2.qq.com/' }
  })
  const [code, , url, , msg] = parsePtuiCB(await res.text())
  return { code, url, msg, cookie: responseCookie(res) }
}

/** ptlogin 成功后：check_sig -> oauth authorize 取 code -> 换 QQ音乐 musickey */
async function qqHttpFinish (qr, checkSigUrl, ptCookie) {
  const timeout = qr.timeout
  const sigRes = await request(checkSigUrl, { timeout, headers: { Referer: 'https://xui.ptlogin2.qq.com/' } })
  let cookie = mergeCookie(ptCookie, responseCookie(sigRes))
  const pSkey = cookieValue(cookie, 'p_skey')
  if (!pSkey) throw new Error('QQ 授权失败：未获取到 p_skey')

  const form = new URLSearchParams({
    response_type: 'code',
    client_id: QQ_3RD_AID,
    redirect_uri: QQ_REDIRECT,
    scope: 'get_user_info,get_app_friends',
    state: 'state',
    switch: '',
    from_ptlogin: '1',
    src: '1',
    update_auth: '1',
    openapi: '1010_1030',
    g_tk: String(qqHash(pSkey, 5381)),
    auth_time: String(Date.now()),
    ui: crypto.randomUUID()
  })
  const authRes = await request('https://graph.qq.com/oauth2.0/authorize', {
    method: 'POST',
    timeout,
    body: form,
    headers: { Cookie: cookie, Referer: 'https://graph.qq.com/', 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  const location = authRes.headers.get('location') || ''
  const code = (location.match(/[?&]code=([^&#]+)/) || [])[1]
  if (!code) throw new Error(`QQ 授权失败：未获取到授权 code（HTTP ${authRes.status}）`)

  const loginRes = await request('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    timeout,
    headers: { Referer: QQ_REFERER, Origin: 'https://y.qq.com', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      comm: { g_tk: 5381, platform: 'yqq', ct: 24, cv: 0, tmeLoginType: '2' },
      req1: { module: 'QQConnectLogin.LoginServer', method: 'QQLogin', param: { code } }
    })
  })
  const json = await loginRes.json().catch(() => ({}))
  const data = json?.req1?.data || {}
  const musicid = String(data.musicid || data.str_musicid || '')
  const musickey = data.musickey || ''
  if (!musicid || !musickey) throw new Error(`QQ音乐登录失败：${json?.req1?.code ?? json?.code ?? '接口无返回'}`)

  cookie = mergeCookie(
    responseCookie(loginRes),
    [
      `uin=${musicid}`,
      `qqmusic_uin=${musicid}`,
      `qqmusic_key=${musickey}`,
      `qm_keyst=${musickey}`,
      'tmeLoginType=2',
      data.openid ? `psrf_qqopenid=${data.openid}` : '',
      data.access_token ? `psrf_qqaccess_token=${data.access_token}` : '',
      data.refresh_token ? `psrf_qqrefresh_token=${data.refresh_token}` : '',
      data.unionid ? `psrf_qqunionid=${data.unionid}` : '',
      data.expired_at ? `psrf_access_token_expiresAt=${data.expired_at}` : '',
      data.musickeyCreateTime ? `psrf_musickey_createtime=${data.musickeyCreateTime}` : '',
      data.refresh_key ? `refresh_key=${data.refresh_key}` : '',
      data.encryptUin ? `euin=${data.encryptUin}` : ''
    ].filter(Boolean).join('; ')
  )
  return { cookie, uin: musicid, nick: '' }
}

async function pollQQHttp (qr, { timeoutSec, intervalMs, onScanned }) {
  const start = Date.now()
  let scanned = false
  while (!isTimeout(start, timeoutSec)) {
    const r = await qqHttpCheck(qr).catch(err => ({ code: 'neterr', msg: err?.message }))
    switch (r.code) {
      case '0':
        return qqHttpFinish(qr, r.url, r.cookie)
      case '66': // 等待扫码
      case 'neterr': // 网络抖动，继续轮询
        break
      case '67': // 已扫码，等待确认
        if (!scanned) {
          scanned = true
          await onScanned?.()
        }
        break
      case '65':
        throw new Error('二维码已失效，请重新发送扫码命令')
      case '68':
        throw new Error('已在手机上拒绝本次登录')
      default:
        throw new Error(r.msg || `未知状态 ${r.code}`)
    }
    await sleep(intervalMs)
  }
  throw new Error('QQ音乐扫码超时，请重新发送扫码命令')
}

// ============================ 酷狗（HTTP） ============================

function kugouParams (extra = {}) {
  const mid = md5(`${Date.now()}${Math.random()}`)
  const p = { appid: KG_APPID, clientver: 1000, clienttime: Date.now(), mid, uuid: mid, dfid: '-', srcappid: KG_SRCAPPID, ...extra }
  p.signature = md5(KG_SALT + Object.keys(p).sort().map(k => `${k}=${p[k]}`).join('') + KG_SALT)
  return new URLSearchParams(p)
}

async function kugouGet (path, params, timeout) {
  const res = await request(`https://login-user.kugou.com${path}?${kugouParams(params)}`, {
    timeout,
    headers: { Referer: KG_HOME }
  })
  const json = await res.json()
  return { json, cookie: responseCookie(res) }
}

async function createKugouHttpQr ({ timeout }) {
  const { json } = await kugouGet('/v2/qrcode', {
    type: 1,
    plat: 4,
    qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${KG_APPID}&`
  }, timeout)
  const key = json?.data?.qrcode
  const img = String(json?.data?.qrcode_img || '')
  if (!key || !/^data:image\//i.test(img)) throw new Error(json?.error_msg || `接口返回异常（${json?.error_code ?? '无数据'}）`)
  const image = Buffer.from(img.replace(/^data:image\/\w+;base64,/i, ''), 'base64')
  return { platform: 'kugou', mode: 'http', image, key, timeout }
}

async function pollKugouHttp (qr, { timeoutSec, intervalMs, onScanned }) {
  const start = Date.now()
  let scanned = false
  while (!isTimeout(start, timeoutSec)) {
    const r = await kugouGet('/v2/get_userinfo_qrcode', { plat: 4, qrcode: qr.key }, qr.timeout).catch(() => null)
    const data = r?.json?.data || {}
    const status = Number(data.status)
    if (status === 4) {
      const userId = String(data.userid || '')
      const token = String(data.token || '')
      if (!userId || !token) throw new Error('酷狗登录成功但未返回 Token')
      return { cookie: mergeCookie(r.cookie, `KugooID=${userId}`, `t=${token}`, `token=${token}`), userId, token, nick: data.nickname || '' }
    }
    if (status === 0) throw new Error('酷狗二维码已过期，请重新发送扫码命令')
    if (status === 2 && !scanned) {
      scanned = true
      await onScanned?.()
    }
    await sleep(intervalMs)
  }
  throw new Error('酷狗扫码超时，请重新发送扫码命令')
}

// ============================ 浏览器兜底 ============================

const BLOCK_TYPES = new Set(['font', 'media', 'websocket', 'manifest', 'texttrack', 'eventsource'])

async function launchLoginBrowser () {
  let puppeteer
  try {
    puppeteer = (await import('puppeteer')).default
  } catch (err) {
    throw new Error(`协议登录失败，且当前环境未安装 puppeteer，无法回退网页登录：${err?.message || err}`)
  }
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--disable-gpu',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--no-zygote',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--mute-audio',
      '--no-first-run',
      '--js-flags=--max-old-space-size=128'
    ]
  })
}

async function newLoginPage (browser) {
  const page = await browser.newPage()
  await page.setUserAgent(UA)
  await page.setViewport({ width: 1000, height: 700 })
  await page.setRequestInterception(true)
  page.on('request', req => {
    if (req.isInterceptResolutionHandled?.()) return
    if (BLOCK_TYPES.has(req.resourceType())) req.abort().catch(() => {})
    else req.continue().catch(() => {})
  })
  return page
}

async function waitForFrame (page, matcher, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const frame = page.frames().find(matcher)
    if (frame) return frame
    await sleep(400)
  }
  throw new Error('扫码登录页面加载超时，请稍后重试')
}

async function waitForSelectorInFrame (frame, selectors, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    for (const selector of selectors) {
      const els = await frame.$$(selector).catch(() => [])
      for (const el of els) {
        const visible = await el.evaluate(node => {
          const rect = node.getBoundingClientRect()
          const style = getComputedStyle(node)
          if (node.tagName === 'IMG' && (!node.complete || node.naturalWidth < 20 || node.naturalHeight < 20)) return false
          return rect.width > 20 && rect.height > 20 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
        }).catch(() => false)
        if (visible) return el
      }
    }
    await sleep(400)
  }
  throw new Error('二维码加载超时，请稍后重试')
}

async function screenshotElement (element) {
  const image = await element.screenshot({ type: 'png' })
  return Buffer.isBuffer(image) ? image : Buffer.from(image)
}

async function imageFromElement (element) {
  const src = await element.evaluate(el => el.currentSrc || el.src || '').catch(() => '')
  if (/^data:image\//i.test(src)) return Buffer.from(src.replace(/^data:image\/\w+;base64,/i, ''), 'base64')
  return screenshotElement(element)
}

async function cookiesOfPage (page) {
  try {
    const client = await page.target().createCDPSession()
    const { cookies = [] } = await client.send('Network.getAllCookies')
    await client.detach().catch(() => {})
    return cookies.map(v => `${v.name}=${v.value}`).join('; ')
  } catch {
    return ''
  }
}

async function createQQBrowserQr ({ timeout }) {
  const browser = await launchLoginBrowser()
  try {
    const page = await newLoginPage(browser)
    await page.goto(QQ_PROFILE, { waitUntil: 'domcontentloaded', timeout: Math.max(timeout, 30000) })
    await page.click('.profile_unlogin__btn, .top_login__link, a[href*="login"]').catch(() => {})
    const frame = await waitForFrame(page, f => /xui\.ptlogin2\.qq\.com|ssl\.ptlogin2\.qq\.com/.test(f.url()) || f.name() === 'ptlogin_iframe', timeout)
    const qrEl = await waitForSelectorInFrame(frame, ['#qrlogin_img[src*="ptqrshow"]', '#qrlogin_img', '.qrImg[src*="ptqrshow"]', '.qrImg'], timeout)
    return { platform: 'qq', mode: 'browser', browser, page, image: await screenshotElement(qrEl) }
  } catch (err) {
    await browser.close().catch(() => {})
    throw err
  }
}

async function pollQQBrowser (qr, { timeoutSec, intervalMs }) {
  const start = Date.now()
  let lastCookie = ''
  while (!isTimeout(start, timeoutSec)) {
    lastCookie = mergeCookie(lastCookie, await cookiesOfPage(qr.page))
    const uin = cookieValue(lastCookie, 'qqmusic_uin') || cookieValue(lastCookie, 'uin') || cookieValue(lastCookie, 'wxuin')
    const key = cookieValue(lastCookie, 'qqmusic_key') || cookieValue(lastCookie, 'qm_keyst') || cookieValue(lastCookie, 'psrf_musickey')
    if (uin && key) return { cookie: lastCookie, uin: uin.replace(/^o0*/, ''), nick: '' }
    await sleep(intervalMs)
  }
  throw new Error(`QQ音乐扫码超时，未捕获到 QQ音乐 Cookie。已捕获 Cookie 名称：${cookieNames(lastCookie).slice(0, 40).join(', ') || '无'}`)
}

async function createKugouBrowserQr ({ timeout }) {
  const browser = await launchLoginBrowser()
  try {
    const page = await newLoginPage(browser)
    await page.goto(KG_HOME, { waitUntil: 'domcontentloaded', timeout: Math.max(timeout, 30000) })
    await page.click('._login, .login, [class*="login"]').catch(() => {})
    const frame = await waitForFrame(page, f => /login-user\.kugou\.com\/login/.test(f.url()) || f.name() === 'loginIframe', timeout)
    const qrEl = await waitForSelectorInFrame(frame, ['#j_qrcode_img img', 'img[id^="qrcodeImgEle_"]', '.qrcode_img img', 'img[src^="data:image"]'], timeout)
    return { platform: 'kugou', mode: 'browser', browser, page, frame, image: await imageFromElement(qrEl) }
  } catch (err) {
    await browser.close().catch(() => {})
    throw err
  }
}

async function pollKugouBrowser (qr, { timeoutSec, intervalMs }) {
  const start = Date.now()
  let lastCookie = ''
  while (!isTimeout(start, timeoutSec)) {
    lastCookie = mergeCookie(lastCookie, await cookiesOfPage(qr.page))
    const userId = cookieValue(lastCookie, 'KugooID') || cookieValue(lastCookie, 'userid') || cookieValue(lastCookie, 'user_id')
    const token = cookieValue(lastCookie, 't') || cookieValue(lastCookie, 'token') || cookieValue(lastCookie, 'KugouToken')
    if (userId && token) return { cookie: mergeCookie(lastCookie, `KugooID=${userId}`, `t=${token}`, `token=${token}`), userId, token }

    const expired = await qr.frame?.evaluate(() => {
      const err = document.querySelector('#j_qrcode_err')
      return !!err && getComputedStyle(err).display !== 'none'
    }).catch(() => false)
    if (expired) throw new Error('酷狗二维码已过期，请重新发送扫码命令')
    await sleep(intervalMs)
  }
  throw new Error('酷狗扫码超时，请重新发送扫码命令')
}

// ============================ 对外接口 ============================

export async function closeQr (qr) {
  if (!qr?.browser) return
  const browser = qr.browser
  qr.browser = null
  try { await browser.close() } catch {}
}

async function createWithFallback (name, httpFn, browserFn, opts) {
  try {
    return await httpFn(opts)
  } catch (httpErr) {
    logger?.warn?.(`[音乐解析][${name}扫码] 协议获取二维码失败，回退浏览器：${httpErr?.message || httpErr}`)
    try {
      return await browserFn(opts)
    } catch (err) {
      throw new Error(`${name}二维码获取失败：${httpErr?.message || httpErr}；浏览器回退：${err?.message || err}`)
    }
  }
}

export async function createQQMusicQr ({ timeout = 20000 } = {}) {
  return createWithFallback('QQ音乐', createQQHttpQr, createQQBrowserQr, { timeout })
}

export async function createKugouQr ({ timeout = 20000 } = {}) {
  return createWithFallback('酷狗', createKugouHttpQr, createKugouBrowserQr, { timeout })
}

export async function pollQQMusicQr (qr, { timeoutSec = 120, intervalMs = 2000, onScanned } = {}) {
  try {
    return qr.mode === 'http'
      ? await pollQQHttp(qr, { timeoutSec, intervalMs, onScanned })
      : await pollQQBrowser(qr, { timeoutSec, intervalMs: Math.max(intervalMs, 2500) })
  } finally {
    await closeQr(qr)
  }
}

export async function pollKugouQr (qr, { timeoutSec = 120, intervalMs = 2000, onScanned } = {}) {
  try {
    return qr.mode === 'http'
      ? await pollKugouHttp(qr, { timeoutSec, intervalMs, onScanned })
      : await pollKugouBrowser(qr, { timeoutSec, intervalMs: Math.max(intervalMs, 2500) })
  } finally {
    await closeQr(qr)
  }
}
