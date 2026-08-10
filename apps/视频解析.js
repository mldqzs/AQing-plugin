import plugin from '../../../lib/plugins/plugin.js'
import setting from '../utils/setting.js'
import common from '../../../lib/common/common.js'
import { parseBili } from '../utils/bili.js'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/*
 * 短视频解析（抖音 / 快手 / B站）
 * - 被动触发：用 accept(e) 钩子扫每条消息，识别到分享链接就解析，无需指令。
 *   （accept 能覆盖「JSON 卡片分享」——这类消息 e.msg 往往为空，靠 rule 正则匹配不到）
 * - 全部走「原生轻量解析」，不依赖 yt-dlp、无需 cookie：
 *     B站   官方 API（view 取信息 + playurl 取渐进式 MP4 直链）
 *     抖音   iesdouyin 移动分享页 _ROUTER_DATA（自动去水印；图文则发图片）
 *     快手   移动分享页 window.INIT_STATE（photo.mainMvUrls；图集走 atlas）
 * - 可选：用 ffmpeg 从视频抽出音轨当背景音乐，发语音条 + mp3 文件（默认关）。
 * - 配置存 config/config/video.yaml，支持锅巴/手动修改、热生效。
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
// 抖音/快手分享页需移动端 UA 才返回内嵌数据
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
const TMP_DIR = './data/aq/video'

// 实时读取配置（getConfig = 默认配置 ∪ 用户配置，chokidar 热重载）
const cfg = () => setting.getConfig('video') || {}

/* ───────────── 工具 ───────────── */

function ensureTmp() {
  try { if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}
}

function fmtDur(sec) {
  sec = parseInt(sec) || 0
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// 把一条消息里所有可能含链接的文本汇总（纯文本 + JSON/XML 卡片）
function collectText(e) {
  const parts = [e.msg || '', e.raw_message || '']
  for (const seg of e.message || []) {
    if (!seg) continue
    if (seg.type === 'text') parts.push(seg.text || '')
    else if (seg.type === 'json' || seg.type === 'xml') {
      let raw = seg.data
      if (raw && typeof raw === 'object') raw = raw.data || JSON.stringify(raw)
      parts.push(String(raw || ''))
    }
  }
  // 卡片里的链接常被转义成 https:\/\/ 和 &amp;
  return parts.join('\n').replace(/\\\//g, '/').replace(/&amp;/g, '&')
}

// 识别平台与链接，返回 { platform, url } 或 null
function detect(text) {
  let m
  // —— B站 ——
  if ((m = text.match(/https?:\/\/(?:b23\.tv|bili2233\.cn)\/[A-Za-z0-9]+/i))) return { platform: 'bili', url: m[0] }
  if ((m = text.match(/https?:\/\/(?:www\.|m\.)?bilibili\.com\/video\/(?:BV[0-9A-Za-z]{10}|av\d+)[^\s'"]*/i))) return { platform: 'bili', url: m[0] }
  if ((m = text.match(/\bBV[0-9A-Za-z]{10}\b/))) return { platform: 'bili', url: `https://www.bilibili.com/video/${m[0]}` }
  if ((m = text.match(/\bav(\d{6,})\b/i))) return { platform: 'bili', url: `https://www.bilibili.com/video/av${m[1]}` }
  // —— 抖音 ——
  if ((m = text.match(/https?:\/\/v\.douyin\.com\/[A-Za-z0-9_-]+/i))) return { platform: 'douyin', url: m[0] }
  if ((m = text.match(/https?:\/\/(?:www\.)?(?:douyin|iesdouyin)\.com\/[^\s'"]+/i))) return { platform: 'douyin', url: m[0] }
  // —— 快手 ——
  if ((m = text.match(/https?:\/\/v\.kuaishou\.com\/[A-Za-z0-9_-]+/i))) return { platform: 'kuaishou', url: m[0] }
  if ((m = text.match(/https?:\/\/(?:www\.|v\.m\.|m\.)?(?:kuaishou|chenzhongtech|gifshow)\.com\/[^\s'"]+/i))) return { platform: 'kuaishou', url: m[0] }
  return null
}

const PLATFORM_CN = { bili: 'B站', douyin: '抖音', kuaishou: '快手' }
const PLATFORM_SWITCH = { bili: 'parseBili', douyin: 'parseDouyin', kuaishou: 'parseKuaishou' }
// 抖音几分钟的视频即使体积不一定超过 maxSize，也容易把 NapCat 发视频流程干崩，单独按长视频甩直链
const DOUYIN_LONG_VIDEO_SECONDS = 180

// 先探测远端视频体积：能拿到大小就提前决定是否甩直链，避免下载后再让适配器尝试发超大视频
async function probeRemoteSize(url, headers) {
  const baseHeaders = { 'User-Agent': UA, ...headers }
  const tryRead = async (method) => {
    const reqHeaders = method === 'GET' ? { ...baseHeaders, Range: 'bytes=0-0' } : baseHeaders
    const res = await fetch(url, { method, headers: reqHeaders, redirect: 'follow' })
    const range = res.headers.get('content-range') || ''
    const m = range.match(/\/(\d+)$/)
    if (m) return Number(m[1])
    const len = Number(res.headers.get('content-length') || 0)
    // Range GET 返回 206 时，content-length 只有 1 字节，不代表完整视频大小
    if (method !== 'GET' || res.status !== 206) return len
    return 0
  }
  try {
    const len = await tryRead('HEAD')
    if (len) return len
  } catch {}
  try {
    return await tryRead('GET')
  } catch {
    return 0
  }
}

// 流式下载到本地文件（带自定义请求头，B站直链建议带 Referer），按 maxMB 卡体积
async function downloadToFile(url, headers, dest, maxMB) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`下载失败 HTTP ${res.status}`)
  const limit = maxMB ? maxMB * 1048576 : 0
  const len = Number(res.headers.get('content-length') || 0)
  // 有 content-length 时先按它快速拒掉，连下都不下
  if (limit && len && len > limit) {
    try { await res.body.cancel() } catch {}
    throw new Error(`视频体积 ${(len / 1048576).toFixed(1)}MB 超过上限 ${maxMB}MB`)
  }
  // 没有 content-length（分块传输）也要兜底：边下边数字节，一超限立刻中止，
  // 避免把超大文件整个落到磁盘、再喂给 NapCat 撑爆内存（OOM「已杀死」）
  let got = 0
  const guard = new Transform({
    transform(chunk, _enc, cb) {
      got += chunk.length
      if (limit && got > limit) return cb(new Error(`视频体积超过上限 ${maxMB}MB`))
      cb(null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(res.body), guard, fs.createWriteStream(dest))
  } catch (err) {
    fs.unlink(dest, () => {})   // 中止后清掉半截文件
    throw err
  }
  return dest
}

// 本机文件统一用 file:// URI 交给适配器：NapCat 直接从磁盘读，
// 不在云崽进程里把整文件 base64 进内存，大幅降低发大视频时的内存峰值
const fileUri = (p) => 'file://' + path.resolve(p)

// 用 ffmpeg 从视频里抽出音轨为 mp3（背景音乐），失败返回 null
function runFFmpeg(args, timeout = 120000) {
  return new Promise((resolve) => {
    execFile('ffmpeg', args, { timeout, maxBuffer: 1024 * 1024 * 16 }, (err) => resolve(!err))
  })
}
async function extractAudio(videoFile) {
  const mp3 = videoFile.replace(/\.[^.]+$/, '') + '_bgm.mp3'
  const ok = await runFFmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', videoFile, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', mp3])
  return ok && fs.existsSync(mp3) ? mp3 : null
}

/* ───────────── B站：解析逻辑在 utils/bili.js，供本插件与图文解析复用 ───────────── */

/* ───────────── 抖音：分享页 / Web 接口自解析 ───────────── */

const DOUYIN_HEADERS = {
  'User-Agent': MOBILE_UA,
  'Referer': 'https://www.douyin.com/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

// 还原短链 / 从链接里取 aweme_id（19 位左右的纯数字）
async function resolveDouyinId(rawUrl) {
  let url = String(rawUrl || '').replace(/[，。！？、)）\]}]+$/g, '')
  if (/douyin\.com/i.test(url)) {
    try {
      const r = await fetch(url, { headers: DOUYIN_HEADERS, redirect: 'follow' })
      url = r.url || url
    } catch {}
  }
  const m = url.match(/(?:video|note)\/(\d{17,21})/) || url.match(/(\d{17,21})/) || rawUrl.match(/(\d{17,21})/)
  return m ? m[1] : null
}

function firstUrl(obj) {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  if (Array.isArray(obj)) return obj.find(Boolean) || ''
  return obj.url || obj.url_list?.find(Boolean) || obj.download_url_list?.find(Boolean) || obj.uri || ''
}

// 从「marker 后面的第一个 JSON 对象」里按括号配平提取，避免正则遇到嵌套对象提前截断
function pickJsonObject(html, marker) {
  const pos = html.indexOf(marker)
  if (pos < 0) return ''
  const start = html.indexOf('{', pos)
  if (start < 0) return ''

  let depth = 0
  let inStr = false
  let quote = ''
  let esc = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === quote) inStr = false
      continue
    }
    if (ch === '"' || ch === "'") { inStr = true; quote = ch; continue }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (!depth) return html.slice(start, i + 1)
    }
  }
  return ''
}

function parseDouyinPageData(html) {
  const dataList = []

  const routerJson = pickJsonObject(html, '_ROUTER_DATA')
  if (routerJson) {
    try { dataList.push(JSON.parse(routerJson)) } catch {}
  }

  const render = html.match(/<script[^>]+id=["']RENDER_DATA["'][^>]*>([\s\S]*?)<\/script>/i)
  if (render?.[1]) {
    try { dataList.push(JSON.parse(decodeURIComponent(render[1]))) } catch {}
  }

  return dataList
}

function findDouyinItem(data, seen = new Set()) {
  if (!data || typeof data !== 'object' || seen.has(data)) return null
  seen.add(data)

  if (Array.isArray(data)) {
    for (const it of data) {
      const found = findDouyinItem(it, seen)
      if (found) return found
    }
    return null
  }

  if (data.aweme_detail?.video || data.aweme_detail?.images) return data.aweme_detail
  if (data.item_list?.[0]?.video || data.item_list?.[0]?.images) return data.item_list[0]
  if (data.videoInfoRes?.item_list?.[0]) return data.videoInfoRes.item_list[0]
  if ((data.aweme_id || data.group_id || data.desc) && (data.video || data.images)) return data

  for (const key of Object.keys(data)) {
    const found = findDouyinItem(data[key], seen)
    if (found) return found
  }
  return null
}

async function fetchDouyinItem(id) {
  const pages = [
    `https://www.douyin.com/video/${id}`,
    `https://www.iesdouyin.com/share/video/${id}/`,
  ]

  for (const url of pages) {
    try {
      const html = await (await fetch(url, { headers: DOUYIN_HEADERS, redirect: 'follow' })).text()
      for (const data of parseDouyinPageData(html)) {
        const item = findDouyinItem(data)
        if (item) return item
      }
    } catch (err) {
      logger.debug?.(`[短视频解析] 抖音页面解析失败：${err?.message || err}`)
    }
  }

  // 页面 SSR 数据拿不到时，兜底请求 Web 详情接口；公开作品通常不需要 Cookie
  try {
    const api = `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${id}&aid=1128&version_name=23.5.0&device_platform=webapp&os_name=Windows&os_version=10`
    const res = await fetch(api, { headers: { ...DOUYIN_HEADERS, Accept: 'application/json,text/plain,*/*' }, redirect: 'follow' })
    const data = await res.json()
    return findDouyinItem(data)
  } catch (err) {
    logger.debug?.(`[短视频解析] 抖音接口解析失败：${err?.message || err}`)
  }
  return null
}

async function fetchDouyinExternal(rawUrl, id) {
  const api = `https://api.xingzhige.com/API/douyin/?url=${encodeURIComponent(rawUrl)}`
  try {
    const res = await fetch(api, { headers: { 'User-Agent': UA, Accept: 'application/json,text/plain,*/*' }, redirect: 'follow' })
    const data = await res.json()
    const d = data?.data
    const item = d?.item
    if (data?.code !== 0 || !item) return null

    const vurl = item.url || item.video || item.play || ''
    const images = Array.isArray(item.images) ? item.images.filter(Boolean) : null
    return {
      platform: '抖音',
      title: item.title || '',
      author: d.author?.name || '',
      cover: item.cover || item.cover_gif || d.author?.avatar || '',
      duration: Math.round(Number(item.duration || 0)),
      pageUrl: id ? `https://www.douyin.com/video/${id}` : rawUrl,
      bgmTitle: '',
      video: vurl ? { url: vurl, size: Number(item.size) || 0, headers: { 'User-Agent': MOBILE_UA, Referer: 'https://www.douyin.com' } } : null,
      images: images?.length ? images : null,
    }
  } catch (err) {
    logger.debug?.(`[短视频解析] 抖音外部兜底解析失败：${err?.message || err}`)
    return null
  }
}

async function parseDouyin(rawUrl) {
  const id = await resolveDouyinId(rawUrl)
  if (!id) throw new Error('未取到抖音作品 ID')

  let item = await fetchDouyinItem(id)
  if (!item) {
    const external = await fetchDouyinExternal(rawUrl, id)
    if (external?.video || external?.images?.length) return external
  }
  if (!item) throw new Error('抖音作品获取失败（可能已删除、私密、需要登录，或页面已改版）')

  const title = item.desc || item.caption || ''
  const author = item.author?.nickname || item.author_user_info?.nickname || ''
  const cover = firstUrl(item.video?.cover) || firstUrl(item.video?.origin_cover) || firstUrl(item.cover)
  const pageUrl = `https://www.douyin.com/video/${id}`
  const bgmTitle = item.music?.title || ''

  // 图文/图集笔记：images 非空。逐张区分——自带小视频的是「实况/动图」，按视频发；其余发静态图
  if (Array.isArray(item.images) && item.images.length) {
    const images = []
    const liveVideos = []
    for (const im of item.images) {
      const v = firstUrl(im?.video?.play_addr) || firstUrl(im?.video?.download_addr)
      if (v) {
        liveVideos.push({ url: v.replace('playwm', 'play'), headers: { 'User-Agent': MOBILE_UA, Referer: 'https://www.douyin.com' } })
      } else {
        const u = firstUrl(im) || firstUrl(im?.display_image) || firstUrl(im?.download_url_list)
        if (u) images.push(u)
      }
    }
    if (images.length || liveVideos.length) return { platform: '抖音', title, author, cover, duration: 0, pageUrl, video: null, images, liveVideos }
  }

  const duration = Math.round((item.video?.duration || item.duration || 0) / 1000)
  // play_addr 取直链，playwm → play 去水印；部分作品的直链在 bit_rate 里
  let vurl = firstUrl(item.video?.play_addr) || firstUrl(item.video?.download_addr) || firstUrl(item.video?.bit_rate?.[0]?.play_addr)
  vurl = vurl.replace('playwm', 'play')
  const video = vurl ? { url: vurl, headers: { 'User-Agent': MOBILE_UA, Referer: 'https://www.douyin.com' } } : null
  if (!video) throw new Error('未取到抖音视频直链')
  return { platform: '抖音', title, author, cover, duration, pageUrl, bgmTitle, video, images: null }
}


/* ───────────── 快手：移动分享页 INIT_STATE 自解析 ───────────── */

async function parseKuaishou(rawUrl) {
  // 还原短链；快手分享落到 m.chenzhongtech.com / m.gifshow.com 的 /fw/photo/ 页
  const r = await fetch(rawUrl, { headers: { 'User-Agent': MOBILE_UA, Referer: 'https://v.kuaishou.com/' }, redirect: 'follow' })
  const finalUrl = (r.url || rawUrl).replace('/fw/long-video/', '/fw/photo/')
  let html
  if (finalUrl !== r.url) {
    html = await (await fetch(finalUrl, { headers: { 'User-Agent': MOBILE_UA, Referer: 'https://v.kuaishou.com/' } })).text()
  } else {
    html = await r.text()
  }

  const m = html.match(/window\.INIT_STATE\s*=\s*(.*?)<\/script>/s)
  if (!m) throw new Error('快手页面结构变化，解析失败')
  let data
  try { data = JSON.parse(m[1].trim()) } catch { throw new Error('快手页面数据解析失败') }

  // 动态找含 photo 的那一项
  let photo = null
  for (const k in data) {
    if (data[k] && typeof data[k] === 'object' && data[k].photo) { photo = data[k].photo; break }
  }
  if (!photo) throw new Error('快手作品获取失败（可能已删除、需要登录，或页面已改版）')

  const title = photo.caption || ''
  const author = photo.userName || ''
  const cover = photo.coverUrls?.[0]?.url || ''
  const duration = Math.round((photo.duration || 0) / 1000)

  // 图集（atlas）：cdnList 主机 + list 路径
  const atlas = photo.ext_params?.atlas
  if (atlas?.cdnList?.length && atlas?.list?.length) {
    const host = atlas.cdnList[0]?.cdn || atlas.cdnList[0]
    const images = atlas.list.map(route => `https://${host}/${route}`).filter(Boolean)
    if (images.length) return { platform: '快手', title, author, cover, duration: 0, pageUrl: finalUrl, video: null, images }
  }

  const vurl = photo.mainMvUrls?.[0]?.url || ''
  if (!vurl) throw new Error('未取到快手视频直链')
  const video = { url: vurl, headers: { 'User-Agent': MOBILE_UA, Referer: 'https://v.kuaishou.com/' } }
  return { platform: '快手', title, author, cover, duration, pageUrl: finalUrl, video, images: null }
}

/* ───────────── 发送 ───────────── */

// 不发视频本体时给用户一个可点链接：优先给可直接播放的视频直链（B站 html5 渐进式
// 直链实测免 Referer 可直接打开，只是有时效、约几小时后失效）；取不到直链再退回页面链接
function pickUserLink(r) {
  return r.video?.url || r.pageUrl || ''
}

function isDouyinLongVideo(r) {
  return r.platform === '抖音' && (r.duration >= DOUYIN_LONG_VIDEO_SECONDS || /(?:long-video|long_video)/i.test(r.video?.url || ''))
}

function buildHeader(r) {
  return [
    `📺 ${r.platform}解析`,
    r.title ? `\n📝 ${r.title}` : '',
    r.author ? `\n👤 ${r.author}` : '',
    r.duration ? `\n⏱️ ${fmtDur(r.duration)}` : '',
  ].join('')
}

// 从视频抽 BGM，发语音条 + mp3 文件
async function sendBgmFromVideo(e, r, videoFile) {
  const mp3 = await extractAudio(videoFile)
  if (!mp3) { await e.reply('背景音乐提取失败（可能该视频没有音轨）'); return }
  // 语音条
  try { await e.reply(segment.record(fileUri(mp3))) }
  catch (err) { logger.warn(`[短视频解析] BGM 语音发送失败：${err?.message || err}`) }
  // mp3 文件（用曲名/标题命名）
  let named = mp3
  try {
    const base = (r.bgmTitle || r.title || `${r.platform}_BGM`).replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 40) || 'BGM'
    named = path.join(TMP_DIR, `${base}.mp3`)
    if (named !== mp3) fs.copyFileSync(mp3, named)
    const target = e.isGroup ? e.group : e.friend
    const sendFile = e.isGroup ? (e.group.sendFile || e.group.fs?.upload) : e.friend.sendFile
    if (sendFile) await sendFile.call(target, path.resolve(named))
  } catch (err) {
    logger.warn(`[短视频解析] BGM 文件发送失败：${err?.message || err}`)
  } finally {
    fs.unlink(mp3, () => {})
    if (named !== mp3) fs.unlink(named, () => {})
  }
}

async function sendResult(e, r) {
  const c = cfg()
  const header = buildHeader(r)

  // 图文/图集笔记 → 标题 + 图片；其中「实况/动图」那几张单独按视频发
  if (r.images?.length || r.liveVideos?.length) {
    const imgs = (r.images || []).slice(0, 12)
    // 图集用「聊天记录」（合并转发）折叠，标题+多图收成一条，避免刷屏
    if (imgs.length) {
      const nodes = [header, ...imgs.map(u => segment.image(u))]
      try {
        const forward = await common.makeForwardMsg(e, nodes, r.title || `${r.platform}图集`)
        await e.reply(forward)
      } catch (err) {
        logger.error(`[短视频解析] 合并转发失败，改为直接发送：${err?.message || err}`)
        await e.reply(header, true)
        await e.reply(imgs.map(u => segment.image(u)))
      }
    } else {
      await e.reply(header, true)
    }
    if (r.liveVideos?.length) {
      const maxMB = Number(c.maxSize) || 100
      for (const lv of r.liveVideos) {
        let f = null
        try {
          ensureTmp()
          f = path.join(TMP_DIR, `v_${Date.now()}_${Math.floor(Math.random() * 1e6)}.mp4`)
          await downloadToFile(lv.url, lv.headers || {}, f, maxMB)
          await e.reply(segment.video(fileUri(f)))
        } catch (err) {
          logger.error(`[短视频解析] 实况/动图发送失败：${err?.message || err}`)
          await e.reply(lv.url ? `有张动图发送失败，直接甩直链👇\n🔗 ${lv.url}` : '动图发送失败')
        } finally {
          if (f) fs.unlink(f, () => {})
        }
      }
    }
    return
  }

  const cover = r.cover ? segment.image(r.cover) : null
  const maxMB = Number(c.maxSize) || 100

  // 判断是否「不发视频本体」，并给出原因
  let reason = ''
  if (!r.video) reason = '未取到视频'
  else if (c.sendVideo === false) reason = '已关闭视频发送'
  else if (r.video.url) {
    const overDur = r.duration && c.maxDuration && r.duration > Number(c.maxDuration)
    const sizeMB = r.video.size ? r.video.size / 1048576 : 0
    if (overDur) reason = '视频时长超限'
    else if (sizeMB && sizeMB > maxMB) reason = '视频体积超限'
    else if (isDouyinLongVideo(r)) reason = '检测到抖音长视频'
    else {
      const remoteSize = await probeRemoteSize(r.video.url, r.video.headers || {})
      if (remoteSize && remoteSize / 1048576 > maxMB) reason = `视频体积 ${(remoteSize / 1048576).toFixed(1)}MB 超过上限 ${maxMB}MB`
    }
  }

  // 超限/关闭/取不到本体 → 标题 + 封面 + 直链
  if (reason) {
    const link = pickUserLink(r)
    const tip = link ? `\n（${reason}，直接甩直链👇）` : `\n（${reason}）`
    await e.reply([header, tip, cover ? '\n' : '', cover, link ? `\n🔗 ${link}` : ''].filter(Boolean), true)
    return
  }

  // 标题 + 封面，再单独发视频
  await e.reply([header, cover ? '\n' : '', cover].filter(Boolean), true)

  let localFile = null
  try {
    ensureTmp()
    localFile = path.join(TMP_DIR, `v_${Date.now()}_${Math.floor(Math.random() * 1e6)}.mp4`)
    // downloadToFile 内部按 maxMB 卡 content-length，超限会抛错 → 落到 catch 甩直链
    await downloadToFile(r.video.url, r.video.headers || {}, localFile, maxMB)
    await e.reply(segment.video(fileUri(localFile)))
    // 背景音乐（默认关，锅巴可开）
    if (c.sendBgm) await sendBgmFromVideo(e, r, localFile)
  } catch (err) {
    logger.error(`[短视频解析] 发送视频失败：${err?.message || err}`)
    // 下载超限 / QQ 拒收大视频等：兜底甩直链
    const link = pickUserLink(r)
    await e.reply(link ? `视频体积过大或发送失败，直接甩直链👇\n🔗 ${link}` : `视频发送失败：${err?.message || err}`)
  } finally {
    if (localFile) fs.unlink(localFile, () => {})
  }
}

/* ───────────── 路由 ───────────── */

async function parse(platform, url) {
  if (platform === 'bili') return parseBili(url)
  if (platform === 'douyin') return parseDouyin(url)
  if (platform === 'kuaishou') return parseKuaishou(url)
  throw new Error('不支持的平台')
}

/* ───────────── 插件主体 ───────────── */

const cdMap = {}           // 解析 CD：key → 到期时间戳
const recent = new Set()   // 简单去重，避免同一条消息重复触发

export class videoParser extends plugin {
  constructor() {
    super({
      name: 'AQ：短视频解析',
      dsc: '抖音/快手/B站 链接解析',
      event: 'message',
      priority: 4000,
    })
  }

  // 被动钩子：对每条消息都会先于 rule 执行
  async accept(e) {
    if (e.post_type !== 'message') return
    const c = cfg()
    if (c.enable === false) return

    const hit = detect(collectText(e))
    if (!hit) return

    // 平台分开关
    if (c[PLATFORM_SWITCH[hit.platform]] === false) return

    // 去重（同一条消息只处理一次）
    const mid = e.message_id || `${e.user_id}:${e.raw_message}`
    if (recent.has(mid)) return
    recent.add(mid)
    setTimeout(() => recent.delete(mid), 60000)

    // CD（按群/私聊维度）
    if (c.isCD && !e.isMaster) {
      const key = e.isGroup ? `g${e.group_id}` : `u${e.user_id}`
      const now = Date.now()
      if (cdMap[key] && cdMap[key] > now) return  // 冷却中，静默跳过
      cdMap[key] = now + Math.max(1, Number(c.CD) || 10) * 1000
    }

    try {
      await e.reply(`🔍 正在解析${PLATFORM_CN[hit.platform]}链接…`, true, { recallMsg: 8 })
      const r = await parse(hit.platform, hit.url)
      await sendResult(e, r)
    } catch (err) {
      logger.error(`[短视频解析] ${hit.platform} 失败：`, err)
      await e.reply(`解析失败：${err?.message || err}`)
    }
    // 解析类消息到此为止，阻断后续插件
    return 'return'
  }
}
