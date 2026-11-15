/**
 * AQ 状态图：展示机器人运行环境、资源占用与消息统计
 * 触发：#状态 / #status / #云崽状态 / #zt / #阿晴状态
 * 开关：锅巴中的状态图开关，或主人发送「#开启可爱状态 / #关闭可爱状态」
 */

import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import setting from '../utils/setting.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec, execFileSync, execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let si = null
try { si = (await import('systeminformation')).default } catch (_) {}

let npmVersionPromise
const runtimePackage = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'))
  } catch (_) {
    return {}
  }
})()

const _path = process.cwd().replace(/\\/g, '/')
const TPL = './plugins/AQing-plugin/resources/html/status/status.html'
const isOn = () => setting.getConfig('config')?.kawaiiStatus === true

// ─── 后台采样与消息计数（全局单例，热重载时替换旧实例）────────
// 网络：后台定时采样，折线图展示最近一段时间的真实曲线，而不是"每次发 #状态 才记一个点"
// 消息：接收只统计 message 事件且排除机器人自身回显；发送在协议层 sendApi 成功后计数，
//      覆盖 e.reply / pickGroup().sendMsg / 合并转发 / 文件等所有发送途径
const NET_MAX = 60
const NET_INTERVAL = process.platform === 'win32' ? 10_000 : 5_000
const MSG_KEY = 'AQ:status:msg'
const SEND_ACTION = /^send_(?:\w+_)?(?:msg|message)$/
const FILE_ACTION = /^upload_(?:group|private)_file$/
const WRAPPED = Symbol.for('AQing.status.sendApiWrapped')
const STATE = Symbol.for('AQing.status.state')

const state = globalThis[STATE] ??= { net: [] }
if (state.timer) clearInterval(state.timer)
if (state.listeners) for (const [ev, fn] of state.listeners) Bot.off?.(ev, fn)
state.net ??= []
// 包装函数通过 state.bump 间接调用，热重载后旧包装自动使用新逻辑
state.bump = bumpMsg
state.listeners = [
  ['message', e => {
    if (e?.self_id && String(e.user_id) !== String(e.self_id)) state.bump('recv', e.self_id)
  }],
  ['connect', data => wrapSendApi(data?.self_id)],
]
for (const [ev, fn] of state.listeners) Bot.on?.(ev, fn)
for (const id of Bot.uin || []) wrapSendApi(id)

if (si) {
  sampleNet()
  state.timer = setInterval(sampleNet, NET_INTERVAL)
  state.timer.unref?.()
}

function wrapSendApi (selfId) {
  try {
    const bot = selfId && Bot[selfId]
    if (!bot || typeof bot.sendApi !== 'function') return
    if (!bot.sendApi[WRAPPED]) {
      const raw = bot.sendApi
      const wrapped = function (action, ...args) {
        const res = raw.call(this, action, ...args)
        if (typeof action === 'string' && (SEND_ACTION.test(action) || FILE_ACTION.test(action))) {
          Promise.resolve(res).then(() => globalThis[STATE]?.bump?.('send', selfId), () => {})
        }
        return res
      }
      wrapped[WRAPPED] = true
      bot.sendApi = wrapped
    }
    ;(state.sendTracked ??= new Set()).add(String(selfId))
  } catch (_) {}
}

async function bumpMsg (type, selfId) {
  try {
    const day = dayKey()
    const k = `${MSG_KEY}:${type}:${selfId}`
    await redis.multi()
      .incr(`${k}:total`)
      .incr(`${k}:${day}`)
      .expire(`${k}:${day}`, 3 * 86400)
      .exec()
    await redis.set(`${MSG_KEY}:since:${selfId}`, day, { NX: true })
  } catch (_) {}
}

async function sampleNet () {
  try {
    const stats = await si.networkStats()
    let up = 0, down = 0, ok = false
    for (const n of stats || []) {
      if (n.tx_sec == null || n.rx_sec == null || n.tx_sec < 0 || n.rx_sec < 0) continue
      up += n.tx_sec
      down += n.rx_sec
      ok = true
    }
    if (!ok) return null
    const point = { t: Date.now(), up, down }
    state.net.push(point)
    if (state.net.length > NET_MAX) state.net.splice(0, state.net.length - NET_MAX)
    return point
  } catch (_) {
    return null
  }
}

function getNpmVersion () {
  if (npmVersionPromise) return npmVersionPromise

  const userAgentVersion = process.env.npm_config_user_agent?.match(/(?:^|\s)npm\/(\d+\.\d+\.\d+)/)?.[1]
  if (userAgentVersion) {
    npmVersionPromise = Promise.resolve(`v${userAgentVersion}`)
    return npmVersionPromise
  }

  npmVersionPromise = new Promise(resolve => {
    try {
      exec('npm --version', { timeout: 1500, windowsHide: true }, (err, stdout) => {
        const version = stdout?.trim().match(/^v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/)?.[0]
        resolve(err || !version ? '未知' : `v${version.replace(/^v/, '')}`)
      })
    } catch (_) {
      resolve('未知')
    }
  })
  return npmVersionPromise
}

function getFrameworkInfo () {
  const packageName = String(runtimePackage.name || '').trim()
  const normalizedName = packageName.toLowerCase()
  const displayNames = {
    'miao-yunzai': 'Miao-Yunzai',
    'trss-yunzai': 'TRSS-Yunzai',
    'a-yunzai': 'A-Yunzai',
    'yunzai': 'Yunzai-Bot',
    'yunzai-bot': 'Yunzai-Bot',
  }
  const version = String(runtimePackage.version || '').trim().replace(/^v/i, '')

  return {
    name: displayNames[normalizedName] || (packageName ? packageName[0].toUpperCase() + packageName.slice(1) : '未知框架'),
    version: version ? `v${version}` : '未知',
  }
}

function getGpuName (controllers) {
  const names = []
  const invalid = /^(unknown|undefined|null|n\/?a|none|generic|未检测到|未知)$/i
  const isUsable = value => value && !invalid.test(value)
  const addName = name => {
    if (isUsable(name) && !names.some(item => item.toLowerCase() === name.toLowerCase())) names.push(name)
  }

  for (const controller of Array.isArray(controllers) ? controllers : []) {
    const model = String(controller?.model || '').trim()
    const controllerName = String(controller?.name || '').trim()
    const vendor = String(controller?.vendor || '').trim()
    const label = isUsable(model) ? model : isUsable(controllerName) ? controllerName : ''
    if (!label) continue

    addName(vendor && isUsable(vendor) && !label.toLowerCase().includes(vendor.toLowerCase())
      ? `${vendor} ${label}`
      : label)
  }

  if (!names.length && process.platform === 'linux') {
    try {
      const devices = execFileSync('lspci', ['-nn'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1500,
      })
      for (const line of devices.split(/\r?\n/)) {
        const match = line.match(/(?:VGA compatible controller|3D controller|Display controller)(?:\s+\[[^\]]+\])?:\s*(.+)$/i)
        if (match) addName(match[1].trim())
      }
    } catch (_) {}
  }

  return names.length ? names.join(' / ') : '未检测到可用 GPU'
}

function getPluginVersion () {
  try {
    const pluginPackage = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'))
    return pluginPackage.version ? `v${pluginPackage.version}` : '未知'
  } catch (_) {
    return '未知'
  }
}

function parseCount (value) {
  if (value == null || String(value).trim() === '') return null
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : null
}

function formatCount (value) {
  const count = parseCount(value)
  return count == null ? '—' : count.toLocaleString('en-US')
}

// ─── 插件类（单一导出）────────────────────────────────────────
export class KawaiiStatus extends plugin {
  constructor () {
    super({
      name: 'AQ：状态图',
      dsc: '查看机器人运行环境、系统资源与消息统计',
      event: 'message',
      priority: 500, // 抢在云崽本体「状态统计」(默认5000) 之前
      rule: [
        { reg: '^#?(状态|status|云崽状态|zt|阿晴状态)$', fnc: 'send', permission: 'all' },
        { reg: '^#?(开启|开|打开|关闭|关)可爱状态$', fnc: 'toggle' },
      ]
    })
  }

  async toggle (e) {
    if (!e.isMaster) { await e.reply('只有主人可以切换状态图开关。'); return true }
    const on = /开启|开|打开/.test(e.msg)
    const cur = setting.getConfig('config') || {}
    setting.setConfig('config', { ...cur, kawaiiStatus: on })
    await e.reply(on
      ? '状态图已开启，发送「#状态」即可查看运行信息。'
      : '状态图已关闭，「#状态」将交还给云崽本体处理。')
    return true
  }

  async send (e) {
    // 开关关闭：不接管，交还给云崽本体的「状态统计」
    if (!isOn()) return false

    await e.reply('正在整理运行状态，请稍候…')
    try {
      const [d, avatarB64] = await Promise.all([
        collect(e),
        getAvatar(e),
      ])
      const data = buildData(d, avatarB64)
      const img = await puppeteer.screenshot('status', data)
      if (img) await e.reply(img)
      else await e.reply('状态图生成失败，请稍后重试。')
    } catch (err) {
      logger.error('[AQ状态图]', err)
      await e.reply(`状态图生成失败：${err.message || '未知错误'}`)
    }
    return true // 已接管，拦截本体状态
  }
}

// ─── 头像 ─────────────────────────────────────────────────────
async function getAvatar (e) {
  try {
    const selfId = e.self_id || Bot?.uin || Bot?.account?.uin
    if (!selfId) return null
    return await fetchB64(`https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(selfId)}&s=640`)
  } catch (_) { return null }
}

async function fetchB64 (url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null

    const type = response.headers.get('content-type')?.split(';')[0]
    if (!type?.startsWith('image/')) return null

    const data = Buffer.from(await response.arrayBuffer())
    if (!data.length || data.length > 2 * 1024 * 1024) return null
    return `data:${type};base64,${data.toString('base64')}`
  } catch (_) {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ─── CPU 占用：取 500ms 窗口内的真实占用，而不是"距上次调用"的平均 ──
function sampleCpu (ms = 500) {
  const snap = () => os.cpus().map(c => c.times)
  const s1 = snap()
  return new Promise(resolve => setTimeout(() => {
    let idle = 0, total = 0
    snap().forEach((t, i) => {
      const a = s1[i]
      if (!a) return
      const dIdle = t.idle - a.idle
      idle += dIdle
      total += (t.user - a.user) + (t.nice - a.nice) + (t.sys - a.sys) + (t.irq - a.irq) + dIdle
    })
    resolve(total > 0 ? Math.round((1 - idle / total) * 100) : 0)
  }, ms))
}

// ─── 消息统计 ─────────────────────────────────────────────────
async function getMsgStats (selfId, bot) {
  const out = { todayRecv: '—', todaySent: '—', totalRecv: '—', totalSent: '—', since: '' }
  if (!selfId) return out
  const day = dayKey()
  const k = type => `${MSG_KEY}:${type}:${selfId}`
  const yzDay = day.replace(/-/g, ':')
  const get = key => redis.get(key).catch(() => null)

  try {
    const [tr, ts, ar, as, since, yzTodaySent, yzTotalSent] = await Promise.all([
      get(`${k('recv')}:${day}`), get(`${k('send')}:${day}`),
      get(`${k('recv')}:total`), get(`${k('send')}:total`),
      get(`${MSG_KEY}:since:${selfId}`),
      get(`Yz:count:send:msg:bot:${selfId}:${yzDay}`),
      get(`Yz:count:send:msg:bot:${selfId}:total`),
    ])
    out.todayRecv = formatCount(parseCount(tr) ?? 0)
    out.totalRecv = formatCount(parseCount(ar) ?? 0)

    if (state.sendTracked?.has(String(selfId))) {
      out.todaySent = formatCount(parseCount(ts) ?? 0)
      out.totalSent = formatCount(parseCount(as) ?? 0)
    } else {
      // 非 sendApi 型适配器：回退到框架自带计数（仅统计 e.reply）
      out.todaySent = formatCount(parseCount(yzTodaySent) ?? bot?.stat?.sent_msg_cnt)
      out.totalSent = formatCount(parseCount(yzTotalSent))
    }
    if (since) out.since = since.slice(5)
  } catch (_) {}
  return out
}

// ─── 数据收集 ─────────────────────────────────────────────────
async function collect (e) {
  // 刚加载还没采到网速：现场补采两次，保证至少有当前速率
  const netReady = (async () => {
    if (!si || state.net.length >= 2) return
    if (!state.net.length) await sampleNet()
    await new Promise(r => setTimeout(r, 1000))
    await sampleNet()
  })()

  let siData = {}
  if (si) {
    try {
      siData = await si.get({
        cpu: 'speed,cores,physicalCores,manufacturer,brand',
        mem: 'total,free,active,swaptotal,swapused',
        fsSize: 'fs,type,size,used,available,use,mount',
        osInfo: 'distro,release,arch',
        graphics: 'controllers',
      })
    } catch (err) {
      logger.warn('[AQ状态图] systeminformation 获取失败，回退到 os 模块:', err.message)
    }
  }
  const [cpuPct] = await Promise.all([sampleCpu(), netReady])

  // ── CPU ──
  const cpuOsInfo = os.cpus()
  let cpuModel = cpuOsInfo[0]?.model?.trim() || '未知 CPU'
  if (cpuModel.length > 48) cpuModel = cpuModel.slice(0, 48) + '…'
  const cpuCores = cpuOsInfo.length
  const cpuFreqRaw = siData.cpu?.speed || (cpuOsInfo[0]?.speed / 1000) || 0
  const cpuFreq = cpuFreqRaw ? `${Number(cpuFreqRaw).toFixed(1)} GHz` : '—'

  // ── 内存 ──
  let ramPct = 0, ramUsedG = '0', ramTotG = '0'
  let swpPct = 0, swpUsedG = '0', swpTotG = '0'
  if (siData.mem) {
    const m = siData.mem
    ramPct = m.total ? Math.round(m.active / m.total * 100) : 0
    ramUsedG = (m.active / 1024 ** 3).toFixed(1)
    ramTotG = (m.total / 1024 ** 3).toFixed(1)
    swpPct = m.swaptotal ? Math.round(m.swapused / m.swaptotal * 100) : 0
    swpUsedG = (m.swapused / 1024 ** 3).toFixed(1)
    swpTotG = (m.swaptotal / 1024 ** 3).toFixed(1)
  } else {
    const total = os.totalmem(), used = total - os.freemem()
    ramPct = Math.round(used / total * 100)
    ramUsedG = (used / 1024 ** 3).toFixed(1)
    ramTotG = (total / 1024 ** 3).toFixed(1)
    try {
      const mi = fs.readFileSync('/proc/meminfo', 'utf8')
      const getv = k => parseInt(mi.match(new RegExp(k + ':\\s+(\\d+)'))?.[1] || '0') * 1024
      const st = getv('SwapTotal'), sf = getv('SwapFree')
      swpTotG = (st / 1024 ** 3).toFixed(1)
      swpUsedG = ((st - sf) / 1024 ** 3).toFixed(1)
      swpPct = st ? Math.round((st - sf) / st * 100) : 0
    } catch (_) {}
  }

  // ── 磁盘：优先取云崽所在分区 ──
  let diskPct = 0, diskUsedG = '?', diskTotG = '?', diskMount = ''
  if (siData.fsSize?.length) {
    const cwd = process.cwd().toLowerCase()
    const main = [...siData.fsSize]
      .filter(d => d.size && d.mount && cwd.startsWith(String(d.mount).toLowerCase()))
      .sort((a, b) => String(b.mount).length - String(a.mount).length)[0] ||
      siData.fsSize.find(d => d.mount === '/') ||
      [...siData.fsSize].sort((a, b) => b.size - a.size)[0]
    if (main?.size) {
      diskPct = Math.round(main.used / main.size * 100)
      diskUsedG = (main.used / 1024 ** 3).toFixed(0)
      diskTotG = (main.size / 1024 ** 3).toFixed(0)
      diskMount = main.mount
    }
  }
  if (diskUsedG === '?') {
    try {
      const df = execSync("df / --output=used,size -B1 2>/dev/null | tail -1", { timeout: 3000 })
        .toString().trim().split(/\s+/)
      const u = parseInt(df[0]), t = parseInt(df[1])
      diskUsedG = (u / 1024 ** 3).toFixed(0)
      diskTotG = (t / 1024 ** 3).toFixed(0)
      diskPct = Math.round(u / t * 100)
      diskMount = '/'
    } catch (_) {}
  }

  // ── OS & GPU ──
  let osName = `${os.type()} ${os.release()}`
  let arch = os.arch()
  const gpuName = getGpuName(siData.graphics?.controllers)
  if (siData.osInfo) {
    const o = siData.osInfo
    osName = `${o.distro || ''} ${o.release || ''}`.trim() || osName
    arch = o.arch || arch
  }

  const sysUptime = formatUptime(os.uptime())
  const botUptime = formatUptime(process.uptime())

  const { name: frameworkName, version: frameworkVer } = getFrameworkInfo()
  const pluginVersion = getPluginVersion()
  const npmVer = await getNpmVersion()

  // ── 插件数量 ──
  let pluginCount = '0', jsCount = '0'
  try {
    const pluginsDir = path.resolve(__dirname, '../../../plugins')
    const coreDirs = new Set(['system', 'other', 'example', 'adapter', 'genshin'])
    if (fs.existsSync(pluginsDir)) {
      const pluginFolders = fs.readdirSync(pluginsDir).filter(name => {
        try {
          return fs.statSync(path.join(pluginsDir, name)).isDirectory() && !coreDirs.has(name)
        } catch { return false }
      })
      pluginCount = String(pluginFolders.length)
      const jsPluginDir = path.join(pluginsDir, 'example')
      jsCount = fs.existsSync(jsPluginDir)
        ? String(fs.readdirSync(jsPluginDir).filter(file => file.endsWith('.js')).length)
        : '0'
    }
  } catch (_) {}

  // ── Bot 账号信息 ──
  let friendCount = '—', groupCount = '—', botName = 'Bot', botId = ''
  const selfId = e.self_id || Bot?.uin
  let bot = Bot
  try {
    if (selfId) botId = String(selfId)
    bot = Bot[selfId] || Bot
    friendCount = String(bot?.fl?.size ?? '—')
    groupCount = String(bot?.gl?.size ?? '—')
    botName = bot?.nickname ||
      (await bot?.getLoginInfo?.().catch(() => null))?.nickname || botName
  } catch (_) {}

  // ── 适配器 / 收发消息 ──
  let adapter = '未知适配器', adapterVer = ''
  try {
    const ver = bot?.version || {}
    adapter = ver.app_name || ver.name || bot?.adapter?.name || adapter
    adapterVer = ver.app_version || ver.version || ''
  } catch (_) {}
  const msg = await getMsgStats(botId, bot)

  const now = new Date()
  const dt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  return {
    cpuPct, cpuModel, cpuCores, cpuFreq,
    ramUsedG, ramTotG, ramPct,
    swpUsedG, swpTotG, swpPct,
    diskPct, diskUsedG, diskTotG, diskMount,
    osName, arch, gpuName, sysUptime, botUptime,
    frameworkName, frameworkVer, pluginVersion, npmVer,
    pluginCount, jsCount,
    friendCount, groupCount, botName, botId, adapter, adapterVer, msg,
    nodeVer: process.version,
    dt,
  }
}

// ─── 组装模板数据（滑块 / 网络图均服务端预生成）──────────────
// 柔和低饱和配色（同明度，避免撞色）
const PALETTE = {
  cpu: '#6f9fe8',
  ram: '#e88aa8',
  swap: '#9d8fe0',
  disk: '#e8ac6e',
  warn: '#e07a7a',
  up: '#6f9fe8',
  down: '#e88aa8',
}

// 线性图标（24×24，白色描边）
const ICON_PATHS = {
  recv: '<path d="M12 4v10M7 9l5 5 5-5M5 19.5h14"/>',
  send: '<path d="M20.5 3.5 3.5 10.5l7 3 3 7z M10.5 13.5l10-10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.9-3.9 3.9-6 7.5-6s6.6 2.1 7.5 6"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 19.5c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5M16 4.6a3.4 3.4 0 0 1 0 6.6M18 14.4c1.8.6 3 2.2 3.5 5.1"/>',
  puzzle: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3"/>',
  ram: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 11v2M11 11v2M15 11v2M7 17v3M12 17v3M17 17v3"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  disk: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
  heart: '<path d="M12 20s-7.5-4.5-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.5 12 20 12 20z"/>',
  node: '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M12 8v8M9 10.5l3-2.5 3 2.5"/>',
  box: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M7.5 15v-6h4.5v6M12 9h4.5v6"/>',
  os: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  gpu: '<rect x="2.5" y="7" width="19" height="10" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M15 10.5h3M15 13.5h3M5 17v2.5"/>',
}
const icon = name =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff">${ICON_PATHS[name]}</svg>`
const ICONS = Object.fromEntries(Object.keys(ICON_PATHS).map(k => [k, icon(k)]))

function buildData (d, avatarB64) {
  const avatarHtml = avatarB64
    ? `<img class="avimg" src="${avatarB64}" alt="avatar">`
    : `<div class="avfb">${escHtml(d.botName.charAt(0) || '◍')}</div>`

  const slidersHtml =
    sliderBox(d.cpuPct, PALETTE.cpu, 'cpu', 'CPU', `${d.cpuCores} 核 · ${d.cpuFreq}`) +
    sliderBox(d.ramPct, PALETTE.ram, 'ram', '内存', `${d.ramUsedG} / ${d.ramTotG} GB`) +
    sliderBox(d.swpPct, PALETTE.swap, 'swap', '交换', `${d.swpUsedG} / ${d.swpTotG} GB`) +
    sliderBox(d.diskPct, PALETTE.disk, 'disk', '磁盘', `${d.diskUsedG} / ${d.diskTotG} GB`)

  const pts = state.net
  const last = pts[pts.length - 1]
  const stat = key => {
    if (!pts.length) return { cur: '—', peak: '—', avg: '—' }
    const vals = pts.map(p => p[key])
    return {
      cur: fmtRate(last[key]),
      peak: fmtRate(Math.max(...vals)),
      avg: fmtRate(vals.reduce((a, b) => a + b, 0) / vals.length),
    }
  }

  return {
    tplFile: TPL, pluResPath: _path, saveId: 'status', imgType: 'png',
    avatarHtml, slidersHtml, icons: ICONS, netSvg: buildNetSvg(pts),
    netUp: stat('up'), netDown: stat('down'),
    botName: d.botName, botId: d.botId,
    frameworkName: d.frameworkName, frameworkVer: d.frameworkVer,
    pluginVersion: d.pluginVersion, npmVer: d.npmVer, nodeVer: d.nodeVer,
    adapter: d.adapter, adapterVer: d.adapterVer, msg: d.msg,
    botUptime: d.botUptime, pluginCount: d.pluginCount, jsCount: d.jsCount,
    friendCount: d.friendCount, groupCount: d.groupCount, dt: d.dt,
    osName: d.osName, arch: d.arch, cpuModel: d.cpuModel,
    gpuName: d.gpuName, sysUptime: d.sysUptime,
  }
}

// 控制中心式果冻滑块：胶囊槽 + 彩色液面 + 百分比 + 图标
function sliderBox (pct, col, iconName, label, sub) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0))
  const c = p >= 90 ? PALETTE.warn : col
  const cls = ['sl', p >= 80 ? 'inv' : '', p < 21 ? 'low' : ''].filter(Boolean).join(' ')
  // 液面最低保留一点高度，0% 时也能看出颜色
  const h = p === 0 ? 0 : Math.max(p, 4)
  return `<div class="${cls}" style="--p:${h}%;--c:${c};--c2:${mix(c, '#ffffff', 0.35)}">` +
    `<div class="sl-cap"><div class="sl-fill"></div>` +
    `<div class="sl-pct">${p}<small>%</small></div>` +
    `<div class="sl-icon">${icon(iconName).replace('style="color:#fff"', '')}</div></div>` +
    `<div class="sl-name">${escHtml(label)}</div><div class="sl-sub">${escHtml(sub)}</div></div>`
}

// 网络上下行平滑面积图：固定像素尺寸，不拉伸；带网格、刻度、时间轴、柔光
function buildNetSvg (pts) {
  const W = 726, H = 196
  const L = 64, R = 12, T = 10, B = 26
  const iw = W - L - R, ih = H - T - B
  const font = 'font-size="11" fill="rgba(28,28,50,.5)"'

  if (pts.length < 2) {
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="13" fill="rgba(28,28,50,.55)">` +
      `${si ? '正在采样网络流量，稍后再查看曲线' : '未安装 systeminformation，无法统计网络流量'}</text></svg>`
  }

  const max = niceStep(Math.max(1024, ...pts.map(p => Math.max(p.up, p.down))) * 1.1 / 4) * 4
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = Math.max(1, t1 - t0)
  const xy = key => pts.map(p => [L + (p.t - t0) / span * iw, T + ih - p[key] / max * ih])

  let grid = ''
  const ticks = 4
  for (let i = 0; i <= ticks; i++) {
    const y = T + ih - ih * i / ticks
    grid += `<line x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(28,28,50,${i === 0 ? '.16' : '.07'})" ` +
      `${i === 0 ? '' : 'stroke-dasharray="2 5" stroke-linecap="round"'}/>` +
      `<text x="${L - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" ${font}>${fmtRate(max * i / ticks, true)}</text>`
  }

  let xlab = ''
  for (const f of [0, 0.5, 1]) {
    const x = L + iw * f
    const anchor = f === 0 ? 'start' : f === 1 ? 'end' : 'middle'
    xlab += `<text x="${x.toFixed(1)}" y="${H - 6}" text-anchor="${anchor}" ${font}>${hms(new Date(t0 + span * f))}</text>`
  }

  const series = (key, col, id) => {
    const p = xy(key)
    const line = smoothPath(p)
    const [lx, ly] = p[p.length - 1]
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${col}" stop-opacity=".32"/><stop offset="1" stop-color="${col}" stop-opacity="0"/>` +
      `</linearGradient></defs>` +
      `<path d="${line} L${lx.toFixed(1)},${T + ih} L${L},${T + ih} Z" fill="url(#${id})"/>` +
      `<path d="${line}" fill="none" stroke="${col}" stroke-opacity=".35" stroke-width="7" filter="url(#soft)" stroke-linecap="round"/>` +
      `<path d="${line}" fill="none" stroke="${col}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="9" fill="${col}" fill-opacity=".18"/>` +
      `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4.5" fill="#fff" stroke="${col}" stroke-width="3"/>`
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><filter id="soft" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs>` +
    grid + xlab + series('down', PALETTE.down, 'gDown') + series('up', PALETTE.up, 'gUp') + `</svg>`
}

function mix (a, b, t) {
  const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  return '#' + [0, 1, 2].map(i => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')).join('')
}

// 单调三次插值（Fritsch–Carlson）：曲线平滑且不会冲到 0 以下或越过峰值
function smoothPath (p) {
  const n = p.length
  if (n < 3) return p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const dx = [], s = [], m = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1][0] - p[i][0] || 1e-6
    s[i] = (p[i + 1][1] - p[i][1]) / dx[i]
  }
  m[0] = s[0]
  m[n - 1] = s[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) { m[i] = m[i + 1] = 0; continue }
    const a = m[i] / s[i], b = m[i + 1] / s[i], h = a * a + b * b
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * s[i]; m[i + 1] = t * b * s[i] }
  }
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${(p[i][0] + h).toFixed(1)},${(p[i][1] + m[i] * h).toFixed(1)} ` +
      `${(p[i + 1][0] - h).toFixed(1)},${(p[i + 1][1] - m[i + 1] * h).toFixed(1)} ` +
      `${p[i + 1][0].toFixed(1)},${p[i + 1][1].toFixed(1)}`
  }
  return d
}

// ─── 工具 ─────────────────────────────────────────────────────
// 刻度步长取 1~10 间的整齐值×10^k（按 B/KB/MB 分级），保证四档刻度都是整齐的数
function niceStep (v) {
  const u = [1, 1024, 1024 ** 2, 1024 ** 3].findLast(x => v >= x / 2) || 1
  const n = v / u
  const pow = 10 ** Math.floor(Math.log10(n))
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(x => x * pow >= n) * pow
  return step * u
}
function fmtRate (bytes, short = false) {
  const b = Number(bytes) || 0
  const [v, u] = b >= 1024 ** 3 ? [b / 1024 ** 3, 'GB'] : b >= 1024 ** 2 ? [b / 1024 ** 2, 'MB'] : b >= 1024 ? [b / 1024, 'KB'] : [b, 'B']
  const num = u === 'B' ? Math.round(v) : v >= 100 || (short && Number.isInteger(+v.toFixed(1))) ? v.toFixed(0) : v.toFixed(1)
  return `${num} ${u}/s`
}
function dayKey (d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function hms (d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }
function pad (n) { return String(n).padStart(2, '0') }
function formatUptime (s) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d ? `${d}天${h}时${m}分` : h ? `${h}时${m}分` : `${m}分`
}
function escHtml (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
