import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import setting from '../utils/setting.js'
import { collectMusicText, detectMusicLink, parseMusic } from '../utils/music.js'
import { startQQMusicBrowserLogin, waitQQMusicBrowserLogin } from '../utils/qqMusicBrowserLogin.js'
import { startKugouMusicBrowserLogin, waitKugouMusicBrowserLogin } from '../utils/kugouMusicBrowserLogin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/*
 * 网易云音乐 / QQ音乐 / 酷狗音乐 / 酷我音乐解析
 * - accept 被动识别文本链接与 JSON/XML 分享卡片。
 * - 使用用户在锅巴配置的 Cookie 获取其账号有权限播放的音源。
 * - 没有音源权限时，歌曲信息与完整歌词仍照常用合并转发发送，并给出明确提示。
 */

const TMP_DIR = './data/aq/music'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
const cfg = () => setting.getConfig('music') || {}
const recent = new Set()
const cdMap = {}
const loginTasks = new Set()

function ensureTmp () {
  try { if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}
}

function safeName (s = '') {
  return String(s).replace(/[\\/:*?"<>|\r\n]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'music'
}

function fmtDur (sec) {
  sec = Number(sec) || 0
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

function fileUri (p) {
  return 'file://' + path.resolve(p)
}

async function sendLoginQr (e, text, image, prefix) {
  const buf = Buffer.isBuffer(image) ? image : Buffer.from(image)
  const base64 = `base64://${buf.toString('base64')}`
  try {
    await e.reply([text, segment.image(base64)])
    return
  } catch (err) {
    logger.warn(`[音乐解析] 扫码二维码 base64 发送失败，改用临时文件：${err?.message || err}`)
  }

  ensureTmp()
  const file = path.join(TMP_DIR, `${prefix}_${Date.now()}.png`)
  await fs.promises.writeFile(file, buf)
  await e.reply([text, segment.image(fileUri(file))])
  setTimeout(() => fs.rmSync(file, { force: true }), 10 * 60 * 1000)
}

function rewriteUrl (rawUrl, baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!base) return String(rawUrl)
  try {
    const src = new URL(String(rawUrl))
    const dst = new URL(base)
    dst.pathname = src.pathname
    dst.search = src.search
    dst.hash = src.hash
    return dst.toString()
  } catch { return String(rawUrl) }
}

async function validCover (url, headers = {}) {
  if (!url) return ''
  const requestHeaders = { 'User-Agent': UA, ...headers }
  try {
    const res = await fetch(url, { method: 'HEAD', headers: requestHeaders, redirect: 'follow', signal: AbortSignal.timeout(8000) })
    if (res.ok && /^image\//i.test(res.headers.get('content-type') || '')) return url
  } catch {}
  // 部分 CDN 不支持 HEAD，补一次小型 GET 验证；只读响应头后立即取消正文。
  try {
    const res = await fetch(url, { headers: { ...requestHeaders, Range: 'bytes=0-31' }, redirect: 'follow', signal: AbortSignal.timeout(8000) })
    const ok = res.ok && /^image\//i.test(res.headers.get('content-type') || '')
    try { await res.body?.cancel() } catch {}
    if (ok) return url
  } catch {}
  return ''
}

async function sendSongInfo (e, r, c) {
  const info = [
    `🎶 ${r.title}`,
    `歌手：${r.artists}`,
    r.album ? `专辑：${r.album}` : '',
    r.duration ? `时长：${fmtDur(r.duration)}` : '',
    `平台：${r.platform}`
  ].filter(Boolean).join('\n')
  const cover = c.sendCover !== false ? await validCover(r.cover) : ''
  // 封面 404/防盗链时只发文字，绝不能让封面失败阻断歌词和音频。
  try {
    await e.reply([info, cover ? '\n' : '', cover ? segment.image(cover) : ''].filter(Boolean), true)
  } catch (err) {
    logger.warn(`[音乐解析] 封面发送失败，降级文字：${err?.message || err}`)
    await e.reply(info, true)
  }
}

async function downloadToFile (url, headers, dest, maxMB) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`音频下载失败 HTTP ${res.status}`)
  const max = Math.max(1, Number(maxMB) || 30) * 1048576
  const len = Number(res.headers.get('content-length') || 0)
  if (len && len > max) throw new Error(`音频体积 ${(len / 1048576).toFixed(1)}MB 超过上限 ${maxMB}MB`)
  let got = 0
  const guard = new Transform({
    transform (chunk, _enc, cb) {
      got += chunk.length
      if (got > max) return cb(new Error(`音频体积超过上限 ${maxMB}MB`))
      cb(null, chunk)
    }
  })
  try {
    await pipeline(Readable.fromWeb(res.body), guard, fs.createWriteStream(dest))
  } catch (err) {
    fs.rmSync(dest, { force: true })
    throw err
  }
  return dest
}

function probeDuration (file) {
  return new Promise(resolve => {
    execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], {
      timeout: 30000,
      maxBuffer: 1024 * 1024
    }, (err, stdout) => resolve(err ? 0 : Number(String(stdout).trim()) || 0))
  })
}

function toMp3 (src, dest) {
  return new Promise(resolve => {
    execFile('ffmpeg', ['-y', '-i', src, '-vn', '-codec:a', 'libmp3lame', '-q:a', '2', dest], {
      timeout: 180000,
      maxBuffer: 16 * 1024 * 1024
    }, err => resolve(!err))
  })
}

function lyricNodes (r) {
  const nodes = [`🎵 ${r.title}\n歌手：${r.artists}\n平台：${r.platform}${r.album ? `\n专辑：${r.album}` : ''}`]
  const add = (title, text) => {
    const value = String(text || '').trim()
    if (!value) return
    // 不限制歌词行数；仅按单条消息安全长度拆成多个聊天记录节点，内容一行不丢。
    const lines = value.split(/\r?\n/)
    let chunk = `${title}\n`
    for (const line of lines) {
      if ((chunk + line).length > 3500) {
        nodes.push(chunk.trimEnd())
        chunk = `${title}（续）\n`
      }
      chunk += line + '\n'
    }
    if (chunk.trim()) nodes.push(chunk.trimEnd())
  }
  add('📜 歌词', r.lyric)
  add('🌐 翻译歌词', r.translation)
  if (nodes.length === 1) nodes.push('该歌曲暂未获取到歌词。')
  return nodes
}

async function sendLyrics (e, r) {
  try {
    const forward = await common.makeForwardMsg(e, lyricNodes(r), `${r.title} - 歌词`)
    await e.reply(forward)
  } catch (err) {
    logger.warn(`[音乐解析] 合并转发歌词失败：${err?.message || err}`)
    await e.reply('歌词聊天记录生成失败，请稍后重试。')
  }
}

async function makeFileLink (filePath, filename, c) {
  if (typeof Bot?.fileToUrl !== 'function') return ''
  const buf = await fs.promises.readFile(filePath)
  const expire = Math.max(1, Math.min(1440, Number(c.linkExpireMin) || 60))
  const viewsRaw = Number(c.linkMaxViews)
  const views = Number.isFinite(viewsRaw) && viewsRaw > 0 ? Math.min(1000, Math.floor(viewsRaw)) : false
  const raw = await Bot.fileToUrl({ name: filename, buffer: buf }, { time: expire * 60000, times: views || false })
  return rewriteUrl(raw, c.filePublicBaseUrl)
}

async function sendAudio (e, r) {
  const c = cfg()
  if (c.sendMp3 === false) return
  if (!r.audioUrl) {
    await e.reply(`⚠️ 未获取到音频：${r.noAudioReason || '当前账号没有该歌曲的播放权限'}。\n歌曲信息与歌词已正常返回；请检查对应平台 Cookie 是否有效，以及该账号是否拥有播放权限。`)
    return
  }

  ensureTmp()
  const token = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  const original = path.join(TMP_DIR, `music_${token}.${r.audioType || 'mp3'}`)
  let mp3 = original
  let named = null
  try {
    await downloadToFile(r.audioUrl, r.audioHeaders || {}, original, Number(c.maxSize) || 30)
    const actualDuration = await probeDuration(original)
    if (r.duration > 30 && actualDuration && actualDuration < r.duration * 0.65) {
      throw new Error(`平台只返回了约 ${fmtDur(actualDuration)} 的试听片段，当前账号没有完整音源权限`)
    }
    if ((r.audioType || '').toLowerCase() !== 'mp3') {
      mp3 = path.join(TMP_DIR, `music_${token}.mp3`)
      if (!await toMp3(original, mp3)) throw new Error('音频转 MP3 失败，请确认服务器已安装 ffmpeg')
    }

    const filename = `${safeName(`${r.title} - ${r.artists}`)}.mp3`
    named = path.join(TMP_DIR, filename)
    if (named !== mp3) fs.copyFileSync(mp3, named)
    const sizeMB = fs.statSync(named).size / 1048576
    const mode = String(c.sendMode || 'auto').toLowerCase()
    const limit = Math.max(1, Number(c.uploadLimitMB) || 25)
    const useLink = mode === 'link' || (mode === 'auto' && sizeMB > limit)
    const target = e.isGroup ? e.group : e.friend
    const sendFile = e.isGroup ? (e.group.sendFile || e.group.fs?.upload) : e.friend.sendFile

    if (useLink) {
      const link = await makeFileLink(named, filename, c)
      if (!link) throw new Error('无法生成音频临时链接')
      await e.reply(`🎧 音频已生成（${sizeMB.toFixed(1)}MB）：\n${link}`)
    } else if (sendFile) {
      try {
        await sendFile.call(target, path.resolve(named))
      } catch (err) {
        const link = await makeFileLink(named, filename, c)
        if (!link) throw err
        await e.reply(`音频上传超时/失败，已改发临时下载链接：\n${link}`)
      }
    } else {
      const link = await makeFileLink(named, filename, c)
      if (!link) throw new Error('当前适配器不支持发送文件')
      await e.reply(`当前适配器不支持上传音频，已改发临时下载链接：\n${link}`)
    }
  } finally {
    fs.rmSync(original, { force: true })
    if (mp3 !== original) fs.rmSync(mp3, { force: true })
    if (named && named !== mp3 && named !== original) fs.rmSync(named, { force: true })
  }
}

export class musicParse extends plugin {
  constructor () {
    super({
      name: 'AQ：音乐解析',
      dsc: '网易云/QQ/酷狗/酷我音乐链接与卡片解析',
      event: 'message',
      priority: 8500,
      rule: [
        {
          reg: '^#?(QQ|qq)音乐(扫码登录|登录)$',
          fnc: 'qqLogin',
          permission: 'master'
        },
        {
          reg: '^#?(QQ|qq)音乐(退出登录|注销)$',
          fnc: 'qqLogout',
          permission: 'master'
        },
        {
          reg: '^#?酷狗音乐(扫码登录|登录)$',
          fnc: 'kugouLogin',
          permission: 'master'
        },
        {
          reg: '^#?酷狗音乐(退出登录|注销)$',
          fnc: 'kugouLogout',
          permission: 'master'
        }
      ]
    })
  }

  async qqLogin (e) {
    if (loginTasks.has('qq')) {
      await e.reply('QQ音乐扫码登录正在进行中，请先完成当前扫码或等待二维码过期。')
      return true
    }
    loginTasks.add('qq')
    try {
      const { page, image } = await startQQMusicBrowserLogin(puppeteer)
      await sendLoginQr(e, '请在约两分钟内使用手机 QQ 扫码并确认登录：\n', image, 'qq_login_qr')
      const result = await waitQQMusicBrowserLogin(page, 120000, () => e.reply('二维码已扫描，请在手机 QQ 中点击确认登录。'))
      if (result.status === 'success') {
        const c = cfg()
        c.qqCookie = result.cookie
        setting.setConfig('music', c)
        await e.reply('✅ QQ音乐登录成功，Cookie 已自动保存。')
      } else {
        await e.reply(`QQ音乐登录失败：${result.msg || '未知错误'}。请重新发送「#QQ音乐扫码登录」。`)
      }
    } catch (err) {
      logger.error('[音乐解析] QQ音乐扫码登录失败', err)
      await e.reply(`QQ音乐扫码登录失败：${err?.message || err}`)
    } finally {
      loginTasks.delete('qq')
    }
    return true
  }

  async qqLogout (e) {
    const c = cfg()
    c.qqCookie = ''
    setting.setConfig('music', c)
    await e.reply('QQ音乐登录信息已清除。')
    return true
  }

  async kugouLogin (e) {
    if (loginTasks.has('kugou')) {
      await e.reply('酷狗音乐扫码登录正在进行中，请先完成当前扫码或等待二维码过期。')
      return true
    }
    loginTasks.add('kugou')
    try {
      const { page, image } = await startKugouMusicBrowserLogin(puppeteer)
      await sendLoginQr(e, '请在约两分钟内使用酷狗音乐 App 扫码并确认登录：\n', image, 'kugou_login_qr')
      const result = await waitKugouMusicBrowserLogin(page, 120000)
      if (result.status === 'success') {
        const c = cfg()
        c.kugouCookie = result.cookie
        c.kugouUserId = result.userId
        c.kugouToken = result.token
        setting.setConfig('music', c)
        await e.reply(`✅ 酷狗音乐登录成功${result.nickname ? `：${result.nickname}` : ''}，登录信息已自动保存。`)
      } else {
        await e.reply(`酷狗音乐登录失败：${result.msg || '未知错误'}。请重新发送「#酷狗音乐扫码登录」。`)
      }
    } catch (err) {
      logger.error('[音乐解析] 酷狗音乐扫码登录失败', err)
      await e.reply(`酷狗音乐扫码登录失败：${err?.message || err}`)
    } finally {
      loginTasks.delete('kugou')
    }
    return true
  }

  async kugouLogout (e) {
    const c = cfg()
    c.kugouCookie = ''
    c.kugouUserId = ''
    c.kugouToken = ''
    setting.setConfig('music', c)
    await e.reply('酷狗音乐登录信息已清除。')
    return true
  }

  async accept (e) {
    if (e.post_type !== 'message') return
    const c = cfg()
    if (c.enable === false) return
    const hit = detectMusicLink(collectMusicText(e))
    if (!hit) return
    if (hit.platform === 'netease' && c.parseNetease === false) return
    if (hit.platform === 'qq' && c.parseQQ === false) return
    if (hit.platform === 'kugou' && c.parseKugou === false) return
    if (hit.platform === 'kuwo' && c.parseKuwo === false) return

    const mid = e.message_id || `${e.user_id}:${e.raw_message}`
    if (recent.has(mid)) return
    recent.add(mid)
    setTimeout(() => recent.delete(mid), 60000)

    if (c.isCD && !e.isMaster) {
      const key = e.isGroup ? `g${e.group_id}` : `u${e.user_id}`
      const now = Date.now()
      if (cdMap[key] && cdMap[key] > now) return
      cdMap[key] = now + Math.max(1, Number(c.CD) || 10) * 1000
    }

    try {
      const platformName = { netease: '网易云音乐', qq: 'QQ音乐', kugou: '酷狗音乐', kuwo: '酷我音乐' }[hit.platform] || '音乐'
      await e.reply(`🎵 正在解析${platformName}…`, true, { recallMsg: 8 })
      const r = await parseMusic(hit, c)
      await sendSongInfo(e, r, c)
      if (c.sendLyrics !== false) await sendLyrics(e, r)
      await sendAudio(e, r)
    } catch (err) {
      logger.error('[音乐解析]', err)
      await e.reply(`音乐解析失败：${err?.message || err}`)
    }
    return 'return'
  }
}
