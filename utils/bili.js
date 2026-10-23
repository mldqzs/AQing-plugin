/*
 * B站解析（view 取信息 + playurl 取渐进式 MP4 直链）
 * 放在 utils/（不在 apps/，插件加载器不会把它当插件），供「短视频解析」与「图文解析」复用。
 * 注意：apps 下的插件文件务必保持「只导出插件类」这一个导出——index.js 用
 * Object.keys(module)[0] 取插件类，多导出且类名字母靠后会被取错。共享逻辑一律放这里。
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

async function fetchJson(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Accept: 'application/json', ...extraHeaders },
    signal: AbortSignal.timeout(15000),
  })
  const endpoint = new URL(url).pathname
  if (!res.ok) {
    await res.body?.cancel()
    throw Object.assign(new Error(`B站 ${endpoint} 请求失败 HTTP ${res.status}（可能为风控或网络错误页）`), { status: res.status })
  }
  const body = await res.text()
  try {
    return JSON.parse(body)
  } catch {
    const kind = /^\s*</.test(body) ? 'HTML 网页，可能被风控或代理拦截' : '非 JSON 内容'
    throw new Error(`B站 ${endpoint} 返回了${kind}，请检查机器人服务器访问 api.bilibili.com 是否正常`)
  }
}

async function fetchVideoInfo(query, headers, pageUrl) {
  let lastError
  for (const endpoint of ['view', 'wbi/view']) {
    try {
      const view = await fetchJson(`https://api.bilibili.com/x/web-interface/${endpoint}?${query}`, headers)
      // 删除、私有等业务错误不反复请求；只有网络/风控异常才换接口。
      if (view?.code !== 0 && ![-352, -412, -500, -503].includes(view?.code)) {
        throw Object.assign(new Error(`B站接口返回：${view?.message || view?.code}`), { terminal: true })
      }
      if (view?.code !== 0 || !view?.data?.aid || !(view.data.cid || view.data.pages?.[0]?.cid)) {
        throw Object.assign(new Error(`B站接口返回：${view?.message || view?.code || '视频信息为空'}`), { status: view?.code === -412 ? 412 : undefined })
      }
      return view.data
    } catch (err) {
      if (err.terminal) throw err
      lastError = err
      globalThis.logger?.warn?.(`[B站解析] ${endpoint} 失败：${err?.message || err}`)
      // HTTP 412 常作用于整个 API 域名，不再立即重试同域名的另一路径。
      if (err.status === 412) break
    }
  }
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': UA, Accept: 'text/html', ...headers }, signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) { await res.body?.cancel(); throw new Error(`视频页面 HTTP ${res.status}`) }
    const data = readPageState(await res.text())?.videoData
    if (!data?.aid || !(data.cid || data.pages?.[0]?.cid)) throw new Error('视频页面没有可用的视频信息')
    return data
  } catch (err) {
    throw new Error(`${lastError?.message || 'B站信息接口不可用'}；页面兜底失败：${err.message}。若仍为 412，请检查服务器出口是否被 B站拦截`)
  }
}

// 只解析页面中的 JSON，不执行网页脚本。
function readPageState(html) {
  const match = /(?:window\.)?__INITIAL_STATE__\s*=\s*/.exec(html)
  if (!match) return null
  const start = match.index + match[0].length
  if (html[start] !== '{') return null
  let depth = 0, inString = false, escaped = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
    } else if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return JSON.parse(html.slice(start, i + 1))
  }
  return null
}

let buvidCache = { value: '', ts: 0 }
let cookiePending
async function getGuestCookie() {
  if (buvidCache.value && Date.now() - buvidCache.ts < 3600_000) return buvidCache.value
  if (cookiePending) return cookiePending
  cookiePending = loadGuestCookie()
  try { return await cookiePending } finally { cookiePending = null }
}

async function loadGuestCookie() {
  try {
    const j = await fetchJson('https://api.bilibili.com/x/frontend/finger/spi')
    if (j?.data?.b_3) {
      const value = [`buvid3=${j.data.b_3}`, j.data.b_4 ? `buvid4=${j.data.b_4}` : ''].filter(Boolean).join('; ')
      buvidCache = { value, ts: Date.now() }
      return value
    }
  } catch {}
  try {
    const r = await fetch('https://www.bilibili.com/', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) })
    const cookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : []
    await r.body?.cancel()
    const value = cookies.map(c => c.match(/^(?:buvid3|buvid4|b_nut)=[^;]+/)?.[0]).filter(Boolean).join('; ')
    if (value) {
      buvidCache = { value, ts: Date.now() }
      return value
    }
  } catch {}
  return ''
}

async function parseBiliLive(url) {
  const roomId = new URL(url).pathname.match(/\/(\d+)/)?.[1]
  if (!roomId) throw new Error('未识别到 B 站直播间号')
  const info = await fetchJson(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`)
  if (info?.code !== 0 || !info?.data) throw new Error(`B站直播间接口返回：${info?.message || info?.code || '未知错误'}`)
  const room = info.data
  let anchor = null
  try {
    const anchorData = await fetchJson(`https://api.live.bilibili.com/live_user/v1/UserInfo/get_anchor_in_room?roomid=${room.room_id || roomId}`)
    anchor = anchorData?.data?.info || null
  } catch {}
  const result = {
    platform: 'B站直播', title: room.title || '哔哩哔哩直播', author: room.uname || anchor?.uname || '',
    cover: room.user_cover || room.keyframe || room.cover || '', duration: 0,
    pageUrl: `https://live.bilibili.com/${roomId}`, live: true, online: room.online,
    description: room.description || '', area: [room.parent_area_name, room.area_name].filter(Boolean).join('-'),
    roomId, video: null,
  }
  // 部分房间的 live_status 与 playUrl 接口存在短暂不同步；只要接口仍返回有效流地址，
  // 就交给发送层尝试抓取切片，失败时再回退到直播间链接。
  try {
    const stream = await fetchJson(`https://api.live.bilibili.com/room/v1/Room/playUrl?cid=${roomId}&qn=80&platform=web`)
    const durls = Array.isArray(stream?.data?.durl) ? stream.data.durl.filter(item => item?.url) : []
    if (stream?.code === 0 && durls.length) {
      const headers = { Referer: 'https://live.bilibili.com/' }
      result.video = { url: durls[0].url, headers, alternatives: durls.slice(1).map(item => item.url) }
    }
  } catch {}
  return result
}

export async function parseBili(rawUrl) {
  // 还原 b23.tv / bili2233.cn 短链
  let url = rawUrl
  if (/b23\.tv|bili2233\.cn/i.test(url)) {
    try { url = (await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })).url } catch {}
  }
  if (/live\.bilibili\.com/i.test(url)) return parseBiliLive(url)
  const bvid = (url.match(/BV[0-9A-Za-z]{10}/) || [])[0]
  const aid = (url.match(/av(\d+)/i) || [])[1]
  if (!bvid && !aid) throw new Error('未识别到 B 站视频 ID')

  // 在第一个视频信息请求之前建立会话，并贯穿信息、页面及播放接口。
  const cookie = await getGuestCookie()
  const headers = { Referer: 'https://www.bilibili.com/', ...(cookie ? { Cookie: cookie } : {}) }
  const pageUrl = `https://www.bilibili.com/video/${bvid || `av${aid}`}`
  const d = await fetchVideoInfo(bvid ? `bvid=${bvid}` : `aid=${aid}`, headers, pageUrl)
  const cid = d.cid || d.pages?.[0]?.cid
  const avid = d.aid

  // 保持 HTML5 渐进式 MP4 优先，地址可直接播放；PC 只用于下载接口兜底。
  let video = null
  let playError
  for (const platform of ['html5', 'pc']) {
    try {
      const pu = await fetchJson(
        `https://api.bilibili.com/x/player/playurl?avid=${avid}&cid=${cid}&qn=64&fnval=1&fnver=0&fourk=0&platform=${platform}&high_quality=1`,
        headers
      )
      const durl = pu?.data?.durl?.[0]
      if (pu?.code !== 0 || !durl?.url) {
        throw Object.assign(new Error(`接口返回 ${pu?.code}：${pu?.message || '未返回单文件视频地址'}`), { status: pu?.code === -412 ? 412 : undefined })
      }
      video = {
        url: durl.url, size: durl.size,
        headers: { Referer: 'https://www.bilibili.com/' },
        alternatives: [...new Set(durl.backup_url || [])].filter(u => typeof u === 'string' && /^https?:\/\//i.test(u) && u !== durl.url),
      }
      break
    } catch (err) {
      playError = err
      globalThis.logger?.warn?.(`[B站解析] playurl (${platform}) 失败：${err?.message || err}`)
      if (err.status === 412) break
    }
  }

  if (!video && playError?.status === 412) {
    throw new Error('B站播放接口被 HTTP 412 拦截，尚未提取到视频，请检查服务器出口是否被 B站拦截')
  }

  return { platform: 'B站', title: d.title, cover: d.pic, author: d.owner?.name, duration: d.duration, pageUrl, video, images: null }
}
