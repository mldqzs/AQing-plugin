/*
 * B站解析（view 取信息 + playurl 取渐进式 MP4 直链）
 * 放在 utils/（不在 apps/，插件加载器不会把它当插件），供「短视频解析」与「图文解析」复用。
 * 注意：apps 下的插件文件务必保持「只导出插件类」这一个导出——index.js 用
 * Object.keys(module)[0] 取插件类，多导出且类名字母靠后会被取错。共享逻辑一律放这里。
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

async function fetchJson(url, extraHeaders = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...extraHeaders } })
  return res.json()
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

export async function parseBili(rawUrl) {
  // 还原 b23.tv / bili2233.cn 短链
  let url = rawUrl
  if (/b23\.tv|bili2233\.cn/i.test(url)) {
    try { url = (await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })).url } catch {}
  }
  const bvid = (url.match(/BV[0-9A-Za-z]{10}/) || [])[0]
  const aid = (url.match(/av(\d+)/i) || [])[1]
  if (!bvid && !aid) throw new Error('未识别到 B 站视频 ID')

  const view = await fetchJson(`https://api.bilibili.com/x/web-interface/view?${bvid ? `bvid=${bvid}` : `aid=${aid}`}`)
  if (view.code !== 0) throw new Error(`B站接口返回：${view.message || view.code}`)
  const d = view.data
  const cid = d.cid || d.pages?.[0]?.cid
  const avid = d.aid

  // 渐进式 MP4（fnval=1 单文件，免 ffmpeg 合流）；platform=html5 免登录，画质约 360/480p、体积小适合发送
  let video = null
  try {
    const buvid = await getBuvid()
    const pu = await fetchJson(
      `https://api.bilibili.com/x/player/playurl?avid=${avid}&cid=${cid}&qn=64&fnval=1&fnver=0&fourk=0&platform=html5&high_quality=1`,
      { Referer: 'https://www.bilibili.com', Cookie: `buvid3=${buvid}` }
    )
    const durl = pu?.data?.durl?.[0]
    if (pu.code === 0 && durl?.url) {
      video = { url: durl.url, size: durl.size, headers: { Referer: 'https://www.bilibili.com' } }
    }
  } catch (err) {
    logger.warn(`[B站解析] playurl 失败：${err?.message || err}`)
  }

  const pageUrl = `https://www.bilibili.com/video/${bvid || `av${avid}`}`
  return { platform: 'B站', title: d.title, cover: d.pic, author: d.owner?.name, duration: d.duration, pageUrl, video, images: null }
}
