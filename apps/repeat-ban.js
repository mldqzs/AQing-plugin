/**
 * 复读禁言 for AQing-plugin（仅支持 NapCat）
 *
 * 功能：
 * - 杀掉所有复读机
 * - 达到阈值后发出警告
 * - 运行逻辑：
 *   警告后继续复读 → 阶梯禁言，禁言时长【群级别持久累加，不因复读链打断而减少】：
 *     本群历史档位为 N，下一个被禁的人 → N+1 分钟，以此类推
 *     只有零点才会将档位归零（CONFIG.dailyReset = true）
 *     档位（banLevel）落盘到 data/repeat-ban.json，重启不丢失
 * - 复读机器人警告语本身也会被禁言
 * - 总开关在锅巴配置（config.repeatBan）中控制，关闭后整功能停用
 * - 管理员可通过「复读禁言 开启/关闭」单独控制本群开关
 * - 主人可通过「设置复读禁言时间 N」设置初始禁言时间（分钟）
 */

import plugin from '../../../lib/plugins/plugin.js'
import fs from 'node:fs'
import yaml from 'yaml'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ─────────────────────────────────────────────
//  可配置项
// ─────────────────────────────────────────────
const CONFIG = {
  /** 连续复读几条后触发警告 */
  warnThreshold: 3,

  /** 警告语 */
  warnText: '再复读我要发飙啦！',

  /** 复读链无新消息后多久自动重置复读链（毫秒），注意：banLevel 不受此影响 */
  expireMs: 5 * 60 * 1000,

  /** 每日零点是否重置各群的禁言档位（banLevel） */
  dailyReset: true,
}

// ─────────────────────────────────────────────
//  总开关读取（锅巴配置 config.repeatBan，热生效）
//  带 mtime 缓存：文件未变动时复用缓存，被锅巴/外部改写后自动重读
// ─────────────────────────────────────────────
const _dir = dirname(fileURLToPath(import.meta.url))
const configPath = join(_dir, '../config/config/config.yaml')

let _cfgCache = null
let _cfgMtime = 0

function loadCfg() {
  try {
    const stat = fs.statSync(configPath)
    if (!_cfgCache || stat.mtimeMs !== _cfgMtime) {
      _cfgCache = yaml.parse(fs.readFileSync(configPath, 'utf8')) || {}
      _cfgMtime = stat.mtimeMs
    }
  } catch (err) {
    logger.error('[复读禁言] 读取配置文件失败:', err)
    _cfgCache = _cfgCache || {}
  }
  return _cfgCache
}

// 写入运行时配置（修改某个键并保存，随后清空缓存以便热生效）
function writeCfg(key, value) {
  let cfg = {}
  try {
    cfg = yaml.parse(fs.readFileSync(configPath, 'utf8')) || {}
  } catch (err) {
    logger.error('[复读禁言] 写入前读取配置失败:', err)
  }
  cfg[key] = value
  fs.writeFileSync(configPath, yaml.stringify(cfg), 'utf8')
  // 失效缓存，下次 loadCfg 重读
  _cfgCache = null
  _cfgMtime = 0
}

// 总开关，未配置时默认开启
function repeatBanEnabled() {
  return loadCfg().repeatBan ?? true
}

// 初始禁言时间（分钟），未配置/非法时默认 1
function repeatBanBaseTime() {
  const t = parseInt(loadCfg().repeatBanTime)
  return Number.isFinite(t) && t > 0 ? t : 1
}

// ─────────────────────────────────────────────
//  消息指纹生成
//  将任意消息段数组序列化为可比较的字符串指纹
//  支持：text / image / face / mface / file /
//        video / record / at / reply / json / xml 等
// ─────────────────────────────────────────────

/**
 * 解析 CQ 码字符串为参数 Map
 * 例：[CQ:image,file=ABC.png,url=https://...] → { file: "ABC.png", url: "https://..." }
 * HTML 实体会被反转义：&amp; → & 、&#91; → [ 、&#93; → ]
 */
function parseCQParams(cqStr) {
  const map = {}
  // 取 CQ:type, 之后的参数串
  const body = cqStr.replace(/^\[CQ:[^,]+,?/, '').replace(/\]$/, '')
  if (!body) return map
  for (const pair of body.split(',')) {
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    const k = pair.slice(0, eq).trim()
    const v = pair.slice(eq + 1)
      .replace(/&amp;/g, '&')
      .replace(/&#91;/g, '[')
      .replace(/&#93;/g, ']')
      .replace(/&#44;/g, ',')
    map[k] = v
  }
  return map
}

/**
 * 从 CQ 码原始字符串（e.toString() 或 raw_message）生成指纹。
 * 优先取 file= 字段（含哈希文件名），其次 url= 去鉴权，最后 stringify 兜底。
 *
 * 适用于 NapCat 走 CQ 码传递、e.message 对象数组字段不全的场景。
 */
function fingerprintFromCQ(raw) {
  const parts = []
  // 匹配所有 CQ 码段
  const cqRe = /\[CQ:(\w+),(.*?)\]/gs
  let last = 0
  let m
  while ((m = cqRe.exec(raw)) !== null) {
    // CQ 码之间的纯文本
    const before = raw.slice(last, m.index).trim()
    if (before) parts.push(`text:${before}`)
    last = m.index + m[0].length

    const type   = m[1]
    const params = parseCQParams(m[0])

    switch (type) {
      case 'image':
      case 'video':
      case 'record': {
        // file= 是含哈希的文件名，如 1FA390DB...png，最可靠
        const key =
          params.file ||                                       // 首选 file=
          (params.url
            ? params.url.split('?')[0].split('/').pop()        // 次选 url 去 token
            : null) ||
          JSON.stringify(params)                               // 兜底
        parts.push(`${type}:${key}`)
        break
      }
      case 'face':
        parts.push(`face:${params.id ?? '?'}`)
        break
      case 'mface':
        parts.push(`mface:${params.emoji_id || params.file || JSON.stringify(params)}`)
        break
      case 'at':
        parts.push(`at:${params.qq ?? 'all'}`)
        break
      case 'reply':
        parts.push(`reply:${params.id ?? ''}`)
        break
      default:
        parts.push(`${type}:${JSON.stringify(params)}`)
    }
  }
  // 末尾纯文本
  const tail = raw.slice(last).trim()
  if (tail) parts.push(`text:${tail}`)

  return parts.join('|')
}

/**
 * 主指纹函数
 *
 * 策略：
 *   1. 优先走 CQ 码路径（e.raw_message / toString），file= 字段最可靠
 *   2. 若拿不到 CQ 原文，回退到 e.message 对象数组
 *   3. 对象数组里的媒体字段，同样优先取 file，次选 file_unique / md5 / url
 */
function buildFingerprint(segs, plain, raw) {
  // ── 路径 1：有 CQ 码原文 ──────────────────────────
  if (raw && raw.includes('[CQ:')) {
    const fp = fingerprintFromCQ(raw)
    if (fp) return fp
  }

  // ── 路径 2：对象数组 ──────────────────────────────
  if (!Array.isArray(segs) || segs.length === 0) {
    return `text:${(plain || '').trim()}`
  }

  const parts = []

  for (const seg of segs) {
    switch (seg.type) {

      case 'text': {
        const t = (seg.data?.text || '').trim()
        if (t) parts.push(`text:${t}`)
        break
      }

      case 'face':
        parts.push(`face:${seg.data?.id ?? '?'}`)
        break

      case 'mface': {
        const id =
          seg.data?.emoji_id ||
          seg.data?.file ||
          (seg.data?.url
            ? seg.data.url.split('?')[0].split('/').pop()
            : null) ||
          JSON.stringify(seg.data ?? {})
        parts.push(`mface:${id}`)
        break
      }

      case 'image':
      case 'video':
      case 'record': {
        const d = seg.data ?? {}
        const key =
          d.file ||                                            // 首选 file=（含哈希文件名）
          d.md5 ||                                             // md5
          d.file_unique ||                                     // NapCat 专有
          (d.url
            ? d.url.split('?')[0].split('/').pop()             // url 去 token
            : null) ||
          JSON.stringify(d)                                    // 兜底
        parts.push(`${seg.type}:${key}`)
        break
      }

      case 'file': {
        const d    = seg.data ?? {}
        const name = d.name || ''
        const size = d.size ?? ''
        const fid  = d.file_id || d.file || d.id || ''
        parts.push(`file:${fid}:${name}:${size}`)
        break
      }

      case 'json': {
        try {
          const obj = JSON.parse(seg.data?.data || '{}')
          const title =
            obj?.meta?.detail_1?.title ||
            obj?.meta?.news?.title ||
            obj?.prompt ||
            seg.data?.data
          parts.push(`json:${title}`)
        } catch {
          parts.push(`json:${seg.data?.data}`)
        }
        break
      }

      case 'xml': {
        const raw2       = seg.data?.data || ''
        const urlMatch   = raw2.match(/url="([^"]+)"/)
        const titleMatch = raw2.match(/<title[^>]*>([^<]+)<\/title>/)
        parts.push(`xml:${urlMatch?.[1] || titleMatch?.[1] || raw2.slice(0, 80)}`)
        break
      }

      case 'at':
        parts.push(`at:${seg.data?.qq ?? 'all'}`)
        break

      case 'reply':
        parts.push(`reply:${seg.data?.id ?? ''}`)
        break

      default:
        parts.push(`${seg.type}:${JSON.stringify(seg.data ?? {})}`)
        break
    }
  }

  return parts.join('|') || `text:${(plain || '').trim()}` || `noop:${Date.now()}`
}

// ─────────────────────────────────────────────
//  群状态管理
//
//  groupMeta[groupId] = {
//    banLevel  : number,   // 【持久】本群累计禁言次数，不因复读链打断归零，零点归零
//    enabled   : boolean,  // 本群复读禁言开关，默认 true
//  }
//
//  chainState[groupId] = {
//    fingerprint : string,   // 当前复读链指纹
//    count       : number,   // 链内累计条数
//    warned      : boolean,  // 是否已发出警告
//    timer       : TimeoutId // 无新消息后自动清除复读链
//  }
// ─────────────────────────────────────────────
// groupMeta 持久化文件：重启后 banLevel / enabled 不丢失
const dataDir  = join(_dir, '../data')
const metaPath = join(dataDir, 'repeat-ban.json')

function loadMeta() {
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8')) || {}
    }
  } catch (err) {
    logger.error('[复读禁言] 读取持久化档位失败:', err)
  }
  return {}
}

// 落盘（防抖：合并短时间内的多次写入，降低磁盘压力）
let _saveTimer = null
function saveMeta() {
  if (_saveTimer) return
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
      fs.writeFileSync(metaPath, JSON.stringify(groupMeta), 'utf8')
    } catch (err) {
      logger.error('[复读禁言] 写入持久化档位失败:', err)
    }
  }, 1000)
}

const groupMeta  = loadMeta()   // 持久档位 + 开关（启动时从磁盘恢复）
const chainState = {}           // 复读链（打断即重置，无需持久化）

// ── groupMeta 辅助 ────────────────────────────
function getMeta(groupId) {
  if (!groupMeta[groupId]) {
    groupMeta[groupId] = { banLevel: 0, enabled: true }
  }
  return groupMeta[groupId]
}

// ── chainState 辅助 ───────────────────────────
function getChain(groupId) {
  return chainState[groupId] || null
}

function resetChain(groupId) {
  if (chainState[groupId]?.timer) clearTimeout(chainState[groupId].timer)
  delete chainState[groupId]
}

function touchChainTimer(groupId) {
  if (chainState[groupId]?.timer) clearTimeout(chainState[groupId].timer)
  chainState[groupId].timer = setTimeout(
    () => resetChain(groupId),
    CONFIG.expireMs
  )
}

// ─────────────────────────────────────────────
//  每日零点重置 banLevel
// ─────────────────────────────────────────────

function msUntilMidnight() {
  const now  = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return next - now
}

function scheduleDailyReset() {
  if (!CONFIG.dailyReset) return
  setTimeout(() => {
    for (const id of Object.keys(groupMeta)) {
      if (groupMeta[id]) groupMeta[id].banLevel = 0
    }
    saveMeta()
    logger.info('[复读禁言] 零点已重置所有群禁言档位')
    scheduleDailyReset()
  }, msUntilMidnight())
}

scheduleDailyReset()

// ─────────────────────────────────────────────
//  插件主体
// ─────────────────────────────────────────────
export class RepeatBanPlugin extends plugin {
  constructor() {
    super({
      name: '复读禁言',
      dsc: '复读禁言',
      event: 'message.group',
      priority: 500,
      rule: [
        {
          // 开关命令：「复读禁言 开启」或「复读禁言 关闭」
          reg: '^复读禁言\\s*(开启|关闭|on|off)$',
          fnc: 'toggleSwitch',
          permission: 'admin',  // 仅管理员/群主可操作
        },
        {
          // 设置初始禁言时间：「设置复读禁言时间 5」（分钟）
          reg: '^[/#]?设置复读禁言时间\\s*\\d+$',
          fnc: 'setBanTime',
          permission: 'master',  // 仅机器人主人可操作
        },
        {
          // 监听所有群消息
          reg: '^[\\s\\S]*$',
          fnc: 'handleMessage',
          permission: 'everyone',
        },
      ],
    })
  }

  // ── 开关命令处理 ──────────────────────────────
  async toggleSwitch(e) {
    // 总开关关闭时，单群开关命令无意义
    if (!repeatBanEnabled()) {
      await e.reply('复读禁言总开关已关闭（可在锅巴配置中开启）', true)
      return false
    }

    const groupId = String(e.group_id)
    const meta    = getMeta(groupId)
    const arg     = e.msg.trim().replace(/^复读禁言\s*/, '').toLowerCase()
    const turnOn  = arg === '开启' || arg === 'on'

    meta.enabled = turnOn
    saveMeta()
    await e.reply(
      turnOn
        ? '复读禁言已开启，复读机们小心了！'
        : '复读禁言已关闭，复读随意～',
      true
    )
    return false
  }

  // ── 设置初始禁言时间 ──────────────────────────
  async setBanTime(e) {
    const m = e.msg.match(/(\d+)\s*$/)
    const minutes = m ? parseInt(m[1]) : NaN
    if (!Number.isFinite(minutes) || minutes <= 0) {
      await e.reply('请输入一个大于 0 的整数（分钟），例如：设置复读禁言时间 5', true)
      return true   // 已处理，消费掉该指令，避免落入下方复读监听
    }
    try {
      writeCfg('repeatBanTime', minutes)
      await e.reply(`复读初始禁言时间已设为 ${minutes} 分钟（之后每次阶梯 +1 分钟）`, true)
    } catch (err) {
      logger.error('[复读禁言] 设置初始禁言时间失败:', err)
      await e.reply('设置失败，请检查配置文件权限', true)
    }
    return true   // 已处理，消费掉该指令，避免落入下方复读监听
  }

  // ── 消息监听 ──────────────────────────────────
  async handleMessage(e) {
    if (!e.group_id) return false

    // 总开关关闭时整功能停用
    if (!repeatBanEnabled()) return false

    const groupId = String(e.group_id)
    const userId  = String(e.user_id)
    const selfId  = String(e.self_id)

    // 忽略机器人自身的消息
    if (userId === selfId) return false

    // 本群开关关闭时直接跳过
    const meta = getMeta(groupId)
    if (!meta.enabled) return false

    // 生成当前消息指纹
    const fingerprint = buildFingerprint(e.message, e.msg, e.raw_message)
    if (!fingerprint) return false

    const chain = getChain(groupId)

    // ── 情况 A：复读了机器人的警告语 ─────────────
    if (chain?.warned && fingerprint === `text:${CONFIG.warnText}`) {
      await this._doBan(e, groupId, userId, meta, 'bot')
      touchChainTimer(groupId)
      return false
    }

    // ── 情况 B：与当前链不同 → 打断，重新开链 ────
    if (!chain || chain.fingerprint !== fingerprint) {
      resetChain(groupId)
      chainState[groupId] = {
        fingerprint,
        count: 1,
        warned: false,
        timer: null,
      }
      touchChainTimer(groupId)
      return false
    }

    // ── 情况 C：继续复读同一内容 ─────────────────
    chain.count += 1
    touchChainTimer(groupId)

    // 达到阈值且未警告 → 发出警告
    if (chain.count >= CONFIG.warnThreshold && !chain.warned) {
      chain.warned = true
      await e.reply(CONFIG.warnText, false)
      return false
    }

    // 已警告 → 禁言
    if (chain.warned) {
      await this._doBan(e, groupId, userId, meta, 'repeat')
    }

    return false
  }

  /**
   * 群持久阶梯禁言
   *
   * banLevel 存在 groupMeta 中，复读链打断不归零，零点才归零。
   * 每次调用：meta.banLevel +1 → 禁言时长 = 初始禁言时间 + (banLevel - 1) 分钟。
   *
   * @param {string} reason - "repeat" | "bot"
   */
  async _doBan(e, groupId, userId, meta, reason = 'repeat') {
    meta.banLevel += 1
    saveMeta()
    // 初始禁言时间可在锅巴配置，之后每次阶梯 +1 分钟
    const banMinutes = repeatBanBaseTime() + (meta.banLevel - 1)
    const banSeconds = banMinutes * 60

    const tipText = reason === 'bot'
      ? `连我的话也敢复读？给我安静 ${banMinutes} 分钟！`
      : `复读机是吧，安静 ${banMinutes} 分钟！`

    try {
      await e.reply(tipText, false)
      await e.group.muteMember(Number(userId), banSeconds)
    } catch (err) {
      logger.error(`[复读禁言] 禁言失败 group=${groupId} user=${userId}`, err)
      await e.reply('可恶，如果我有神拳…', false)
    }
  }
}
