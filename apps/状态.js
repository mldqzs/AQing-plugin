/**
 * AQ：可爱状态 — 猫爪果冻风格的服务器/机器人状态图
 * 触发：#状态 / #status / #云崽状态 / #zt / #阿晴状态
 * 开关：config.yaml 的 kawaiiStatus（或锅巴 → 可爱状态）
 *   - 开启：#状态 由阿晴出可爱状态图，并拦截云崽本体的「状态统计」
 *   - 关闭：#状态 交还给云崽本体，阿晴不接管
 * 主人可直接发「#开启可爱状态 / #关闭可爱状态」热切换。
 * 数据用 systeminformation（缺失则自动回退 os 模块）。
 */

import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import setting from '../utils/setting.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import http from 'http'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let si = null
try { si = (await import('systeminformation')).default } catch (_) {}

const NET_MAX = 30
const netHist = { up: [], down: [] }

const _path = process.cwd().replace(/\\/g, '/')
const TPL = './plugins/AQing-plugin/resources/html/status/status.html'

// 读取「可爱状态」开关
const isOn = () => setting.getConfig('config')?.kawaiiStatus === true

// ─── 背景图（每次触发重新拉取，URL 本身随机返回不同图片）────
async function getBg () {
  try { return await fetchB64('https://t.mwm.moe/pc') } catch (_) { return null }
}

// ─── 通用 HTTP/HTTPS 下载转 base64（支持重定向）──────────────
function fetchB64 (url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const get = (u, left) => {
      const isHttps = u.startsWith('https')
      const mod = isHttps ? https : http
      const req = mod.get(u, { timeout: 8000 }, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && left > 0) {
          res.resume()
          return get(res.headers.location, left - 1)
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const buf = Buffer.concat(chunks)
          const mime = res.headers['content-type']?.split(';')[0] || 'image/jpeg'
          resolve(`data:${mime};base64,${buf.toString('base64')}`)
        })
        res.on('error', reject)
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    }
    get(url, maxRedirects)
  })
}

// ─── 插件类（单一导出）────────────────────────────────────────
export class KawaiiStatus extends plugin {
  constructor () {
    super({
      name: 'AQ：可爱状态',
      dsc: '猫爪果冻风格状态图',
      event: 'message',
      priority: 500, // 抢在云崽本体「状态统计」(默认5000) 之前
      rule: [
        { reg: '^#?(状态|status|云崽状态|zt|阿晴状态)$', fnc: 'send', permission: 'all' },
        { reg: '^#?(开启|开|打开|关闭|关)可爱状态$', fnc: 'toggle' },
      ]
    })
  }

  // 主人热切换开关
  async toggle (e) {
    if (!e.isMaster) { await e.reply('只有主人能开关可爱状态哦~ ฅ(>﹏<)ฅ'); return true }
    const on = /开启|开|打开/.test(e.msg)
    const cur = setting.getConfig('config') || {}
    setting.setConfig('config', { ...cur, kawaiiStatus: on })
    await e.reply(on
      ? '可爱状态已开启~ 以后发「#状态」就由我来出图啦 ฅ^•ﻌ•^ฅ'
      : '可爱状态已关闭~ 「#状态」交还给云崽本体啦 (=^･ω･^=)')
    return true
  }

  async send (e) {
    // 开关关闭：不接管，交还给云崽本体的「状态统计」
    if (!isOn()) return false

    await e.reply('正在查服务器状态… ฅ^•ﻌ•^ฅ')
    try {
      const [d, avatarB64, bgB64] = await Promise.all([
        collect(e),
        getAvatar(e),
        getBg(),
      ])
      updateNet(d.net)
      const data = buildData(d, avatarB64, bgB64)
      const img = await puppeteer.screenshot('status', data)
      if (img) await e.reply(img)
      else await e.reply('出图失败了，待会再试试吧 ฅ(>﹏<)ฅ')
    } catch (err) {
      logger.error('[AQ可爱状态]', err)
      await e.reply(`查状态摔了一跤：${err.message}`)
    }
    return true // 已接管，拦截本体状态
  }
}

// ─── 头像 ─────────────────────────────────────────────────────
async function getAvatar (e) {
  try {
    const selfId = e.self_id || Bot?.uin || Bot?.account?.uin
    if (!selfId) return null
    return await fetchB64(`https://q1.qlogo.cn/g?b=qq&nk=${selfId}&s=640`)
  } catch (_) { return null }
}

// ─── 数据收集 ─────────────────────────────────────────────────
async function collect (e) {
  let siData = {}
  if (si) {
    try {
      siData = await si.get({
        currentLoad: 'currentLoad',
        cpu: 'speed,cores,physicalCores,manufacturer,brand',
        mem: 'total,free,active,swaptotal,swapused',
        fsSize: 'fs,type,size,used,available,use,mount',
        networkStats: 'rx_sec,tx_sec',
        osInfo: 'distro,release,arch',
        graphics: 'controllers',
      })
    } catch (err) {
      logger.warn('[AQ可爱状态] si.get() 失败，回退到 os 模块:', err.message)
    }
  }

  // ── CPU ──
  const cpuOsInfo = os.cpus()
  let cpuModel = cpuOsInfo[0]?.model?.trim() || 'The Emperor\'s New CPU'
  if (cpuModel.length > 40) cpuModel = cpuModel.slice(0, 40) + '…'
  const cpuCores = cpuOsInfo.length

  const cpuFreqRaw = siData.cpu?.speed || (cpuOsInfo[0]?.speed / 1000) || 0
  const cpuFreq = cpuFreqRaw ? `${Number(cpuFreqRaw).toFixed(1)} GHz` : '—'

  let cpuPct = 0
  if (siData.currentLoad?.currentLoad != null) {
    cpuPct = Math.round(siData.currentLoad.currentLoad)
  } else {
    cpuPct = await new Promise(res => {
      const s1 = os.cpus().map(c => c.times)
      setTimeout(() => {
        const s2 = os.cpus().map(c => c.times)
        let idle = 0, total = 0
        s2.forEach((t, i) => {
          const dU = t.user - s1[i].user, dS = t.sys - s1[i].sys
          const dI = t.irq - s1[i].irq, dIdle = t.idle - s1[i].idle
          idle += dIdle; total += dU + dS + dI + dIdle
        })
        res(Math.round((1 - idle / total) * 100))
      }, 300)
    })
  }

  // ── 内存 ──
  let ramPct = 0, ramUsedG = '0', ramTotG = '0'
  let swpPct = 0, swpUsedM = 0, swpTotM = 0
  if (siData.mem) {
    const m = siData.mem
    ramPct = m.total ? Math.round(m.active / m.total * 100) : 0
    ramUsedG = (m.active / 1024 ** 3).toFixed(2)
    ramTotG = (m.total / 1024 ** 3).toFixed(2)
    swpPct = m.swaptotal ? Math.round(m.swapused / m.swaptotal * 100) : 0
    swpUsedM = Math.round(m.swapused / 1024 ** 2)
    swpTotM = Math.round(m.swaptotal / 1024 ** 2)
  } else {
    const total = os.totalmem(), used = total - os.freemem()
    ramPct = Math.round(used / total * 100)
    ramUsedG = (used / 1024 ** 3).toFixed(2)
    ramTotG = (total / 1024 ** 3).toFixed(2)
    try {
      const mi = fs.readFileSync('/proc/meminfo', 'utf8')
      const getv = k => parseInt(mi.match(new RegExp(k + ':\\s+(\\d+)'))?.[1] || '0') * 1024
      const st = getv('SwapTotal'), sf = getv('SwapFree')
      swpTotM = Math.round(st / 1024 ** 2)
      swpUsedM = Math.round((st - sf) / 1024 ** 2)
      swpPct = st ? Math.round((st - sf) / st * 100) : 0
    } catch (_) {}
  }

  // ── 磁盘 ──
  let diskPct = 0, diskUsedG = '?', diskTotG = '?'
  if (siData.fsSize?.length) {
    const main = siData.fsSize.find(d => d.mount === '/') ||
                 siData.fsSize.sort((a, b) => b.size - a.size)[0]
    if (main?.size) {
      diskPct = Math.round(main.used / main.size * 100)
      diskUsedG = (main.used / 1024 ** 3).toFixed(2)
      diskTotG = (main.size / 1024 ** 3).toFixed(2)
    }
  }
  if (diskUsedG === '?') {
    try {
      const df = execSync("df / --output=used,size -B1 2>/dev/null | tail -1", { timeout: 3000 })
        .toString().trim().split(/\s+/)
      const u = parseInt(df[0]), t = parseInt(df[1])
      diskUsedG = (u / 1024 ** 3).toFixed(2)
      diskTotG = (t / 1024 ** 3).toFixed(2)
      diskPct = Math.round(u / t * 100)
    } catch (_) {}
  }

  // ── 网络 ──
  let netUpB = 0, netDnB = 0
  if (siData.networkStats?.length) {
    siData.networkStats.forEach(n => {
      netUpB += n.tx_sec || 0
      netDnB += n.rx_sec || 0
    })
  }
  const fmtNet = bytes => {
    if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(2) + ' MB'
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return Math.round(bytes) + ' B'
  }
  const netUp = fmtNet(netUpB)
  const netDn = fmtNet(netDnB)
  const netUpKB = (netUpB / 1024).toFixed(2)
  const netDnKB = (netDnB / 1024).toFixed(2)

  // ── OS & GPU ──
  let osName = `${os.type()} ${os.release()}`
  let arch = os.arch()
  let gpuName = "The Emperor's New GPU"
  if (siData.osInfo) {
    const o = siData.osInfo
    osName = `${o.distro || ''} ${o.release || ''}`.trim() || osName
    arch = o.arch || arch
  }
  if (siData.graphics?.controllers?.[0]?.model) {
    gpuName = siData.graphics.controllers[0].model
  }

  const sysUptime = formatUptime(os.uptime())
  const botUptime = formatUptime(process.uptime())

  // ── Yunzai 版本 ──
  let yunzaiVer = 'v3.x'
  for (const rel of ['../../package.json', '../../../package.json']) {
    try {
      const p = path.resolve(__dirname, rel)
      if (fs.existsSync(p)) {
        yunzaiVer = 'v' + JSON.parse(fs.readFileSync(p, 'utf8')).version
        break
      }
    } catch (_) {}
  }

  // ── 插件数量 ──
  let pluginCount = '0', jsCount = '0'
  try {
    const pluginsDir = path.resolve(__dirname, '../../../plugins')
    const excludedDirs = ['example', 'genshin', 'other', 'system', 'bin', 'adapter']
    if (fs.existsSync(pluginsDir)) {
      const pluginFolders = fs.readdirSync(pluginsDir).filter(name => {
        try {
          return fs.statSync(path.join(pluginsDir, name)).isDirectory() &&
                 !excludedDirs.includes(name)
        } catch { return false }
      })
      pluginCount = String(pluginFolders.length)
      const exampleDir = path.join(pluginsDir, 'example')
      jsCount = fs.existsSync(exampleDir)
        ? String(fs.readdirSync(exampleDir).filter(f => f.endsWith('.js')).length)
        : '0'
    }
  } catch (_) {}

  // ── Bot 账号信息 ──
  let friendCount = '—', groupCount = '—', botName = 'Bot', botId = ''
  try {
    const selfId = e.self_id || Bot?.uin
    if (selfId) botId = String(selfId)
    const bot = Bot[selfId] || Bot
    friendCount = String(bot?.fl?.size ?? '—')
    groupCount = String(bot?.gl?.size ?? '—')
    botName = bot?.nickname ||
      (await bot?.getLoginInfo?.().catch(() => null))?.nickname || botName
  } catch (_) {}

  // ── 适配器 / 收发消息 ──
  let adapter = 'NapCat.Onebot', adapterVer = '', msgSent = '0', msgRecv = '0'
  try {
    const uin = e.self_id || Bot?.uin || ''
    const bot = Bot[uin] || Bot
    const ver = bot?.version || {}
    adapter = ver.app_name || ver.name || bot?.adapter?.name || adapter
    adapterVer = ver.app_version || ver.version || ''
    const rSent = uin ? await redis.get(`Yz:count:send:msg:bot:${uin}:total`).catch(() => null) : null
    const rRecv = uin ? await redis.get(`Yz:count:receive:msg:bot:${uin}:total`).catch(() => null) : null
    msgSent = rSent ? String(parseInt(rSent)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      : String(bot?.stat?.sent_msg_cnt ?? 0)
    msgRecv = rRecv ? String(parseInt(rRecv)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      : String(bot?.stat?.recv_msg_cnt ?? 0)
  } catch (_) {}

  const now = new Date()
  const dt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  return {
    cpuPct, cpuModel, cpuCores, cpuFreq,
    ramUsedG, ramTotG, ramPct,
    swpUsedM, swpTotM, swpPct,
    diskPct, diskUsedG, diskTotG,
    net: { up: netUp, dn: netDn, upKB: parseFloat(netUpKB), dnKB: parseFloat(netDnKB) },
    osName, arch, gpuName, sysUptime, botUptime,
    yunzaiVer, pluginCount, jsCount,
    friendCount, groupCount, botName, botId, adapter, adapterVer, msgSent, msgRecv,
    nodeVer: process.version,
    dt,
  }
}

function updateNet ({ upKB, dnKB }) {
  netHist.up.push(parseFloat(upKB) || 0)
  netHist.down.push(parseFloat(dnKB) || 0)
  if (netHist.up.length > NET_MAX) { netHist.up.shift(); netHist.down.shift() }
}


// ─── 组装模板数据（圆环 / 网络图均服务端预生成 SVG）──────────
function buildData (d, avatarB64, bgB64) {
  const col = pct => pct > 85 ? '#ff8fb3' : pct > 60 ? '#ffb27a' : null
  const cpuCol = col(d.cpuPct) || '#5fc8f8'
  const ramCol = col(d.ramPct) || '#ff86c8'
  const swpCol = col(d.swpPct) || '#b69bff'
  const diskCol = col(d.diskPct) || '#ffac6b'

  const bgStyle = bgB64
    ? `background-image:url('${bgB64}');`
    : `background:linear-gradient(160deg,#cfe0ff 0%,#e6d6ff 50%,#ffd9ec 100%);`

  const avatarHtml = avatarB64
    ? `<img class="avimg" src="${avatarB64}" alt="av">`
    : `<div class="avfb">${escHtml(d.botName.charAt(0) || '◍')}</div>`

  // 圆环（三枚）
  const ringsHtml =
    ringBox(d.cpuPct, cpuCol, 'rgba(95,200,248,.2)', '🧠 CPU', d.cpuFreq) +
    ringBox(d.ramPct, ramCol, 'rgba(255,134,200,.2)', '🍡 RAM', `${d.ramUsedG}/${d.ramTotG}G`) +
    ringBox(d.swpPct, swpCol, 'rgba(182,155,255,.2)', '💤 SWAP', `${d.swpUsedM}/${d.swpTotM}M`)

  // 网络折线
  const netSvg = buildNetSvg(
    netHist.up.length ? netHist.up : [0],
    netHist.down.length ? netHist.down : [0]
  )

  // 随机问候 & 涂鸦，避免每次出图都是同一套模板感
  const pick = a => a[Math.floor(Math.random() * a.length)]
  const greet = pick([
    '今天也元气满满哒~', '一切正常，喵呜~', '服务器乖乖运行中~',
    '状态良好，继续冲鸭!', '在线摸鱼ing…开玩笑啦~', '嗯哼，我很好哦~'
  ])
  const kao = pick(['ฅ^•ﻌ•^ฅ', '(=^･ω･^=)', '=^._.^=', '(｡･ω･｡)', 'ฅ(՞•ﻌ•՞)ฅ', 'ﾉ(´ω｀*)'])
  const doo = ['🌸', '✨', '🐾', '💗', '⭐', '🌷', '🫧', '🍓', '🐱', '🍰'].sort(() => Math.random() - 0.5)

  // 磁盘条尾部爪印位置
  const diskPawLeft = `max(4px, calc(${d.diskPct}% - 14px))`

  return {
    tplFile: TPL, pluResPath: _path, saveId: 'status', imgType: 'png',
    bgStyle, avatarHtml, ringsHtml, netSvg,
    botName: d.botName, botId: d.botId,
    yunzaiVer: d.yunzaiVer, adapter: d.adapter, adapterVer: d.adapterVer,
    botUptime: d.botUptime, pluginCount: d.pluginCount, jsCount: d.jsCount,
    friendCount: d.friendCount, groupCount: d.groupCount, dt: d.dt,
    diskUsedG: d.diskUsedG, diskTotG: d.diskTotG, diskPct: d.diskPct, diskColor: diskCol, diskPawLeft,
    netUp: d.net.up, netDn: d.net.dn,
    osName: d.osName, arch: d.arch, cpuModel: d.cpuModel, cpuCores: d.cpuCores, cpuFreq: d.cpuFreq,
    gpuName: d.gpuName, nodeVer: d.nodeVer, msgRecv: d.msgRecv, msgSent: d.msgSent, sysUptime: d.sysUptime,
    greet, kao, d1: doo[0], d2: doo[1], d3: doo[2], d4: doo[3], d5: doo[4]
  }
}

// 单枚圆环（含猫爪 + 百分比），sz=150
function ringBox (pct, col, track, label, sub) {
  const sz = 150, sw = sz * 0.088
  const r = sz * 0.375, cx = sz / 2, cy = sz / 2, c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100)
  const svg =
    `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,.5)" stroke="${track}" stroke-width="${sw}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" ` +
    `stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" stroke-linecap="round" ` +
    `transform="rotate(-90 ${cx} ${cy})"/>` +
    pawSvg(cx, cy, col + '48', sz * 0.011) +
    `<text x="${cx}" y="${cy + sz * 0.085}" text-anchor="middle" font-family="sans-serif" ` +
    `font-size="${(sz * 0.21).toFixed(0)}" font-weight="900" fill="${col}">${pct}%</text>` +
    `</svg>`
  return `<div class="rbox">${svg}<div class="rlbl">${escHtml(label)}</div><div class="rsub">${escHtml(sub)}</div></div>`
}

// 猫爪（圆环中心淡印）
function pawSvg (cx, cy, c, sc) {
  return `<g transform="translate(${cx},${cy}) scale(${sc})">` +
    `<ellipse cx="0" cy="3" rx="7" ry="5.5" fill="${c}" opacity=".85"/>` +
    `<ellipse cx="-7" cy="-4" rx="3.5" ry="2.8" fill="${c}" opacity=".75"/>` +
    `<ellipse cx="0" cy="-7" rx="3.5" ry="2.8" fill="${c}" opacity=".75"/>` +
    `<ellipse cx="7" cy="-4" rx="3.5" ry="2.8" fill="${c}" opacity=".75"/></g>`
}

// 网络上下行面积折线（viewBox 随容器拉伸）
function buildNetSvg (ups, dns) {
  const W = 558, H = 86
  const mx = Math.max(1, ...ups, ...dns)
  const line = arr => arr.map((v, i) => {
    const x = (arr.length > 1 ? (i / (arr.length - 1)) * W : W)
    const y = H - (v / mx) * (H - 8)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const area = (arr, stroke, fill) => {
    const p = line(arr)
    return `<polygon points="0,${H} ${p} ${W},${H}" fill="${fill}"/>` +
      `<polyline points="${p}" fill="none" stroke="${stroke}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none">` +
    area(dns, '#ff86c8', 'rgba(255,134,200,.16)') +
    area(ups, '#5fc8f8', 'rgba(95,200,248,.16)') +
    `</svg>`
}

// ─── 工具 ─────────────────────────────────────────────────────
function pad (n) { return String(n).padStart(2, '0') }
function formatUptime (s) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${d}天${pad(h)}时${pad(m)}分`
}
function escHtml (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
