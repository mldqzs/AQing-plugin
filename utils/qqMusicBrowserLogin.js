/* QQ音乐扫码登录（浏览器模式）
 *
 * QQ 当前会对服务器直接轮询 ptqrlogin 返回 403，因此改为让 Chromium 加载官方登录页，
 * 由页面自身执行二维码生成和状态轮询。插件只截图二维码区域、等待页面登录成功，
 * 再读取浏览器 Cookie 保存到配置。
 */

const LOGIN_URL = 'https://ui.ptlogin2.qq.com/cgi-bin/login?appid=716027609&daid=383&pt_3rd_aid=100497308&s_url=https%3A%2F%2Fy.qq.com%2F&style=40&hide_title_bar=1&hide_border=1&target=self&link_target=blank&low_login=0&qlogin_auto_login=1&no_verifyimg=1'

function cookieString (cookies = []) {
  return cookies
    .filter(v => v?.name && v?.value)
    .map(v => `${v.name}=${v.value}`)
    .join('; ')
}

async function findQrElement (page) {
  for (const frame of page.frames()) {
    const handles = await frame.$$('img, canvas').catch(() => [])
    for (const handle of handles) {
      const info = await handle.evaluate(el => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        const text = `${el.id || ''} ${el.className || ''} ${el.getAttribute?.('alt') || ''} ${el.getAttribute?.('src') || ''}`
        return {
          visible: rect.width >= 80 && rect.height >= 80 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0,
          square: Math.abs(rect.width - rect.height) < Math.max(rect.width, rect.height) * 0.25,
          likely: /qr|qrcode|ptqrshow|二维码|扫码/i.test(text),
          width: rect.width,
          height: rect.height
        }
      }).catch(() => null)
      if (info?.visible && info.square && (info.likely || (info.width <= 360 && info.height <= 360))) return handle
      await handle.dispose().catch(() => {})
    }
  }
  return null
}

export async function startQQMusicBrowserLogin (renderer) {
  if (!renderer || typeof renderer.browserInit !== 'function') throw new Error('当前渲染器不支持浏览器登录')
  const browser = await renderer.browserInit()
  if (!browser) throw new Error('Chromium 启动失败')
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 560, height: 720, deviceScaleFactor: 2 })
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })

    // 等官方页面自己的登录脚本加载并生成二维码；二维码有时在 iframe 里，不能只查主页面 #qrlogin_img。
    let qr = null
    const deadline = Date.now() + 45000
    while (!qr && Date.now() < deadline) {
      qr = await findQrElement(page)
      if (qr) break
      await page.evaluate(() => {
        const refresh = document.querySelector('#refresh_qrcode, .refresh, .qr_invalid') || [...document.querySelectorAll('a, div, span')].find(v => /点击刷新/.test(v.textContent || ''))
        refresh?.click()
      }).catch(() => {})
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    if (!qr) {
      // 兜底：官方页面结构经常变，识别不到二维码元素时不要直接失败，直接发整页截图给用户扫码。
      const image = await page.screenshot({ type: 'png', fullPage: false })
      return { page, image }
    }
    const image = await qr.screenshot({ type: 'png' })
    await qr.dispose().catch(() => {})
    return { page, image }
  } catch (err) {
    await page.close().catch(() => {})
    throw err
  }
}

export async function waitQQMusicBrowserLogin (page, timeout = 120000, onScanned) {
  const deadline = Date.now() + timeout
  let notified = false
  try {
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      if (page.isClosed()) return { status: 'error', msg: '登录页面已关闭' }

      const state = await page.evaluate(() => {
        const text = document.body?.innerText || ''
        return {
          scanned: /扫描成功|手机上确认|授权登录/.test(text),
          expired: /二维码.*失效|二维码.*过期/.test(text)
        }
      }).catch(() => ({ scanned: false, expired: false }))

      if (state.scanned && !notified) {
        notified = true
        await onScanned?.()
      }
      if (state.expired) return { status: 'expired', msg: '二维码已过期' }

      const cookies = await page.cookies('https://y.qq.com/', 'https://qq.com/', 'https://ptlogin2.qq.com/', 'https://ui.ptlogin2.qq.com/', 'https://xui.ptlogin2.qq.com/')
      const names = new Set(cookies.map(v => v.name))
      const logged = names.has('uin') || names.has('p_uin') || names.has('qqmusic_key') || names.has('qm_keyst') || names.has('skey') || names.has('p_skey')
      if (logged) {
        // 有些环境手机确认后不会立刻跳出 ptlogin 页；只要登录 Cookie 到了，就主动打开 QQ音乐补齐站点 Cookie。
        await page.goto('https://y.qq.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
        await new Promise(resolve => setTimeout(resolve, 1500))
        const all = await page.cookies('https://y.qq.com/', 'https://qq.com/', 'https://ptlogin2.qq.com/', 'https://ui.ptlogin2.qq.com/', 'https://xui.ptlogin2.qq.com/')
        return { status: 'success', cookie: cookieString(all), msg: '登录成功' }
      }
    }
    return { status: 'expired', msg: '登录超时' }
  } finally {
    await page.close().catch(() => {})
  }
}
