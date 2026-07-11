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
  const parts = []
  const segs = Array.isArray(e.message) ? e.message : []
  for (const seg of segs) {
    if (!seg) continue
    if (seg.type === 'text') parts.push(seg.text || seg.data?.text || '')
    else if (seg.type === 'json' || seg.type === 'xml' || seg.type === 'music') {
      let raw = seg.data
      if (raw && typeof raw === 'object') raw = raw.data || JSON.stringify(raw)
      parts.push(String(raw || ''))
      // OneBot/NapCat 的 music 段有时把字段直接挂在消息段本体，而不是 data 里
      if (seg.type === 'music') parts.push(JSON.stringify(seg))
    }
  }
  // 只有拿不到结构化消息段时，才退回原始文本；避免 face/mface/image 的 CQ 码被当成音乐卡片。
  if (!segs.length) parts.push(e.msg || '', e.raw_message || '')
  return htmlDecode(parts.join('\n').replace(/\\\//g, '/').replace(/\\u0026/gi, '&'))
}

function decodeUrlValue (s = '') {
  try { return decodeURIComponent(String(s)) } catch { return String(s) }
}

function hasQQMusicContext (s = '') {
  return /QQ音乐|qqmusic|com\.tencent\.qqmusic|app_type["'\s:=%]*qqmusic|music\.qq\.com|y\.qq\.com/i.test(s)
}

function findQQMusicUrl (s = '') {
  const urls = String(s).match(/https?:\/\/[^\s"'<>\\]+/ig) || []
  for (const raw of urls) {
    const url = decodeUrlValue(raw).replace(/&amp;/g, '&')
    if (/(?:^https?:\/\/)?(?:y\.qq\.com|i\.y\.qq\.com|i2\.y\.qq\.com|c6\.y\.qq\.com)\//i.test(url)) return url
  }
  const encoded = String(s).match(/https?%3A%2F%2F[^\s"'<>\\]+/ig) || []
  for (const raw of encoded) {
    const url = decodeUrlValue(raw).replace(/&amp;/g, '&')
    if (/^(?:https?:\/\/)?(?:y\.qq\.com|i\.y\.qq\.com|i2\.y\.qq\.com|c6\.y\.qq\.com)\//i.test(url)) return url
  }
  return ''
}

function qqIdFromText (s = '') {
  let m = String(s).match(/\b(songmid|song_mid|songid|song_id)\b["'=:\s%]*([A-Za-z0-9]{5,})/i)
  if (m) return { id: m[2], idType: /song_?id/i.test(m[1]) || /^\d+$/.test(m[2]) ? 'songid' : 'songmid' }
  m = String(s).match(/\bmid\b["'=:\s%]*([A-Za-z0-9]{8,})/i)
  if (m && !/^\d+$/.test(m[1])) return { id: m[1], idType: 'songmid' }
  return null
}

export function detectMusicLink (text = '') {
  const s = String(text)
  let m

  // 网易云：标准/移动端歌曲页、song?id=、短链 163cn.tv（短链需跟随跳转后再识别）
  if ((m = s.match(/https?:\/\/(?:y\.)?music\.163\.com\/(?:#\/)?(?:m\/)?song\?(?:[^\s"'<>]*&)?id=(\d+)[^\s"'<>]*/i))) {
    return { platform: 'netease', id: m[1], url: m[0] }
  }
  if ((m = s.match(/https?:\/\/163cn\.tv\/[A-Za-z0-9_-]+/i))) return { platform: 'netease', id: '', url: m[0] }

  // QQ音乐：songDetail/songmid/songid/playsong 页面；VIP 分享卡片有时只有数字 songid 或跳转链接
  if ((m = s.match(/https?:\/\/(?:y\.qq\.com|i\.y\.qq\.com|i2\.y\.qq\.com|c6\.y\.qq\.com)\/[^\s"'<>]*(?:songDetail\/|songmid=|songid=)([A-Za-z0-9]{5,})[^\s"'<>]*/i))) {
    const idType = /^\d+$/.test(m[1]) ? 'songid' : 'songmid'
    return { platform: 'qq', id: m[1], idType, url: m[0] }
  }
  if ((m = s.match(/https?:\/\/(?:c6\.y\.qq\.com|y\.qq\.com)\/(?:base\/fcgi-bin\/u|n\/ryqq(?:_v2)?\/songDetail)[^\s"'<>]*/i))) {
    const raw = (m[0].match(/songDetail\/([A-Za-z0-9]{5,})|songmid=([A-Za-z0-9]{5,})|songid=(\d+)/i) || []).slice(1).find(Boolean) || ''
    return { platform: 'qq', id: raw, idType: /^\d+$/.test(raw) ? 'songid' : 'songmid', url: m[0] }
  }
  if (hasQQMusicContext(s)) {
    const url = findQQMusicUrl(s)
    const fromUrl = url ? qqIdFromText(url) || (url.match(/songDetail\/([A-Za-z0-9]{5,})/i) ? { id: RegExp.$1, idType: /^\d+$/.test(RegExp.$1) ? 'songid' : 'songmid' } : null) : null
    if (fromUrl) return { platform: 'qq', ...fromUrl, url }
    const fromCard = qqIdFromText(s)
    if (fromCard) return { platform: 'qq', ...fromCard, url: url || '' }
    if (url) return { platform: 'qq', id: '', idType: 'songmid', url }
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

async function fetchJson (url, { cookie = '', referer = '', timeout = 20000, method = 'GET', body, headers: extraHeaders = {} } = {}) {
  const headers = { 'User-Agent': UA, Referer: referer, ...extraHeaders }
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

async function validAudioUrl (url, cookie, timeout) {
  if (!url) return false
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: QQ_REFERER, Cookie: cookie, Range: 'bytes=0-31' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout)
    })
    const type = res.headers.get('content-type') || ''
    const ok = (res.status === 200 || res.status === 206) && !/text\/html|application\/json/i.test(type)
    try { await res.body?.cancel() } catch {}
    return ok
  } catch { return false }
}

async function qqAudio (mid, cookie, timeout) {
  const uin = qqUinFromCookie(cookie)
  const guid = String(Math.floor(1000000000 + Math.random() * 8999999999))
  const qualities = [
    // 从高到低依次尝试；平台可能给 purl 但 CDN 实际 404，所以每条都必须实测可访问。
    { prefix: 'F000', ext: 'flac' },
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
    if (!info?.purl) continue
    // sip 常有多条线路，第一条可能对当前地区/歌曲 404；逐条验证后再返回。
    for (const sip of data?.sip || []) {
      const url = `${sip}${info.purl}`
      if (await validAudioUrl(url, cookie, timeout)) return { url, ext: q.ext }
    }
  }
  return { url: '', ext: 'mp3' }
}

async function resolveQQId (hit, cookie, timeout) {
  if (hit.id) return { id: hit.id, idType: hit.idType || (/^\d+$/.test(hit.id) ? 'songid' : 'songmid') }
  if (!hit.url) throw new Error('未识别到 QQ 音乐歌曲 ID')
  const page = await fetchText(hit.url, { cookie, referer: QQ_REFERER, timeout })
  const all = decodeUrlValue(`${page.url}\n${page.text}`)
  const fromText = qqIdFromText(all)
  if (fromText) return fromText
  let m = all.match(/songDetail\/([A-Za-z0-9]{5,})/i)
  if (m) return { id: m[1], idType: /^\d+$/.test(m[1]) ? 'songid' : 'songmid' }
  m = all.match(/(?:songDetail\/|songmid["'=:\s%]+)([A-Za-z0-9]{8,})/i)
  if (m) return { id: m[1], idType: 'songmid' }
  m = all.match(/songid["'=:\s%]+(\d{5,})/i)
  if (m) return { id: m[1], idType: 'songid' }
  throw new Error('QQ音乐分享链接已失效或未识别到歌曲 ID')
}

async function parseQQ (hit, cfg) {
  const cookie = String(cfg.qqCookie || '').trim()
  const timeout = Math.max(5, Number(cfg.timeout) || 20) * 1000
  const resolved = await resolveQQId(hit, cookie, timeout)
  const queryKey = resolved.idType === 'songid' ? 'songid' : 'songmid'
  const detail = await fetchJson(`https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?${queryKey}=${encodeURIComponent(resolved.id)}&format=json`, { cookie, referer: QQ_REFERER, timeout })
  const song = detail?.data?.[0]
  if (!song) throw new Error('QQ音乐未返回歌曲信息，分享链接可能失效或歌曲已下架')
  // 数字 songid 先由详情换成真正 songmid，后续歌词/vkey 统一使用 songmid
  const mid = song.mid || song.songmid || (resolved.idType === 'songmid' ? resolved.id : '')
  if (!mid) throw new Error('QQ音乐未返回 songmid，暂时无法继续解析')
  const [lyric, audio] = await Promise.all([
    fetchJson(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(mid)}&format=json&nobase64=1`, { cookie, referer: QQ_REFERER, timeout }).catch(() => ({})),
    qqAudio(mid, cookie, timeout)
  ])
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

function firstValue (...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue
    const s = String(value).trim()
    if (s) return s
  }
  return ''
}

function kugouCookieValue (cookie = '', name) {
  return (String(cookie).match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`, 'i')) || [])[1] || ''
}

function buildKugouAuth (cfg) {
  const rawCookie = String(cfg.kugouCookie || '').trim()
  const userId = firstValue(cfg.kugouUserId, kugouCookieValue(rawCookie, 'KugooID'))
  const token = firstValue(cfg.kugouToken, kugouCookieValue(rawCookie, 't'), kugouCookieValue(rawCookie, 'token'))
  const coreCookie = [userId ? `KugooID=${userId}` : '', token ? `t=${token}` : '', token ? `token=${token}` : ''].filter(Boolean).join('; ')
  return { rawCookie, userId, token, cookie: [rawCookie, coreCookie].filter(Boolean).join('; ') }
}

function normalizeKugouData (data = {}, hash = '') {
  const song = data.data || data
  const authors = Array.isArray(song.authors) ? song.authors.map(v => v.author_name || v.name).filter(Boolean).join(' / ') : ''
  const fileName = String(song.fileName || song.filename || '').trim()
  return {
    title: firstValue(song.songName, song.audio_name, song.song_name, song.name, fileName.replace(/^.*?\s+-\s+/, ''), hash ? `歌曲${hash.slice(0, 8)}` : ''),
    artists: firstValue(song.singerName, song.author_name, song.singer_name, song.authorName, authors, fileName.split(' - ')[0], '未知歌手'),
    album: firstValue(song.album_name, song.albumName, song.album_name_audio),
    cover: firstValue(song.album_img, song.imgUrl, song.img, song.image, song.singerHead).replace('{size}', '500'),
    duration: Number(song.timeLength || song.timelength || song.duration || song.time_length) || 0,
    lyric: firstValue(song.lyrics, song.lyric, song.krc),
    audioUrl: firstValue(song.play_url, song.url, Array.isArray(song.backup_url) ? song.backup_url[0] : '', Array.isArray(song.backupUrl) ? song.backupUrl[0] : ''),
    audioType: firstValue(song.extName, song.ext, song.format, 'mp3').toLowerCase(),
    raw: song
  }
}

async function fetchKugouWebData (hash, auth, timeout) {
  const qs = new URLSearchParams({
    r: 'play/getdata',
    hash,
    dfid: kugouCookieValue(auth.cookie, 'kg_dfid') || kugouCookieValue(auth.cookie, 'dfid') || '',
    mid: kugouCookieValue(auth.cookie, 'kg_mid') || kugouCookieValue(auth.cookie, 'mid') || '',
    platid: '4',
    album_id: '',
    _: String(Date.now())
  })
  if (auth.userId) qs.set('userid', auth.userId)
  if (auth.token) qs.set('token', auth.token)
  const json = await fetchJson(`https://wwwapi.kugou.com/yy/index.php?${qs.toString()}`, {
    cookie: auth.cookie,
    referer: KG_REFERER,
    timeout,
    headers: { Origin: 'https://www.kugou.com' }
  })
  if (json?.err_code && Number(json.err_code) !== 0) throw new Error(json.error || json.err_msg || '酷狗网页接口返回错误')
  return json
}

async function fetchKugouMobileData (hash, auth, timeout) {
  return fetchJson(`https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${encodeURIComponent(hash)}`, {
    cookie: auth.cookie, referer: KG_REFERER, timeout
  })
}

async function fetchKugouLyric (hash, auth, timeout, duration = 0) {
  const timelength = Math.max(0, Number(duration) || 0) * 1000
  const urls = [
    `https://m.kugou.com/app/i/krc.php?cmd=100&hash=${encodeURIComponent(hash)}&timelength=${timelength}`,
    `https://m.kugou.com/app/i/krc.php?cmd=100&hash=${encodeURIComponent(hash)}&timelength=0`
  ]
  for (const url of urls) {
    const res = await fetchText(url, { cookie: auth.cookie, referer: KG_REFERER, timeout }).catch(() => ({ text: '' }))
    const text = String(res.text || '').trim()
    if (text) return text
  }
  return ''
}

async function parseKugou (hit, cfg) {
  const auth = buildKugouAuth(cfg)
  const timeout = Math.max(5, Number(cfg.timeout) || 20) * 1000
  const hash = await resolveKugouHash(hit, auth.cookie, timeout)

  const web = await fetchKugouWebData(hash, auth, timeout).catch(() => null)
  const mobile = await fetchKugouMobileData(hash, auth, timeout).catch(() => null)
  if (!web && !mobile) throw new Error('酷狗未返回歌曲信息，链接或 Cookie 可能失效')
  const mobileSong = mobile?.data || mobile || {}
  const webSong = web?.data || web || {}
  const merged = normalizeKugouData({ data: { ...mobileSong, ...webSong } }, hash)
  if (!merged.raw?.songName && !merged.raw?.fileName && !merged.raw?.song_name && !merged.raw?.audio_name && !merged.raw?.play_url && !merged.raw?.url) {
    const msg = web?.error || web?.err_msg || mobile?.error || '酷狗未返回歌曲信息，链接或 Cookie 可能失效'
    throw new Error(msg)
  }
  const lyric = merged.lyric || await fetchKugouLyric(hash, auth, timeout, merged.duration)
  return {
    platform: '酷狗音乐',
    platformKey: 'kugou',
    id: hash,
    title: merged.title,
    artists: merged.artists,
    album: merged.album,
    cover: merged.cover,
    duration: merged.duration,
    lyric,
    translation: '',
    audioUrl: merged.audioUrl,
    audioType: merged.audioType,
    audioHeaders: { Referer: KG_REFERER, Cookie: auth.cookie },
    noAudioReason: merged.audioUrl ? '' : '账号无播放权限、Cookie 失效，或歌曲为 VIP/付费/地区限制音源'
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
