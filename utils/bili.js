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
    throw new Error(`B站 ${endpoint} 请求失败 HTTP ${res.status}（可能为风控或网络错误页）`)
  }
  const body = await res.text()
  try {
    return JSON.parse(body)
  } catch {
    const kind = /^\s*</.test(body) ? 'HTML 网页，可能被风控或代理拦截' : '非 JSON 内容'
    throw new Error(`B站 ${endpoint} 返回了${kind}，请检查机器人服务器访问 api.bilibili.com 是否正常`)
  }
}

async function fetchVideoInfo(query) {
  let lastError
  for (const endpoint of ['view', 'wbi/view']) {
    try {
      const view = await fetchJson(`https://api.bilibili.com/x/web-interface/${endpoint}?${query}`)
      // 删除、私有等业务错误不反复请求；只有网络/风控异常才换接口。
      if (view?.code !== 0 && ![-352, -412, -500, -503].includes(view?.code)) {
        throw Object.assign(new Error(`B站接口返回：${view?.message || view?.code}`), { terminal: true })
      }
      if (view?.code !== 0 || !view?.data) throw new Error(`B站接口返回：${view?.message || view?.code || '视频信息为空'}`)
      return view.data
    } catch (err) {
      if (err.terminal) throw err
      lastError = err
      globalThis.logger?.warn?.(`[B站解析] ${endpoint} 失败：${err?.message || err}`)
    }
  }
  throw lastError
}

let buvidCache = { value: '', ts: 0 }
async function getBuvid() {
  if (buvidCache.value && Date.now() - buvidCache.ts < 3600_000) return buvidCache.value
  try {
    const j = await fetchJson('https://api.bilibili.com/x/frontend/finger/spi')
    if (j?.data?.b_3) { buvidCache = { value: j.data.b_3, ts: Date.now() }; return j.data.b_3 }
  } catch {}
  try {
    const r = await fetch('https://www.bilibili.com/', { headers: { 'User-Agent': UA } })
    const cookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : []
    for (const c of cookies) {
      const m = c.match(/buvid3=([^;]+)/)
      if (m) { buvidCache = { value: m[1], ts: Date.now() }; return m[1] }
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

  const d = await fetchVideoInfo(bvid ? `bvid=${bvid}` : `aid=${aid}`)
  const cid = d.cid || d.pages?.[0]?.cid
  const avid = d.aid

  // 保持 HTML5 渐进式 MP4 优先，地址可直接播放；PC 只用于下载接口兜底。
  let video = null
  const buvid = await getBuvid()
  for (const platform of ['html5', 'pc']) {
    try {
      const pu = await fetchJson(
        `https://api.bilibili.com/x/player/playurl?avid=${avid}&cid=${cid}&qn=64&fnval=1&fnver=0&fourk=0&platform=${platform}&high_quality=1`,
        { Referer: 'https://www.bilibili.com/', Cookie: `buvid3=${buvid}` }
      )
      const durl = pu?.data?.durl?.[0]
      if (pu?.code !== 0 || !durl?.url) {
        throw new Error(`接口返回 ${pu?.code}：${pu?.message || '未返回单文件视频地址'}`)
      }
      video = {
        url: durl.url, size: durl.size,
        headers: { Referer: 'https://www.bilibili.com/' },
        alternatives: [...new Set(durl.backup_url || [])].filter(u => typeof u === 'string' && /^https?:\/\//i.test(u) && u !== durl.url),
      }
      break
    } catch (err) {
      globalThis.logger?.warn?.(`[B站解析] playurl (${platform}) 失败：${err?.message || err}`)
    }
  }

  const pageUrl = `https://www.bilibili.com/video/${bvid || `av${avid}`}`
  return { platform: 'B站', title: d.title, cover: d.pic, author: d.owner?.name, duration: d.duration, pageUrl, video, images: null }
}
