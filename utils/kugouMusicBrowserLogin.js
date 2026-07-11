/* 酷狗音乐扫码登录（浏览器模式）
 *
 * 让 Chromium 打开酷狗官方网页并使用页面自身的登录流程，插件只负责
 * 截取二维码、等待登录成功，再读取 Cookie 保存到配置。
 */

const LOGIN_URL = 'https://www.kugou.com/'

function cookieString (cookies = []) {
  return cookies
    .filter(v => v?.name && v?.value)
    .map(v => `${v.name}=${v.value}`)
    .join('; ')
}

function decode (value = '') {
  try { return decodeURIComponent(value) } catch { return String(value) }
}

function kugouFields (cookies = []) {
  const map = new Map(cookies.map(v => [String(v.name).toLowerCase(), String(v.value || '')]))
  let userId = map.get('kugooid') || ''
  let token = map.get('t') || map.get('token') || ''
  let nickname = map.get('nickname') || map.get('username') || ''
  const packed = decode(map.get('kugoo') || '')
  if (!userId) userId = (packed.match(/(?:^|[,&;])KugooID=([^,&;]+)/i) || [])[1] || ''
  if (!token) token = (packed.match(/(?:^|[,&;])(?:t|token)=([^,&;]+)/i) || [])[1] || ''
  if (!nickname) nickname = (packed.match(/(?:^|[,&;])NickName=([^,&;]+)/i) || [])[1] || ''
  return { userId: decode(userId), token: decode(token), nickname: decode(nickname) }
}

async function findQrElement (page) {
  const fallback = []
  for (const frame of page.frames()) {
    const isLoginFrame = /login-user\.kugou\.com\/login/i.test(frame.url())
    const handles = await frame.$$('img, canvas').catch(() => [])
    for (const handle of handles) {
      const info = await handle.evaluate(el => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        const text = `${el.id || ''} ${el.className || ''} ${el.getAttribute?.('alt') || ''} ${el.getAttribute?.('src') || ''}`
        return {
          visible: rect.width >= 100 && rect.height >= 100 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0,
          square: Math.abs(rect.width - rect.height) < Math.max(rect.width, rect.height) * 0.25,
          likely: /qr|qrcode|扫码|二维码/i.test(text),
          width: rect.width,
          height: rect.height
        }
      }).catch(() => null)
      if (info?.visible && info.square && info.likely) {
        for (const item of fallback) await item.dispose().catch(() => {})
        return handle
      }
      if (isLoginFrame && info?.visible && info.square && info.width <= 360 && info.height <= 360) fallback.push(handle)
      else await handle.dispose().catch(() => {})
    }
  }
  const element = fallback.shift() || null
  for (const item of fallback) await item.dispose().catch(() => {})
  return element
}

export async function startKugouMusicBrowserLogin (renderer) {
  if (!renderer || typeof renderer.browserInit !== 'function') throw new Error('当前渲染器不支持浏览器登录')
  const browser = await renderer.browserInit()
  if (!browser) throw new Error('Chromium 启动失败')
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 })
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })

    const login = await page.$('._login, [class*="login"]')
    if (login) await login.click().catch(() => {})
    else await page.evaluate(() => {
      const el = [...document.querySelectorAll('a, button, div, span')].find(v => /^登录$/.test(v.textContent?.trim() || ''))
      el?.click()
    })

    const deadline = Date.now() + 30000
    let qr
    while (!qr && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      qr = await findQrElement(page)
    }
    if (!qr) throw new Error('酷狗官方登录页未生成二维码')
    const image = await qr.screenshot({ type: 'png' })
    await qr.dispose().catch(() => {})
    return { page, image }
  } catch (err) {
    await page.close().catch(() => {})
    throw err
  }
}

export async function waitKugouMusicBrowserLogin (page, timeout = 120000) {
  const deadline = Date.now() + timeout
  try {
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      if (page.isClosed()) return { status: 'error', msg: '登录页面已关闭' }

      const cookies = await page.cookies('https://www.kugou.com/', 'https://kugou.com/', 'https://login-user.kugou.com/', 'https://wwwapi.kugou.com/', 'https://m.kugou.com/')
      const fields = kugouFields(cookies)
      if (fields.userId && fields.token) {
        return { status: 'success', cookie: cookieString(cookies), ...fields }
      }

      const state = await page.evaluate(() => {
        const text = document.body?.innerText || ''
        return { expired: /二维码.{0,8}(失效|过期)|请刷新二维码/.test(text) }
      }).catch(() => ({ expired: false }))
      if (state.expired) return { status: 'expired', msg: '二维码已过期' }
    }
    return { status: 'expired', msg: '登录超时' }
  } finally {
    await page.close().catch(() => {})
  }
}
