import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import { getVersionInfo } from '../model/version.js'
import setting from '../utils/setting.js'

const _path = process.cwd().replace(/\\/g, '/')
const TPL = './plugins/AQing-plugin/resources/html/daily/daily.html'
const CACHE_PREFIX = 'AQing:daily-report:'
const CACHE_EXPIRE = 60 * 60 * 12
const FETCH_TIMEOUT = 8000

const NEWS_APIS = [
  'https://60s.viki.moe/v2/60s?encoding=json',
  'https://api.03c3.cn/api/zb?type=json'
]

const ANIME_DATA_APIS = [
  'https://unpkg.com/bangumi-data@0.3/dist/data.json',
  'https://fastly.jsdelivr.net/gh/bangumi-data/bangumi-data@master/dist/data.json',
  'https://cdn.jsdelivr.net/gh/bangumi-data/bangumi-data@master/dist/data.json'
]

const FESTIVAL_TABLE = {
  2026: [
    ['春节', '2026-02-17'], ['清明节', '2026-04-05'], ['端午节', '2026-06-19'], ['中秋节', '2026-09-25']
  ],
  2027: [
    ['春节', '2027-02-06'], ['清明节', '2027-04-05'], ['端午节', '2027-06-09'], ['中秋节', '2027-09-15']
  ],
  2028: [
    ['春节', '2028-01-26'], ['清明节', '2028-04-04'], ['端午节', '2028-05-28'], ['中秋节', '2028-10-03']
  ]
}

const FIXED_FESTIVALS = [
  ['元旦', '01-01'],
  ['情人节', '02-14'],
  ['劳动节', '05-01'],
  ['儿童节', '06-01'],
  ['高考', '06-07'],
  ['国庆节', '10-01'],
  ['圣诞节', '12-25']
]

const BACKUP_HITOKOTO = [
  { content: '愿你今天也能和喜欢的事物撞个满怀。', from: 'AQing-plugin', author: '阿晴' },
  { content: '慢慢来，比较快。', from: '每日一言', author: '' },
  { content: '保持热爱，奔赴下一场山海。', from: '每日一言', author: '' }
]

export class AQDailyReport extends plugin {
  constructor () {
    super({
      name: 'AQ：每日日报',
      dsc: '每日资讯、摸鱼倒计时、今日新番、每日一言',
      event: 'message',
      priority: 500,
      rule: [
        { reg: '^#?(每日日报|今日日报|日报|每日资讯)$', fnc: 'dailyReport' }
      ]
    })
    this.task = {
      name: 'AQ每日日报定时发送',
      cron: '0 * * * * ?',
      fnc: this.dailyReportTask.bind(this),
      log: false
    }
  }

  async dailyReport (e) {
    return await sendDailyReport(async msg => e.reply(msg), true)
  }

  async dailyReportTask () {
    const config = setting.getConfig('config') || {}
    const time = String(config.dailyReportTime || '').trim()
    if (!/^\d{1,2}:\d{2}$/.test(time)) return

    const groups = Array.isArray(config.dailyReportGroupList) ? config.dailyReportGroupList.map(id => Number(id)).filter(Boolean) : []
    if (!groups.length) return

    const now = new Date()
    const [hour, minute] = time.split(':').map(Number)
    if (hour !== now.getHours() || minute !== now.getMinutes()) return

    const dateKey = getDateKey(now)
    const sentKey = `${CACHE_PREFIX}task-sent:${dateKey}`
    if (await loadCache(sentKey)) return
    await saveCache(sentKey, true)

    logger.mark(`[AQ每日日报] 开始定时发送，目标群：${groups.length} 个`)
    await sendDailyReport(async msg => {
      for (const groupId of groups) {
        try {
          await Bot.pickGroup(groupId).sendMsg(msg)
        } catch (err) {
          logger.warn(`[AQ每日日报] 定时发送到群 ${groupId} 失败`)
          logger.warn(err)
        }
      }
    })
  }
}

async function sendDailyReport (send, showTip = false) {
  const date = new Date()
  const dateKey = getDateKey(date)
  const cacheKey = `${CACHE_PREFIX}${dateKey}`

  try {
    if (showTip) await send('正在整理今天的日报喵 ฅ^•ﻌ•^ฅ')

    let report = await loadCache(cacheKey)
    if (!report || report.dateKey !== dateKey) {
      report = await buildReport(date)
      await saveCache(cacheKey, report)
    } else {
      report.fromCache = true
    }

    const { pluginVersion } = getVersionInfo()
    const data = {
      tplFile: TPL,
      pluResPath: _path,
      saveId: 'daily',
      pluginVersion,
      report
    }

    try {
      const img = await puppeteer.screenshot('daily', data)
      if (img) {
        await send(img)
        return true
      }
    } catch (err) {
      logger.warn('[AQ每日日报] 日报出图失败，降级为文字发送')
      logger.warn(err)
    }

    await send(formatReport(report))
    return true
  } catch (err) {
    logger.error('[AQ每日日报]', err)
    await send(`日报整理失败了：${err.message || err}`)
    return true
  }
}

async function buildReport (date = new Date()) {
  const settled = await Promise.allSettled([
    fetchDailyNews(),
    buildMoyuCalendar(date),
    fetchTodayAnime(date),
    fetchHitokoto()
  ])

  const [news, moyu, anime, hitokoto] = settled.map((item, index) => {
    if (item.status === 'fulfilled') return item.value
    logger.warn(`[AQ每日日报] 模块 ${index} 获取失败`)
    logger.warn(item.reason)
    return null
  })

  const safeNews = news || { title: '每日资讯', items: [], source: '', error: '每日资讯暂时获取失败' }
  const safeMoyu = moyu || { items: [], error: '摸鱼日历暂时生成失败' }
  const safeAnime = anime || { items: [], source: '', error: '今日新番暂时获取失败' }
  const safeHitokoto = hitokoto || pickBackupHitokoto(date)

  return {
    dateKey: getDateKey(date),
    dateText: formatDateText(date),
    weekText: getWeekText(date),
    generatedAt: formatTimeText(new Date()),
    fromCache: false,
    news: safeNews,
    moyu: safeMoyu,
    anime: safeAnime,
    hitokoto: safeHitokoto
  }
}

async function fetchDailyNews () {
  for (const url of NEWS_APIS) {
    try {
      const json = await fetchJson(url)
      const parsed = parseNews(json, url)
      if (parsed.items.length) return parsed
    } catch (err) {
      logger.warn(`[AQ每日日报] 每日资讯接口失败：${url}`)
      logger.warn(err)
    }
  }
  return { title: '每日资讯', items: [], source: '', error: '每日资讯暂时获取失败' }
}

function parseNews (json, sourceUrl) {
  const data = json?.data || json?.result || json
  const rawItems = data?.news || data?.list || data?.items || data?.newslist || json?.news || []
  let items = []

  if (Array.isArray(rawItems)) {
    items = rawItems.map(item => {
      if (typeof item === 'string') return item
      return item?.title || item?.content || item?.digest || item?.desc || item?.word || ''
    }).filter(Boolean)
  }

  if (!items.length && typeof data === 'string') {
    items = data.split(/\n|。/).map(v => v.replace(/^\d+[、.．]\s*/, '').trim()).filter(Boolean)
  }

  return {
    title: data?.title || json?.title || '每日资讯',
    date: data?.date || data?.time || json?.date || '',
    items: items.slice(0, 10),
    source: data?.source || json?.source || sourceUrl
  }
}

function buildMoyuCalendar (date = new Date()) {
  const start = startOfDay(date)
  const year = start.getFullYear()
  const days = []

  for (const y of [year, year + 1]) {
    for (const [name, md] of FIXED_FESTIVALS) {
      days.push({ name, date: parseDate(`${y}-${md}`) })
    }
    for (const [name, day] of FESTIVAL_TABLE[y] || []) {
      days.push({ name, date: parseDate(day) })
    }
  }

  const items = days
    .map(item => ({
      name: item.name,
      date: getDateKey(item.date),
      days: diffDays(start, item.date),
      text: diffDays(start, item.date) === 0 ? `${item.name}就是今天！` : `距离${item.name}还有 ${diffDays(start, item.date)} 天`
    }))
    .filter(item => item.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6)

  return { items }
}

async function fetchTodayAnime (date = new Date()) {
  try {
    const json = await fetchJson('https://api.bgm.tv/calendar')
    const weekday = date.getDay() === 0 ? 7 : date.getDay()
    const day = Array.isArray(json)
      ? json.find(item => item?.weekday?.id === weekday) || json[weekday - 1]
      : null

    const items = (day?.items || []).map(item => ({
      name: item?.name_cn || item?.name || '未命名番剧',
      rawName: item?.name || '',
      airDate: item?.air_date || '',
      url: item?.url || ''
    })).filter(item => item.name).slice(0, 10)

    if (items.length) {
      return {
        weekday: day?.weekday?.cn || getWeekText(date),
        items,
        source: 'Bangumi 番组计划'
      }
    }
  } catch (err) {
    logger.warn(`[AQ每日日报] Bangumi 日历接口失败：${err.message || err}`)
  }

  return await fetchAnimeFromData(date)
}

async function fetchAnimeFromData (date = new Date()) {
  for (const url of ANIME_DATA_APIS) {
    try {
      const json = await fetchJson(url)
      const items = parseAnimeData(json, date)
      if (items.length) {
        return {
          weekday: getWeekText(date),
          items,
          source: 'bangumi-data'
        }
      }
    } catch (err) {
      logger.warn(`[AQ每日日报] 新番备用数据源失败：${url}：${err.message || err}`)
    }
  }

  return { items: [], source: '', error: '今日新番暂时获取失败' }
}

function parseAnimeData (json, date = new Date()) {
  const items = Array.isArray(json?.items) ? json.items : []
  const weekday = date.getDay()
  const now = startOfDay(date)

  return items
    .filter(item => item?.type === 'tv')
    .map(item => {
      const site = Array.isArray(item.sites) ? item.sites.find(s => s?.broadcast) : null
      const begin = site?.begin || item.begin
      if (!begin) return null

      const airDate = new Date(begin)
      if (Number.isNaN(airDate.getTime())) return null
      if (airDate > now) return null
      if (airDate.getDay() !== weekday) return null

      const name = item.titleTranslate?.['zh-Hans']?.[0] || item.titleTranslate?.['zh-Hant']?.[0] || item.title || ''
      if (!name) return null

      return {
        name,
        rawName: item.title || '',
        airDate: getDateKey(airDate),
        url: item.officialSite || ''
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.airDate.localeCompare(a.airDate))
    .slice(0, 10)
}

async function fetchHitokoto () {
  try {
    const json = await fetchJson('https://v1.hitokoto.cn/?c=a&c=b&c=c&c=d&c=i&encode=json')
    if (json?.hitokoto) {
      return {
        content: json.hitokoto,
        from: json.from || '一言',
        author: json.from_who || ''
      }
    }
  } catch (err) {
    logger.warn('[AQ每日日报] 每日一言接口失败')
    logger.warn(err)
  }
  return pickBackupHitokoto(new Date())
}

async function fetchJson (url) {
  const res = await fetch(url, {
    signal: timeoutSignal(FETCH_TIMEOUT),
    headers: {
      'user-agent': 'Mozilla/5.0 AQing-plugin DailyReport',
      'accept': 'application/json,text/plain,*/*'
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}

function timeoutSignal (timeout) {
  if (globalThis.AbortSignal?.timeout) return AbortSignal.timeout(timeout)

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeout)
  return controller.signal
}

async function loadCache (key) {
  if (!globalThis.redis) return null
  try {
    const raw = await redis.get(key)
    return raw ? JSON.parse(raw) : null
  } catch (err) {
    logger.warn('[AQ每日日报] 读取缓存失败')
    logger.warn(err)
    return null
  }
}

async function saveCache (key, data) {
  if (!globalThis.redis) return
  try {
    await redis.set(key, JSON.stringify(data), { EX: CACHE_EXPIRE })
  } catch (err) {
    logger.warn('[AQ每日日报] 写入缓存失败')
    logger.warn(err)
  }
}

function formatReport (report) {
  const lines = []
  lines.push(`🌈 AQ每日日报 · ${report.dateText} ${report.weekText}`)
  lines.push('━━━━━━━━━━━━━━')

  lines.push('📰 每日资讯')
  if (report.news?.items?.length) {
    report.news.items.slice(0, 10).forEach((item, index) => lines.push(`${index + 1}. ${item}`))
  } else {
    lines.push(report.news?.error || '每日资讯暂时获取失败')
  }

  lines.push('')
  lines.push('🐟 摸鱼日历')
  if (report.moyu?.items?.length) {
    report.moyu.items.slice(0, 6).forEach(item => lines.push(`- ${item.text}`))
  } else {
    lines.push(report.moyu?.error || '摸鱼日历暂时生成失败')
  }

  lines.push('')
  lines.push('📺 今日新番')
  if (report.anime?.items?.length) {
    report.anime.items.slice(0, 10).forEach((item, index) => lines.push(`${index + 1}. ${item.name}`))
  } else {
    lines.push(report.anime?.error || '今日新番暂时获取失败')
  }

  lines.push('')
  lines.push('💬 每日一言')
  lines.push(`「${report.hitokoto?.content || '愿你今天也有好心情。'}」`)
  if (report.hitokoto?.from || report.hitokoto?.author) {
    lines.push(`—— ${[report.hitokoto.author, report.hitokoto.from].filter(Boolean).join(' · ')}`)
  }

  lines.push('━━━━━━━━━━━━━━')
  lines.push(`生成时间：${report.generatedAt}${report.fromCache ? '（缓存）' : ''}`)
  return lines.join('\n')
}

function pickBackupHitokoto (date) {
  return BACKUP_HITOKOTO[date.getDate() % BACKUP_HITOKOTO.length]
}

function getDateKey (date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateText (date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatTimeText (date) {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${getDateKey(date)} ${h}:${m}`
}

function getWeekText (date) {
  return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()]
}

function parseDate (str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfDay (date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function diffDays (from, to) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000)
}
