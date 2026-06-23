import plugin from '../../../lib/plugins/plugin.js'
import setting from '../utils/setting.js'
import common from '../../../lib/common/common.js'
import fs from 'node:fs'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/*
 * 图文解析（小红书 / 小黑盒）
 * - 被动触发：accept(e) 钩子扫每条消息，识别到分享链接就解析，无需指令（兼容 JSON 卡片分享）。
 * - 图文/多图笔记 → 用「聊天记录」（合并转发）折叠卡片发送，标题+作者+正文+多图一条收纳。
 * - 视频笔记 → 标题 + 封面 + 视频本体（沿用体积/时长上限与直链兜底）。
 * - 小红书公开笔记一般免 cookie（链接里带 xsec_token 即可）；登录态内容可在配置填 cookie。
 * - 配置存 config/config/tw.yaml，支持锅巴/手动修改、热生效。
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const TMP_DIR = './data/aq/tw'

const cfg = () => setting.getConfig('tw') || {}

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

// 本机文件统一用 file:// 交给适配器，NapCat 直接从磁盘读，避免把大文件 base64 进内存
const fileUri = (p) => 'file://' + path.resolve(p)

// 把一条消息里所有可能含链接的文本汇总（纯文本 + JSON/XML 卡片分享）
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
  return parts.join('\n').replace(/\\\//g, '/').replace(/&amp;/g, '&')
}

// 识别平台与链接，返回 { platform, url } 或 null
function detect(text) {
  let m
  // —— 小红书 ——（短链 xhslink.com / 笔记页 explore|discovery；务必保留 xsec_token 查询串）
  if ((m = text.match(/https?:\/\/xhslink\.com\/[A-Za-z0-9/_-]+/i))) return { platform: 'xhs', url: m[0] }
  if ((m = text.match(/https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item)\/[0-9a-fA-F]+[^\s'"<>]*/i))) return { platform: 'xhs', url: m[0] }
  // —— 小黑盒 ——（分享接口 / 站内链接 / 短链，link_id 在 parseHeybox 里再提取）
  if ((m = text.match(/https?:\/\/(?:[a-z0-9-]+\.)?(?:xiaoheihe\.cn|heybox\.cn)\/[^\s'"<>]+/i))) return { platform: 'heybox', url: m[0] }
  return null
}

const PLATFORM_CN = { xhs: '小红书', heybox: '小黑盒' }
const PLATFORM_SWITCH = { xhs: 'xhsEnable', heybox: 'heyboxEnable' }

// 流式下载到本地文件，按 maxMB 边下边数字节，一超限立刻中止并清掉半截文件
async function downloadToFile(url, headers, dest, maxMB) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`下载失败 HTTP ${res.status}`)
  const limit = maxMB ? maxMB * 1048576 : 0
  const len = Number(res.headers.get('content-length') || 0)
  if (limit && len && len > limit) {
    try { await res.body.cancel() } catch {}
    throw new Error(`体积 ${(len / 1048576).toFixed(1)}MB 超过上限 ${maxMB}MB`)
  }
  let got = 0
  const guard = new Transform({
    transform(chunk, _enc, cb) {
      got += chunk.length
      if (limit && got > limit) return cb(new Error(`体积超过上限 ${maxMB}MB`))
      cb(null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(res.body), guard, fs.createWriteStream(dest))
  } catch (err) {
    fs.unlink(dest, () => {})
    throw err
  }
  return dest
}

/* ───────────── 小红书：笔记页 __INITIAL_STATE__ 自解析 ───────────── */

// 从 imageList[i].stream / video.media.stream 里挑一条可播放直链（按编码优先级）
function pickStreamUrl(stream) {
  if (!stream || typeof stream !== 'object') return ''
  for (const k of ['h264', 'h265', 'h266', 'av1']) {
    const arr = stream[k]
    if (Array.isArray(arr) && arr[0]) return arr[0].masterUrl || arr[0].backupUrls?.[0] || ''
  }
  for (const k of Object.keys(stream)) {
    const a = stream[k]
    if (Array.isArray(a) && a[0]?.masterUrl) return a[0].masterUrl
  }
  return ''
}

async function parseXhs(rawUrl) {
  const c = cfg()
  const headers = { 'User-Agent': UA, Referer: 'https://www.xiaohongshu.com/' }
  if (c.xhsCookie) headers.Cookie = c.xhsCookie

  // 短链先还原成带 xsec_token 的笔记页
  let url = rawUrl
  if (/xhslink\.com/i.test(url)) {
    try { url = (await fetch(url, { headers, redirect: 'follow' })).url } catch {}
  }

  const html = await (await fetch(url, { headers, redirect: 'follow' })).text()
  const start = html.indexOf('window.__INITIAL_STATE__=')
  if (start < 0) throw new Error('小红书页面结构变化或需要登录（可在配置填 cookie）')
  let raw = html.slice(start + 'window.__INITIAL_STATE__='.length)
  raw = raw.slice(0, raw.indexOf('</script>')).trim()
  // 小红书用 undefined 字面量，JSON.parse 不认，统一替换成 null
  raw = raw.replace(/:\s*undefined\b/g, ':null').replace(/\bundefined\b/g, 'null')
  let data
  try { data = JSON.parse(raw) } catch { throw new Error('小红书页面数据解析失败') }

  const map = data?.note?.noteDetailMap || {}
  const id = Object.keys(map).find(k => map[k]?.note)
  const note = id ? map[id].note : null
  if (!note) throw new Error('小红书笔记获取失败（可能已删除、私密，或 xsec_token 失效，重新复制分享链接）')

  const title = note.title || ''
  const desc = note.desc || ''
  const author = note.user?.nickname || ''
  const imageList = Array.isArray(note.imageList) ? note.imageList : []
  const cover = imageList[0]?.urlDefault || ''
  const pageUrl = `https://www.xiaohongshu.com/discovery/item/${id}`

  // 视频笔记
  if (note.type === 'video' && note.video) {
    const vurl = pickStreamUrl(note.video?.media?.stream)
    const duration = Math.round(note.video?.capa?.duration || 0)
    const video = vurl ? { url: vurl, headers: { 'User-Agent': UA, Referer: 'https://www.xiaohongshu.com/' } } : null
    return { platform: '小红书', type: 'video', title, desc, author, cover, duration, pageUrl, video, images: null, liveVideos: [] }
  }

  // 图文/多图笔记：逐张取图；带 livePhoto 的额外取实况小视频
  const images = []
  const liveVideos = []
  for (const im of imageList) {
    const u = im?.urlDefault || im?.url || ''
    if (u) images.push(u)
    if (im?.livePhoto) {
      const lv = pickStreamUrl(im?.stream)
      if (lv) liveVideos.push({ url: lv, headers: { 'User-Agent': UA, Referer: 'https://www.xiaohongshu.com/' } })
    }
  }
  return { platform: '小红书', type: 'normal', title, desc, author, cover, duration: 0, pageUrl, video: null, images, liveVideos }
}

/* ───────────── 小黑盒：app 接口 hkey 签名 + link/tree 自解析 ───────────── */

// 以下 hkey 签名为小黑盒 web 端算法的等价移植（URL 路径 + 时间 + nonce 经自定义字节变换后 MD5）
import crypto from 'node:crypto'
const _md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex')
const _Vm = (e) => (128 & e ? 255 & ((e << 1) ^ 27) : e << 1)
const _qm = (e) => _Vm(e) ^ e
const _$m = (e) => _qm(_Vm(e))
const _Ym = (e) => _$m(_qm(_Vm(e)))
const _Gm = (e) => _Ym(e) ^ _$m(e) ^ _qm(e)
function _Km(e) {
  const t = [0, 0, 0, 0]
  t[0] = _Gm(e[0]) ^ _Ym(e[1]) ^ _$m(e[2]) ^ _qm(e[3])
  t[1] = _qm(e[0]) ^ _Gm(e[1]) ^ _Ym(e[2]) ^ _$m(e[3])
  t[2] = _$m(e[0]) ^ _qm(e[1]) ^ _Gm(e[2]) ^ _Ym(e[3])
  t[3] = _Ym(e[0]) ^ _$m(e[1]) ^ _qm(e[2]) ^ _Gm(e[3])
  for (let k = 0; k < 4; k++) e[k] = t[k]
  return e
}
const _sv = (e, t) => { let n = ''; for (let r = 0; r < e.length; r++) n += t[e.charCodeAt(r) % t.length]; return n }
const _av = (e, t, n) => { let r = ''; const i = t.slice(0, n); for (let o = 0; o < e.length; o++) r += i[e.charCodeAt(o) % i.length]; return r }
function _ov(e, t, n) {
  e = '/' + e.split('/').filter(x => x).join('/') + '/'
  const r = 'AB45STUVWZEFGJ6CH01D237IXYPQRKLMN89'
  const cols = [_av(String(t), r, -2), _sv(e, r), _sv(n, r)]
  let i = ''
  const mx = Math.max(...cols.map(c => c.length))
  for (let c = 0; c < mx; c++) for (const col of cols) if (c < col.length) i += col[c]
  i = i.slice(0, 20)
  const o = _md5(i)
  let sum = _Km(o.slice(-6).split('').map(c => c.charCodeAt(0))).reduce((a, b) => a + b, 0) % 100
  let a = String(sum); if (a.length < 2) a = '0' + a
  return _av(o.substring(0, 5), r, -4) + a
}
// 为某个接口路径生成 { hkey, _time, nonce }
function heyboxSign(pathname) {
  const t = Math.floor(Date.now() / 1000)
  const nonce = _md5(`${t}${Math.random()}`).toUpperCase()
  return { hkey: _ov(pathname, t + 1, nonce), _time: t, nonce }
}

// 从分享接口的 302 跳转里取预览信息（标题/简介/封面），并拿到 link_id
async function heyboxShareInfo(rawUrl) {
  const headers = { 'User-Agent': UA }
  // link_id 可能直接在 url 里；否则跟随跳转后再取
  let linkId = (rawUrl.match(/link_id=([0-9a-fA-F]+)/) || rawUrl.match(/\/link\/([0-9a-fA-F]+)/) || rawUrl.match(/\/(?:bbs\/)?link\/(\d+)/))?.[1] || ''
  let info = {}
  try {
    const u = linkId
      ? `https://api.xiaoheihe.cn/v3/bbs/app/api/web/share?link_id=${linkId}&h_src=YXBwX3NoYXJl`
      : rawUrl
    const r = await fetch(u, { headers, redirect: 'manual' })
    const loc = r.headers.get('location') || ''
    if (!linkId) linkId = (loc.match(/link_id=([0-9a-fA-F]+)/) || loc.match(/\/link\/([0-9a-fA-F]+)/))?.[1] || ''
    const md = loc.match(/redirect_data=([^&]+)/)
    if (md) { try { info = JSON.parse(decodeURIComponent(md[1]))?.link || {} } catch {} }
  } catch {}
  return { linkId, info }
}

async function heyboxTree(linkId, cookie) {
  const pathname = '/bbs/app/link/tree/v2'
  const sg = heyboxSign(pathname)
  const params = new URLSearchParams({
    link_id: linkId, x_client_type: 'web', os_type: 'web', x_os_type: 'Mac', client_type: 'web',
    x_app: 'heybox_website', web_version: '2.5', heybox_id: '-1', version: '999.0.4', app: 'heybox', ...sg,
  })
  const headers = { 'User-Agent': UA, Referer: 'https://www.xiaoheihe.cn/' }
  if (cookie) headers.Cookie = cookie
  const r = await fetch(`https://api.xiaoheihe.cn${pathname}?${params}`, { headers })
  return r.json()
}

async function parseHeybox(rawUrl) {
  const c = cfg()
  const { linkId, info } = await heyboxShareInfo(rawUrl)
  if (!linkId) throw new Error('未取到小黑盒作品 ID')

  const j = await heyboxTree(linkId, c.heyboxCookie || '')
  if (j?.status !== 'ok' || !j?.result?.link?.body) {
    // 风控/验证码等导致正文拉取失败：退回「分享预览」卡片（标题+简介+封面+链接，该接口免签名、不受风控影响），至少不空手而归
    if (info.title || info.thumb) {
      const tip = j?.status === 'show_captcha' ? '\n（小黑盒风控验证，仅取到预览；想要全文多图可在配置填登录 cookie）' : ''
      return {
        platform: '小黑盒', type: 'card', title: info.title || '', author: '',
        desc: (info.description || '') + tip, cover: info.thumb || '',
        pageUrl: `https://www.xiaoheihe.cn/community/${linkId}`, images: [], liveVideos: [], video: null,
      }
    }
    if (j?.status === 'show_captcha') throw new Error('小黑盒触发了验证码（可在配置填登录 cookie 后重试）')
    throw new Error('小黑盒作品获取失败（可能已删除、私密，或接口风控）')
  }
  const body = j.result.link.body
  const author = body.user?.username || ''
  const title = body.title || info.title || ''
  const pageUrl = `https://www.xiaoheihe.cn/community/${linkId}`
  const stripCube = (s) => String(s || '').replace(/\[cube_[^\]]+\]/g, '')

  // body.text 可能是「内容块数组的 JSON 字符串」（图文帖），也可能是纯文本（视频帖等）
  let blocks = null
  try { const p = JSON.parse(body.text); if (Array.isArray(p)) blocks = p } catch {}

  if (blocks) {
    const texts = []
    const images = []
    for (const b of blocks) {
      if (b?.type === 'text' && b.text) texts.push(stripCube(b.text))
      else if (b?.type === 'img' && b.url) images.push(b.url)
    }
    const desc = texts.join('\n').trim()
    const cover = images[0] || info.thumb || ''
    return {
      platform: '小黑盒', type: images.length ? 'normal' : 'card',
      title, author, desc, cover, pageUrl, images, liveVideos: [], video: null,
    }
  }

  // 纯文本（含视频帖）：小黑盒视频本体走风控接口，免登录拿不到，发标题+正文+封面+链接卡片
  return {
    platform: '小黑盒', type: 'card',
    title, author, desc: stripCube(body.text || info.description || ''),
    cover: info.thumb || '', pageUrl, images: [], liveVideos: [], video: null,
  }
}

/* ───────────── 路由 ───────────── */

async function parse(platform, url) {
  if (platform === 'xhs') return parseXhs(url)
  if (platform === 'heybox') return parseHeybox(url)
  throw new Error('暂不支持的平台')
}

/* ───────────── 发送 ───────────── */

// 下载并发送单条视频，超限/失败兜底甩直链
async function sendOneVideo(e, item, maxMB, label = '视频') {
  let f = null
  try {
    ensureTmp()
    f = path.join(TMP_DIR, `v_${Date.now()}_${Math.floor(Math.random() * 1e6)}.mp4`)
    await downloadToFile(item.url, item.headers || {}, f, maxMB)
    await e.reply(segment.video(fileUri(f)))
  } catch (err) {
    logger.error(`[图文解析] ${label}发送失败：${err?.message || err}`)
    await e.reply(item.url ? `${label}发送失败，直接甩直链👇\n🔗 ${item.url}` : `${label}发送失败`)
  } finally {
    if (f) fs.unlink(f, () => {})
  }
}

async function sendResult(e, r) {
  const c = cfg()
  const maxMB = Number(c.maxSize) || 100
  const maxImg = Number(c.maxImg) || 18
  const header = [
    `📕 ${r.platform}`,
    r.title ? `\n📝 ${r.title}` : '',
    r.author ? `\n👤 ${r.author}` : '',
    r.duration ? `\n⏱️ ${fmtDur(r.duration)}` : '',
  ].join('')

  // 视频笔记 → 标题 + 封面 + 视频本体
  if (r.type === 'video') {
    const cover = r.cover ? segment.image(r.cover) : null
    if (!r.video || c.sendVideo === false) {
      const link = r.video?.url || r.pageUrl || ''
      await e.reply([header, c.sendVideo === false ? '\n（已关闭视频发送）' : '\n（未取到视频）', cover ? '\n' : '', cover, link ? `\n🔗 ${link}` : ''].filter(Boolean), true)
      return
    }
    const overDur = r.duration && c.maxDuration && r.duration > Number(c.maxDuration)
    if (overDur) {
      await e.reply([header, '\n（视频时长超限，直接甩直链👇）', cover ? '\n' : '', cover, `\n🔗 ${r.video.url || r.pageUrl}`].filter(Boolean), true)
      return
    }
    await e.reply([header, cover ? '\n' : '', cover].filter(Boolean), true)
    await sendOneVideo(e, r.video, maxMB, '视频')
    return
  }

  // 卡片：标题 + 正文 + 封面 + 原链接（小黑盒视频/纯文本帖，拿不到媒体本体时）
  if (r.type === 'card') {
    const cover = r.cover ? segment.image(r.cover) : null
    const desc = r.desc ? `\n\n${r.desc.slice(0, 300)}` : ''
    await e.reply([header, desc, cover ? '\n' : '', cover, r.pageUrl ? `\n🔗 ${r.pageUrl}` : ''].filter(Boolean), true)
    return
  }

  // 图文/多图笔记 → 聊天记录（合并转发）折叠：标题+作者+正文 一条，多图随后
  const nodes = []
  let head = header
  if (r.desc) head += `\n\n${r.desc}`
  nodes.push(head)
  const imgs = (r.images || []).slice(0, maxImg)
  for (const u of imgs) nodes.push(segment.image(u))
  try {
    const forward = await common.makeForwardMsg(e, nodes, r.title || `${r.platform}图文`)
    await e.reply(forward)
  } catch (err) {
    logger.error(`[图文解析] 合并转发失败，改为直接发送：${err?.message || err}`)
    await e.reply(head, true)
    if (imgs.length) await e.reply(imgs.map(u => segment.image(u)))
  }

  // 实况/动图：在图文之后单独按视频发
  if (r.liveVideos?.length) {
    for (const lv of r.liveVideos) await sendOneVideo(e, lv, maxMB, '动图')
  }
}

/* ───────────── 插件主体 ───────────── */

const cdMap = {}
const recent = new Set()

export class twParser extends plugin {
  constructor() {
    super({
      name: 'AQ：图文解析',
      dsc: '小红书/小黑盒 链接解析',
      event: 'message',
      priority: 4000,
    })
  }

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
      if (cdMap[key] && cdMap[key] > now) return
      cdMap[key] = now + Math.max(1, Number(c.CD) || 10) * 1000
    }

    try {
      await e.reply(`🔍 正在解析${PLATFORM_CN[hit.platform]}链接…`, true, { recallMsg: 8 })
      const r = await parse(hit.platform, hit.url)
      await sendResult(e, r)
    } catch (err) {
      logger.error(`[图文解析] ${hit.platform} 失败：`, err)
      await e.reply(`解析失败：${err?.message || err}`)
    }
    return 'return'
  }
}
