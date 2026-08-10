const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
const QQ_PROFILE = 'https://y.qq.com/n/ryqq_v2/profile'
const QQ_REFERER = 'https://y.qq.com/'
const KG_HOME = 'https://www.kugou.com/'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function mergeCookie (...cookies) {
  const map = new Map()
  for (const cookie of cookies.flat()) {
    for (const part of String(cookie || '').split(';')) {
      const s = part.trim()
      const i = s.indexOf('=')
      if (i <= 0) continue
      const k = s.slice(0, i)
      const v = s.slice(i + 1)
      if (v !== undefined) map.set(k, v)
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function cookieValue (cookie = '', name) {
  return (String(cookie).match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`, 'i')) || [])[1] || ''
}

async function launchLoginBrowser () {
  let puppeteer
  try {
    puppeteer = (await import('puppeteer')).default
  } catch (err) {
    throw new Error(`当前环境未安装 puppeteer，无法打开扫码登录页面：${err?.message || err}`)
  }
  return puppeteer.launch({
    headless: 'new',
    args: ['--disable-gpu', '--disable-setuid-sandbox', '--no-sandbox', '--no-zygote']
  })
}

async function newLoginPage (browser) {
  const page = await browser.newPage()
  await page.setUserAgent(UA)
  await page.setViewport({ width: 1200, height: 900 })
  return page
}

async function waitForFrame (page, matcher, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const frame = page.frames().find(matcher)
    if (frame) return frame
    await sleep(300)
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
          return rect.width > 20 && rect.height > 20 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
        }).catch(() => false)
        if (visible) return el
      }
    }
    await sleep(300)
  }
  throw new Error('二维码加载超时，请稍后重试')
}

async function screenshotElement (element) {
  const image = await element.screenshot({ type: 'png' })
  return Buffer.isBuffer(image) ? image : Buffer.from(image)
}

async function imageFromElement (element, frame = null) {
  const src = await element.evaluate(el => el.currentSrc || el.src || '').catch(() => '')
  if (src) {
    if (/^data:image\//i.test(src)) return Buffer.from(src.replace(/^data:image\/\w+;base64,/i, ''), 'base64')
    const data = await (frame || element.frame?.()).evaluate(async url => {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Array.from(new Uint8Array(await res.arrayBuffer()))
    }, src)
    return Buffer.from(data)
  }
  const image = await element.screenshot({ type: 'png' })
  return Buffer.isBuffer(image) ? image : Buffer.from(image)
}

async function cookiesOfPage (page, urls) {
  const chunks = []
  for (const url of urls) {
    try {
      const cookies = await page.cookies(url)
      chunks.push(cookies.map(v => `${v.name}=${v.value}`).join('; '))
    } catch {}
  }
  try {
    const client = await page.target().createCDPSession()
    const { cookies = [] } = await client.send('Network.getAllCookies')
    chunks.push(cookies.map(v => `${v.name}=${v.value}`).join('; '))
    await client.detach().catch(() => {})
  } catch {}
  return mergeCookie(chunks)
}

function setCookieHeaderToCookie (value = '') {
  const headers = Array.isArray(value) ? value : [value]
  return headers.map(v => String(v || '').split(';')[0].trim()).filter(v => v.includes('=')).join('; ')
}

function decodeQQLoginUrl (text = '') {
  const raw = String(text || '')
  const match = raw.match(/ptuiCB\((.*)\)/) || raw.match(/CB\((.*)\)/)
  if (!match) return ''
  const args = [...match[1].matchAll(/'([^']*)'/g)].map(v => v[1])
  const url = args.find(v => /^https?:\/\//i.test(v)) || ''
  return url.replace(/\\x26/g, '&').replace(/&amp;/g, '&')
}

async function collectQQCookies (qr) {
  const cookie = await cookiesOfPage(qr.page, [QQ_REFERER, QQ_PROFILE, 'https://y.qq.com/', 'https://graph.qq.com/', 'https://ptlogin2.qq.com/', 'https://ssl.ptlogin2.qq.com/', 'https://xui.ptlogin2.qq.com/'])
  return mergeCookie(qr.headerCookie || '', cookie)
}

function watchQQLoginTraffic (page) {
  const seenUrls = []
  let headerCookie = ''
  page.on('response', async res => {
    try {
      const url = res.url()
      if (!/ptlogin2\.qq\.com|graph\.qq\.com|y\.qq\.com/.test(url)) return
      seenUrls.push(url)
      const headers = res.headers()
      headerCookie = mergeCookie(headerCookie, setCookieHeaderToCookie(headers['set-cookie']))
    } catch {}
  })
  page.on('request', req => {
    try {
      const url = req.url()
      if (/ptlogin2\.qq\.com|graph\.qq\.com|y\.qq\.com/.test(url)) seenUrls.push(url)
    } catch {}
  })
  return {
    get headerCookie () { return headerCookie },
    get urls () { return seenUrls }
  }
}

function qqLoginInfo (cookie = '') {
  const uin = cookieValue(cookie, 'uin') || cookieValue(cookie, 'qqmusic_uin') || cookieValue(cookie, 'wxuin') || cookieValue(cookie, 'psrf_qqopenid')
  const key = cookieValue(cookie, 'p_skey') || cookieValue(cookie, 'skey') || cookieValue(cookie, 'qqmusic_key') || cookieValue(cookie, 'qm_keyst') || cookieValue(cookie, 'psrf_musickey') || cookieValue(cookie, 'psrf_qqaccess_token')
  const hasQQ = /(?:^|;\s*)(uin|qqmusic_uin|wxuin|psrf_qqopenid|p_skey|skey|qqmusic_key|qm_keyst|psrf_musickey|psrf_qqaccess_token|psrf_qqrefresh_token|qqmusic_fromtag)=/i.test(cookie)
  return { uin, key, hasQQ }
}

async function closeQr (qr) {
  try { await qr?.browser?.close?.() } catch {}
}

async function waitForQQQrReady (frame, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const state = await frame.evaluate(() => {
      const img = document.querySelector('#qrlogin_img, .qrImg, img[src*="ptqrshow"]')
      const src = img?.currentSrc || img?.src || ''
      const errText = document.body?.innerText || ''
      const expired = /二维码.*(失效|过期)|刷新二维码|点击刷新/.test(errText)
      const rect = img?.getBoundingClientRect?.()
      const style = img ? getComputedStyle(img) : null
      return { src, expired, visible: !!(img && rect.width > 20 && rect.height > 20 && style.display !== 'none' && style.visibility !== 'hidden') }
    }).catch(() => ({}))
    if (state.visible && state.src && !state.expired) return true
    await frame.evaluate(() => {
      const refresh = document.querySelector('#qr_invalid, .qr_invalid, .qrlogin_img_outdate, .refresh, [href="javascript:pt.qlogin.reload()"]')
      if (refresh) refresh.click()
      if (window.pt?.qlogin?.reload) window.pt.qlogin.reload()
    }).catch(() => {})
    await sleep(500)
  }
  return false
}

export async function createQQMusicQr ({ timeout = 20000 } = {}) {
  const browser = await launchLoginBrowser()
  try {
    const page = await newLoginPage(browser)
    await page.goto(QQ_PROFILE, { waitUntil: 'networkidle2', timeout: Math.max(timeout, 30000) })
    await page.click('.profile_unlogin__btn, .top_login__link, a[href*="login"]').catch(() => {})
    const frame = await waitForFrame(page, f => /xui\.ptlogin2\.qq\.com|ssl\.ptlogin2\.qq\.com/.test(f.url()) || f.name() === 'ptlogin_iframe', timeout)
    const qrEl = await waitForSelectorInFrame(frame, ['#qrlogin_img[src*="ptqrshow"]', '#qrlogin_img', '.qrImg[src*="ptqrshow"]', '.qrImg'], timeout)
    const image = await screenshotElement(qrEl)
    return { platform: 'qq', browser, page, image }
  } catch (err) {
    await browser.close().catch(() => {})
    throw new Error(`QQ音乐二维码获取失败：${err?.message || err}`)
  }
}

async function autoClickQQAuthorize (page) {
  for (const frame of page.frames()) {
    const clicked = await frame.evaluate(() => {
      const re = /授权|同意|确认|登录|允许/
      const nodes = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"], .btn, [role="button"]'))
      for (const el of nodes) {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        const text = el.innerText || el.value || el.getAttribute('title') || ''
        if (rect.width < 1 || rect.height < 1 || style.display === 'none' || style.visibility === 'hidden') continue
        if (!re.test(text)) continue
        el.click()
        return text.trim() || true
      }
      return ''
    }).catch(() => '')
    if (clicked) return clicked
  }
  return ''
}

async function followQQCallback (page) {
  const frame = page.frames().find(f => /graph\.qq\.com\/oauth2\.0\/login_jump|graph\.qq\.com\/oauth2\.0\/show|y\.qq\.com\/portal\/wx_redirect\.html|y\.qq\.com\/.*[?&]code=/.test(f.url()) && !/xui\.ptlogin2\.qq\.com\/cgi-bin\/xlogin/.test(f.url()))
  if (!frame) return false
  const url = frame.url()
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
    return true
  } catch {
    return false
  }
}

async function qqJumpFromPtlogin (page) {
  for (const frame of page.frames()) {
    if (!/ptlogin2\.qq\.com/.test(frame.url())) continue
    const url = await frame.evaluate(() => {
      const w = window
      const vals = [w.pt?.login_sig, w.pt?.ptui?.login_sig, w.g_login_sig, w.pt_login_sig, document.querySelector('input[name="pt_login_sig"]')?.value]
      return vals.filter(Boolean)[0] || ''
    }).catch(() => '')
    if (url) return url
  }
  return ''
}

export async function pollQQMusicQr (qr, { timeoutSec = 120, intervalMs = 2500 } = {}) {
  const start = Date.now()
  let lastCookie = ''
  try {
    while (Date.now() - start < timeoutSec * 1000) {
      const cookie = await cookiesOfPage(qr.page, [QQ_REFERER, QQ_PROFILE, 'https://graph.qq.com/', 'https://ssl.ptlogin2.qq.com/', 'https://xui.ptlogin2.qq.com/'])
      lastCookie = mergeCookie(lastCookie, cookie)
      const info = qqLoginInfo(lastCookie)
      if (info.key || info.hasQQ) return { cookie: lastCookie, uin: info.uin ? info.uin.replace(/^o/, '') : '', nick: '' }


      await sleep(intervalMs)
    }
    const finalInfo = qqLoginInfo(lastCookie)
    if (finalInfo.key || finalInfo.hasQQ) return { cookie: lastCookie, uin: finalInfo.uin ? finalInfo.uin.replace(/^o/, '') : '', nick: '' }
    const names = [...new Set(String(lastCookie).split(';').map(v => v.trim().split('=')[0]).filter(Boolean))]
    throw new Error(`QQ音乐扫码超时，未捕获到 QQ音乐 Cookie。已捕获 Cookie 名称：${names.slice(0, 40).join(', ') || '无'}`)
  } finally {
    await closeQr(qr)
  }
}

export async function createKugouQr ({ timeout = 20000 } = {}) {
  const browser = await launchLoginBrowser()
  try {
    const page = await newLoginPage(browser)
    await page.goto(KG_HOME, { waitUntil: 'networkidle2', timeout: Math.max(timeout, 30000) })
    await page.click('._login, .login, [class*="login"]').catch(() => {})
    const frame = await waitForFrame(page, f => /login-user\.kugou\.com\/login/.test(f.url()) || f.name() === 'loginIframe', timeout)
    const qrEl = await waitForSelectorInFrame(frame, ['#j_qrcode_img img', 'img[id^="qrcodeImgEle_"]', '.qrcode_img img', 'img[src^="data:image"]'], timeout)
    return { platform: 'kugou', browser, page, frame, image: await imageFromElement(qrEl, frame) }
  } catch (err) {
    await browser.close().catch(() => {})
    throw new Error(`酷狗二维码获取失败：${err?.message || err}`)
  }
}

export async function pollKugouQr (qr, { timeoutSec = 120, intervalMs = 2500 } = {}) {
  const start = Date.now()
  let lastCookie = ''
  try {
    while (Date.now() - start < timeoutSec * 1000) {
      const cookie = await cookiesOfPage(qr.page, [KG_HOME, 'https://login-user.kugou.com/', 'https://staticssl.kugou.com/'])
      lastCookie = mergeCookie(lastCookie, cookie)
      const userId = cookieValue(lastCookie, 'KugooID') || cookieValue(lastCookie, 'KuGoo') || cookieValue(lastCookie, 'userid') || cookieValue(lastCookie, 'user_id')
      const token = cookieValue(lastCookie, 't') || cookieValue(lastCookie, 'token') || cookieValue(lastCookie, 'KugouToken')
      if (userId && token) return { cookie: mergeCookie(lastCookie, `KugooID=${userId}`, `t=${token}`, `token=${token}`), userId, token }

      const state = await qr.frame?.evaluate(() => {
        const ok = document.querySelector('#j_qrcode_ok')
        const err = document.querySelector('#j_qrcode_err')
        const styleOf = el => el ? getComputedStyle(el).display : 'none'
        return { ok: styleOf(ok) !== 'none', err: styleOf(err) !== 'none', text: document.body?.innerText || '' }
      }).catch(() => ({}))
      if (state?.err) throw new Error('酷狗二维码已过期，请重新发送扫码命令')
      await sleep(intervalMs)
    }
    throw new Error('酷狗扫码超时，请重新发送扫码命令')
  } finally {
    await closeQr(qr)
  }
}
