/* ─────────────────────────────────────────────────────────────
 * 网易云音乐 / QQ音乐轻量解析
 * - 只使用用户自己配置的 Cookie 登录态，不接第三方解析接口。
 * - Cookie 对应账号有播放权限且平台返回直链时下载音频；没权限仍返回歌曲信息与歌词。
 * ───────────────────────────────────────────────────────────── */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
const QQ_REFERER = 'https://y.qq.com/'
const NE_REFERER = 'https://music.163.com/'
const KG_REFERER = 'https://www.kugou.com/'
const KW_REFERER = 'https://www.kuwo.cn/'

const htmlDecode = (s = '') => String(s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")

export function collectMusicText (e) {
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
  return htmlDecode(parts.join('\n').replace(/\\\//g, '/').replace(/\\u0026/gi, '&'))
}

export function detectMusicLink (text = '') {
  const s = String(text)
  let m

  // 网易云：标准/移动端歌曲页、song?id=、短链 163cn.tv（短链需跟随跳转后再识别）
  if ((m = s.match(/https?:\/\/(?:y\.)?music\.163\.com\/(?:#\/)?(?:m\/)?song\?(?:[^\s"'<>]*&)?id=(\d+)[^\s"'<>]*/i))) {
    return { platform: 'netease', id: m[1], url: m[0] }
  }
  if ((m = s.match(/https?:\/\/163cn\.tv\/[A-Za-z0-9_-]+/i))) return { platform: 'netease', id: '', url: m[0] }

  // QQ音乐：songDetail/songmid/playsong 页面；卡片 JSON 里也通常包含 songmid
  if ((m = s.match(/https?:\/\/(?:y\.qq\.com|i\.y\.qq\.com|i2\.y\.qq\.com|c6\.y\.qq\.com)\/[^\s"'<>]*(?:songDetail\/|songmid=)([A-Za-z0-9]{8,})[^\s"'<>]*/i))) {
    return { platform: 'qq', id: m[1], url: m[0] }
  }
  if ((m = s.match(/https?:\/\/(?:c6\.y\.qq\.com|y\.qq\.com)\/(?:base\/fcgi-bin\/u|n\/ryqq\/songDetail)[^\s"'<>]*/i))) {
    const mid = (m[0].match(/songDetail\/([A-Za-z0-9]{8,})|songmid=([A-Za-z0-9]{8,})/i) || []).slice(1).find(Boolean) || ''
    return { platform: 'qq', id: mid, url: m[0] }
  }
  if (/qq\.com|QQ音乐|qqmusic/i.test(s) && (m = s.match(/["'=:\/]songmid["'=:\s%]*([A-Za-z0-9]{8,})/i))) {
    return { platform: 'qq', id: m[1], url: '' }
  }

  // 酷狗：网页 hash、卡片中的 hash/fileHash；短链接先保留 URL，解析时跟跳转/读页面
  if ((m = s.match(/https?:\/\/(?:www\.|m\.)?kugou\.com\/[^\s"'<>]*/i))) {
    const hash = (m[0].match(/(?:hash|fileHash)=([A-Fa-f0-9]{32})/i) || [])[1] || ''
    return { platform: 'kugou', id: hash.toUpperCase(), url: m[0] }
  }
  if (/kugou|酷狗/i.test(s) && (m = s.match(/["'=:\/]?(?:hash|fileHash)["'=:\s%]*([A-Fa-f0-9]{32})/i))) {
    return { platform: 'kugou', id: m[1].toUpperCase(), url: '' }
  }

  // 酷我：play_detail/MUSIC_xxx/musicId/source，卡片一般直接带数字 rid
  if ((m = s.match(/https?:\/\/(?:www\.|m\.)?kuwo\.cn\/[^\s"'<>]*(?:play_detail\/|musicId=|source=|rid=MUSIC_?)(\d+)[^\s"'<>]*/i))) {
    return { platform: 'kuwo', id: m[1], url: m[0] }
  }
  if (/kuwo|酷我/i.test(s) && (m = s.match(/(?:musicId|source|rid)["'=:\s%]*(?:MUSIC_)?(\d+)/i))) {
    return { platform: 'kuwo', id: m[1], url: '' }
  }
  return null
}

async function fetchText (url, { cookie = '', referer = '', timeout = 20000 } = {}) {
  const headers = { 'User-Agent': UA, Referer: referer }
  if (cookie) headers.Cookie = cookie
  const res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(timeout) })
  if (!res.ok) throw new Error(`平台页面 HTTP ${res.status}`)
  return { text: await res.text(), url: res.url, headers: res.headers }
}

async function fetchJson (url, { cookie = '', referer = '', timeout = 20000, method = 'GET', body } = {}) {
  const headers = { 'User-Agent': UA, Referer: referer }
  if (cookie) headers.Cookie = cookie
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout)
  })
  if (!res.ok) throw new Error(`平台接口 HTTP ${res.status}`)
  return res.json()
}

async function resolveNeteaseId (hit, timeout) {
  if (hit.id) return hit.id
  const res = await fetch(hit.url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(timeout) })
  const final = res.url || ''
  const id = (final.match(/(?:song\?(?:[^#]*&)?id=|\/song\/)(\d+)/i) || [])[1]
  if (!id) throw new Error('未从网易云短链识别到歌曲 ID')
  return id
}

async function parseNetease (hit, cfg) {
  const cookie = String(cfg.neteaseCookie || '').trim()
  const timeout = Math.max(5, Number(cfg.timeout) || 20) * 1000
  const id = await resolveNeteaseId(hit, timeout)
  const q = encodeURIComponent(`[${id}]`)
  const [detail, lyric, player] = await Promise.all([
    fetchJson(`https://music.163.com/api/song/detail/?ids=${q}`, { cookie, referer: NE_REFERER, timeout }),
    fetchJson(`https://music.163.com/api/song/lyric?id=${id}&lv=1&kv=1&tv=-1`, { cookie, referer: NE_REFERER, timeout }).catch(() => ({})),
    fetchJson(`https://music.163.com/api/song/enhance/player/url/v1?ids=${q}&level=exhigh&encodeType=mp3`, { cookie, referer: NE_REFERER, timeout }).catch(() => ({}))
  ])
  const song = detail?.songs?.[0]
  if (!song) throw new Error('网易云未返回歌曲信息，链接可能无效')
  const audio = player?.data?.[0] || {}
  return {
    platform: '网易云音乐',
    platformKey: 'netease',
    id,
    title: song.name || `歌曲${id}`,
    artists: (song.artists || []).map(v => v.name).filter(Boolean).join(' / ') || '未知歌手',
    album: song.album?.name || '',
    cover: song.album?.picUrl || song.artists?.[0]?.picUrl || '',
    duration: Math.round((song.duration || 0) / 1000),
    lyric: lyric?.lrc?.lyric || '',
    translation: lyric?.tlyric?.lyric || '',
    audioUrl: audio.url || '',
    audioType: /\.(flac)(?:\?|$)/i.test(audio.url || '') ? 'flac' : /\.(m4a)(?:\?|$)/i.test(audio.url || '') ? 'm4a' : 'mp3',
    audioHeaders: { Referer: NE_REFERER, Cookie: cookie },
    noAudioReason: audio.url ? '' : (audio.freeTrialInfo ? '平台只返回了试听片段' : '账号无播放权限、Cookie 失效，或歌曲受地区/版权限制')
  }
}

function qqUinFromCookie (cookie = '') {
  return (String(cookie).match(/(?:^|;\s*)(?:uin|wxuin|qqmusic_uin)=o?(\d+)/i) || [])[1] || '0'
}

async function qqAudio (mid, cookie, timeout) {
  const uin = qqUinFromCookie(cookie)
  const guid = String(Math.floor(1000000000 + Math.random() * 8999999999))
  const qualities = [
    { prefix: 'M800', ext: 'mp3' },
    { prefix: 'M500', ext: 'mp3' },
    { prefix: 'C400', ext: 'm4a' }
  ]
  for (const q of qualities) {
    const filename = `${q.prefix}${mid}.${q.ext}`
    const body = {
      req: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey', param: { guid, songmid: [mid], songtype: [0], uin, loginflag: 1, platform: '20', filename: [filename] } },
      comm: { uin: Number(uin) || 0, format: 'json', ct: 24, cv: 0 }
    }
    const j = await fetchJson('https://u.y.qq.com/cgi-bin/musicu.fcg', { cookie, referer: QQ_REFERER, timeout, method: 'POST', body }).catch(() => null)
    const data = j?.req?.data
    const info = data?.midurlinfo?.[0]
    if (info?.purl && data?.sip?.[0]) return { url: data.sip[0] + info.purl, ext: q.ext }
  }
  return { url: '', ext: 'mp3' }
}

async function parseQQ (hit, cfg) {
  const cookie = String(cfg.qqCookie || '').trim()
  const timeout = Math.max(5, Number(cfg.timeout) || 20) * 1000
  const mid = hit.id
  if (!mid) throw new Error('未识别到 QQ 音乐 songmid')
  const [detail, lyric, audio] = await Promise.all([
    fetchJson(`https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?songmid=${encodeURIComponent(mid)}&format=json`, { cookie, referer: QQ_REFERER, timeout }),
    fetchJson(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(mid)}&format=json&nobase64=1`, { cookie, referer: QQ_REFERER, timeout }).catch(() => ({})),
    qqAudio(mid, cookie, timeout)
  ])
  const song = detail?.data?.[0]
  if (!song) throw new Error('QQ音乐未返回歌曲信息，链接可能无效')
  const albumMid = song.album?.mid || ''
  return {
    platform: 'QQ音乐',
    platformKey: 'qq',
    id: mid,
    title: song.name || song.title || `歌曲${mid}`,
    artists: (song.singer || []).map(v => v.name).filter(Boolean).join(' / ') || '未知歌手',
    album: song.album?.name || '',
    cover: albumMid ? `https://y.qq.com/music/photo_new/T002R500x500M000${albumMid}.jpg` : '',
    duration: Number(song.interval) || 0,
    lyric: lyric?.lyric || '',
    translation: lyric?.trans || '',
    audioUrl: audio.url,
    audioType: audio.ext,
    audioHeaders: { Referer: QQ_REFERER, Cookie: cookie },
    noAudioReason: audio.url ? '' : '账号无播放权限、Cookie 失效，或歌曲为 VIP/数字专辑/地区限制音源'
  }
}

async function resolveKugouHash (hit, cookie, timeout) {
  if (hit.id) return hit.id
  if (!hit.url) throw new Error('未识别到酷狗歌曲 hash')
  const page = await fetchText(hit.url, { cookie, referer: KG_REFERER, timeout })
  const all = `${page.url}\n${page.text}`
  const hash = (all.match(/(?:hash|FileHash|fileHash)["'=:\s%\\]*([A-Fa-f0-9]{32})/i) || [])[1]
  if (!hash) throw new Error('未从酷狗分享链接识别到歌曲 hash')
  return hash.toUpperCase()
}

async function parseKugou (hit, cfg) {
  const cookie = String(cfg.kugouCookie || '').trim()
  const timeout = Math.max(5, Number(cfg.timeout) || 20) * 1000
  const hash = await resolveKugouHash(hit, cookie, timeout)
  const data = await fetchJson(`https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${encodeURIComponent(hash)}`, {
    cookie, referer: KG_REFERER, timeout
  })
  if (!data?.songName && !data?.fileName) throw new Error(data?.error || '酷狗未返回歌曲信息，链接或 Cookie 可能失效')
  const lyricRes = await fetchText(`https://m.kugou.com/app/i/krc.php?cmd=100&hash=${encodeURIComponent(hash)}&timelength=${(Number(data.timeLength) || 0) * 1000}`, {
    cookie, referer: KG_REFERER, timeout
  }).catch(() => ({ text: '' }))
  const cover = String(data.album_img || data.imgUrl || data.singerHead || '').replace('{size}', '500')
  const audioUrl = data.url || data.backup_url?.[0] || ''
  return {
    platform: '酷狗音乐',
    platformKey: 'kugou',
    id: hash,
    title: data.songName || String(data.fileName || '').replace(/^.*?\s+-\s+/, '') || `歌曲${hash.slice(0, 8)}`,
    artists: data.singerName || data.author_name || data.authors?.map(v => v.author_name).filter(Boolean).join(' / ') || String(data.fileName || '').split(' - ')[0] || '未知歌手',
    album: data.album_name || '',
    cover,
    duration: Number(data.timeLength) || 0,
    lyric: lyricRes.text || '',
    translation: '',
    audioUrl,
    audioType: String(data.extName || 'mp3').toLowerCase(),
    audioHeaders: { Referer: KG_REFERER, Cookie: cookie },
    noAudioReason: audioUrl ? '' : '账号无播放权限、Cookie 失效，或歌曲为 VIP/付费/地区限制音源'
  }
}

function decodeKuwoString (s = '') {
  return String(s).replace(/\\u002F/g, '/').replace(/\\u0026/g, '&').replace(/\\"/g, '"')
}

function kuwoField (block, name) {
  const m = block.match(new RegExp(`${name}:"((?:\\\\.|[^"\\\\])*)"`))
  return m ? decodeKuwoString(m[1]) : ''
}

async function parseKuwo (hit, cfg) {
  const cookie = String(cfg.kuwoCookie || '').trim()
  const timeout = Math.max(5, Number(cfg.timeout) || 20) * 1000
  const id = hit.id
  if (!id) throw new Error('未识别到酷我歌曲 ID')
  const page = await fetchText(`https://www.kuwo.cn/play_detail/${id}`, { cookie, referer: KW_REFERER, timeout })
  const start = page.text.indexOf('songinfo:{')
  const block = start >= 0 ? page.text.slice(start, start + 12000) : ''
  const title = kuwoField(block, 'name') || `歌曲${id}`
  const artists = kuwoField(block, 'artist') || '未知歌手'
  const album = kuwoField(block, 'album')
  const cover = kuwoField(block, 'pic120') || kuwoField(block, 'pic')
  const duration = Number((block.match(/duration:(\d+)/) || [])[1]) || 0

  const lyricJson = await fetchJson(`https://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${id}`, {
    cookie, referer: KW_REFERER, timeout
  }).catch(() => ({}))
  const lyric = (lyricJson?.data?.lrclist || []).map(v => {
    const sec = Number(v.time) || 0
    const min = Math.floor(sec / 60)
    const rest = (sec % 60).toFixed(2).padStart(5, '0')
    return `[${String(min).padStart(2, '0')}:${rest}]${v.lineLyric || ''}`
  }).join('\n')

  const audioJson = await fetchJson(`https://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=MUSIC_${id}&format=mp3&response=url`, {
    cookie, referer: KW_REFERER, timeout
  }).catch(() => ({}))
  const audioUrl = audioJson?.url || ''
  return {
    platform: '酷我音乐',
    platformKey: 'kuwo',
    id,
    title,
    artists,
    album,
    cover,
    duration,
    lyric,
    translation: '',
    audioUrl,
    audioType: /\.(flac)(?:\?|$)/i.test(audioUrl) ? 'flac' : /\.(m4a)(?:\?|$)/i.test(audioUrl) ? 'm4a' : 'mp3',
    audioHeaders: { Referer: KW_REFERER, Cookie: cookie },
    noAudioReason: audioUrl ? '' : '账号无播放权限、Cookie 失效，或歌曲为 VIP/付费/地区限制音源'
  }
}

export async function parseMusic (hit, cfg) {
  if (hit.platform === 'netease') return parseNetease(hit, cfg)
  if (hit.platform === 'qq') return parseQQ(hit, cfg)
  if (hit.platform === 'kugou') return parseKugou(hit, cfg)
  if (hit.platform === 'kuwo') return parseKuwo(hit, cfg)
  throw new Error('不支持的音乐平台')
}
