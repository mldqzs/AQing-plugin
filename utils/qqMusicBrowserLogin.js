/* QQ音乐扫码登录（浏览器模式）
 *
 * QQ 当前会对服务器直接轮询 ptqrlogin 返回 403，因此改为让 Chromium 加载官方登录页，
 * 由页面自身执行二维码生成和状态轮询。插件只截图二维码区域、等待页面登录成功，
 * 再读取浏览器 Cookie 保存到配置。
 */

const LOGIN_URL = 'https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=716027609&daid=383&pt_3rd_aid=100497308&s_url=https%3A%2F%2Fy.qq.com%2F'

function cookieString (cookies = []) {
  return cookies
    .filter(v => v?.name && v?.value)
    .map(v => `${v.name}=${v.value}`)
    .join('; ')
}

export async function startQQMusicBrowserLogin (renderer) {
  if (!renderer || typeof renderer.browserInit !== 'function') throw new Error('当前渲染器不支持浏览器登录')
  const browser = await renderer.browserInit()
  if (!browser) throw new Error('Chromium 启动失败')
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 560, height: 720, deviceScaleFactor: 2 })
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })

    // 等官方页面自己的登录脚本加载并生成二维码；首次请求偶尔会直接显示失效，自动点一次刷新。
    const waitQr = () => page.waitForFunction(() => {
      const img = document.querySelector('#qrlogin_img') || [...document.images].find(v => /ptqrshow|qrshow/i.test(v.src || ''))
      return img && img.naturalWidth > 20
    }, { timeout: 15000 })
    try {
      await waitQr()
    } catch {
      await page.evaluate(() => {
        const refresh = document.querySelector('#refresh_qrcode, .refresh, .qr_invalid') || [...document.querySelectorAll('a, div, span')].find(v => /点击刷新/.test(v.textContent || ''))
        refresh?.click()
      })
      await waitQr()
    }

    const qr = await page.$('#qrlogin_img') || await page.evaluateHandle(() => {
      return [...document.images].find(img => /ptqrshow|qrshow/i.test(img.src || '') && img.naturalWidth > 20) || null
    })
    const element = qr.asElement()
    if (!element) throw new Error('官方登录页未生成二维码')
    const image = await element.screenshot({ type: 'png' })
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

      const cookies = await page.cookies('https://y.qq.com/', 'https://qq.com/', 'https://ptlogin2.qq.com/', 'https://xui.ptlogin2.qq.com/')
      const names = new Set(cookies.map(v => v.name))
      const logged = names.has('uin') || names.has('p_uin') || names.has('qqmusic_key') || names.has('qm_keyst') || names.has('skey') || names.has('p_skey')
      if (logged) {
        // 有些环境手机确认后不会立刻跳出 ptlogin 页；只要登录 Cookie 到了，就主动打开 QQ音乐补齐站点 Cookie。
        await page.goto('https://y.qq.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
        await new Promise(resolve => setTimeout(resolve, 1500))
        const all = await page.cookies('https://y.qq.com/', 'https://qq.com/', 'https://ptlogin2.qq.com/', 'https://xui.ptlogin2.qq.com/')
        return { status: 'success', cookie: cookieString(all), msg: '登录成功' }
      }
    }
    return { status: 'expired', msg: '登录超时' }
  } finally {
    await page.close().catch(() => {})
  }
}
