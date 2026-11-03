import plugin from '../../../lib/plugins/plugin.js'
import fs from 'node:fs'
import Y from '../Yaml/y.js'

/*
 * 涩图打分
 * - 支持两个打分接口，用 PROVIDER 切换（锅巴有下拉框，热生效）：
 *     baidu       百度图片审核（默认，真人照片较准）
 *     sightengine Sightengine（区分插画/真人并分级，二次元更准，推荐）
 * - key 均存于 config/config/spdf.yaml，支持锅巴/手动修改、热生效
 * - 直接 REST 调用，免 SDK 依赖
 */

const DEF_PATH = './plugins/AQing-plugin/config/defSet_config/spdf.yaml'
const CFG_PATH = './plugins/AQing-plugin/config/config/spdf.yaml'

// 用户配置不在仓库内，首次运行从默认配置生成
function ensureCfg() {
  try {
    if (!fs.existsSync(CFG_PATH)) {
      const dir = './plugins/AQing-plugin/config/config'
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.copyFileSync(DEF_PATH, CFG_PATH)
    }
  } catch (err) {
    logger.error(`[涩图打分] 初始化配置失败：${err?.message || err}`)
  }
}
ensureCfg()

// 实时读取，锅巴/手动改动即时生效（无需重启）
const getCfg = (key) => new Y(CFG_PATH).get(key)

// key 是否仍是占位默认值
const isPlaceholder = (v) => !v || /^你的/.test(String(v))

/* ───────────── 百度图片审核 ───────────── */

async function getBaiduToken() {
  const ak = getCfg('API_KEY')
  const sk = getCfg('SECRET_KEY')
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(ak)}&client_secret=${encodeURIComponent(sk)}`
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error_description || data.error || '获取百度 access_token 失败，请检查 API Key / Secret Key')
  return data.access_token
}

// 返回统一结构 { ok, score, error }
async function scoreByBaidu(imgUrl) {
  const token = await getBaiduToken()
  const url = `https://aip.baidubce.com/rest/2.0/solution/v1/img_censor/v2/user_defined?access_token=${token}`
  const body = new URLSearchParams({ imgUrl })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  const data = await res.json()
  if (data.error_code == 14) return { ok: false, error: 'IAM 认证失败，请确认百度 API Key / Secret Key 正确。' }
  if (data.error_code == 18) return { ok: false, error: '触发百度 QPS 限制；可能是请求过快，或未在控制台开通「内容审核-图像」资源（开通后需≥15分钟生效）。' }
  if (data.error_code) return { ok: false, error: `百度审核失败：${data.error_msg || data.error_code}` }

  let score = 0
  if (data.conclusionType == 2 || data.conclusionType == 3) {
    const arr = (data.data || []).map(d => d.probability * 1).filter(p => p > 0.00001)
    score = (arr.length ? Math.max(...arr) : 0) * 100
  }
  return { ok: true, score }
}

/* ───────────── Sightengine（nudity-2.1） ───────────── */

// 把分级概率加权成 0~100 涩度。各档权重按「实际涩度」校准，
// 低档（轻微暗示）权重压得很低，避免泳装/事业线就被判成「涩」：
//   mildly_suggestive 露事业线/泳装/短裙  → 0.10（基本算清水）
//   suggestive        艺术裸体/姿势示意    → 0.25
//   very_suggestive   内衣/未露点的脱衣    → 0.45
//   erotica           露胸/臀/私处         → 0.75
//   sexual_display    露性器               → 0.90
//   sexual_activity   性行为               → 1.00
// 各档互斥且与 none 合计约为 1，故结果相当于加权平均（none 权重 0）。
// 大致映射：泳装≈10% / 内衣≈45% / 露点≈75% / 露骨≈90%+
// 这些权重可在锅巴「涩涩配置 → 涩度权重」里调，留空则用下面默认值。
const DEFAULT_WEIGHTS = {
  sexual_activity: 1.0,
  sexual_display: 0.9,
  erotica: 0.75,
  very_suggestive: 0.45,
  suggestive: 0.25,
  mildly_suggestive: 0.1,
}
function calcSightengineScore(nudity) {
  if (!nudity) return 0
  const userW = getCfg('weights') || {}
  let s = 0
  // 只按已知档位累加，用户配置缺省的档位回退到默认值
  for (const k in DEFAULT_WEIGHTS) {
    const w = userW[k] === undefined || userW[k] === null ? DEFAULT_WEIGHTS[k] : Number(userW[k])
    s += (Number(nudity[k]) || 0) * (Number.isFinite(w) ? w : DEFAULT_WEIGHTS[k])
  }
  return Math.max(0, Math.min(100, s * 100))
}

async function scoreBySightengine(imgUrl) {
  const apiUser = getCfg('API_USER')
  const apiSecret = getCfg('API_SECRET')
  const url = `https://api.sightengine.com/1.0/check.json?url=${encodeURIComponent(imgUrl)}&models=nudity-2.1&api_user=${encodeURIComponent(apiUser)}&api_secret=${encodeURIComponent(apiSecret)}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'success') {
    const err = data?.error || {}
    const msg = err.message || err.type || '未知错误'
    let hint = ''
    if (err.type === 'credentials_error') {
      hint = '\n→ API user / API secret 不正确，请检查复制是否完整（注意别把网页上的「REVEAL」按钮文字也一起复制进来）'
    } else if (err.type === 'usage_limit' || err.type === 'plan_limit') {
      hint = '\n→ 免费额度已用尽（2000次/月、500次/天），请等额度重置或升级套餐'
    }
    return { ok: false, error: `${msg}${hint}` }
  }
  return { ok: true, score: calcSightengineScore(data.nudity) }
}

/* ───────────── 接口注册表 ───────────── */

const PROVIDERS = {
  baidu: {
    label: '百度图片审核',
    ready: () => !(isPlaceholder(getCfg('APP_ID')) || isPlaceholder(getCfg('API_KEY')) || isPlaceholder(getCfg('SECRET_KEY'))),
    score: scoreByBaidu,
  },
  sightengine: {
    label: 'Sightengine',
    ready: () => !(isPlaceholder(getCfg('API_USER')) || isPlaceholder(getCfg('API_SECRET'))),
    score: scoreBySightengine,
  },
}

// 当前接口（非法值回退到 baidu）
function getProvider() {
  const p = String(getCfg('PROVIDER') || 'baidu').toLowerCase()
  return PROVIDERS[p] ? p : 'baidu'
}

const isKeyReady = () => PROVIDERS[getProvider()].ready()

// 从「引用/回复」的那条消息里取图片，兼容 NapCat/OneBot 与 icqq
async function getReplyImg(e) {
  const pick = (segs) => (segs || []).filter(v => v?.type === 'image').map(v => v.url || v.file).filter(Boolean)

  // NapCat / OneBot v11：e.reply_id + e.getReply()（内部走 get_msg 拉原消息）
  if (e.reply_id && typeof e.getReply === 'function') {
    try {
      const src = await e.getReply()
      const imgs = pick(src?.message)
      if (imgs.length) return imgs
    } catch (err) {
      logger.warn(`[涩图打分] getReply 取引用图片失败：${err?.message || err}`)
    }
  }

  // icqq：e.source + 历史记录
  if (e.source) {
    try {
      const history = e.isGroup
        ? await e.group.getChatHistory(e.source.seq, 1)
        : await e.friend.getChatHistory(e.source.time, 1)
      const imgs = pick(history?.pop()?.message)
      if (imgs.length) return imgs
    } catch (err) {
      logger.warn(`[涩图打分] getChatHistory 取引用图片失败：${err?.message || err}`)
    }
  }
  return []
}

// 配置帮助提示词
const CFG_HELP = [
  '【涩图打分 · 接口配置说明】',
  '支持两个接口，用 PROVIDER 切换（锅巴里是下拉框）：',
  '  · baidu —— 百度图片审核（默认，真人照片较准）',
  '  · sightengine —— Sightengine（二次元/插画更准，推荐）',
  '',
  '百度：在百度智能云开通「内容审核-图像」并建应用，',
  '  获取 APP_ID / API_KEY / SECRET_KEY。',
  '',
  'Sightengine：注册 https://sightengine.com，在 Dashboard',
  '  获取 API_USER / API_SECRET（免费额度 2000 次/月、500 次/天）。',
  '',
  '修改方式（任选其一）：',
  '  1.【推荐】锅巴：管理面板 → AQing-plugin → 涩图打分，选接口并填对应 key。',
  '  2.【手动】编辑 plugins/AQing-plugin/config/config/spdf.yaml，保存即热生效。',
].join('\n')

// 「先说有多涩、再发图」两步流程的等待态：user_id -> 超时计时器
// 只在「用户发了触发词但没带图」时置位，带图（含引用图）直接打分、绝不置位，
// 否则打完分后用户紧接着随手发的下一张图/表情包会被并发的兜底规则误打分
let markUser = {}

export class spdf extends plugin {
  constructor() {
    super({
      name: 'AQ：涩图打分',
      dsc: '涩图打分',
      event: 'message',
      priority: 8000,
      rule: [
        {
          reg: '^#?(涩图打分|色图打分)(配置帮助|配置|key帮助|帮助)?$',
          fnc: 'cfgHelp',
        },
        {
          reg: '^#*有多(涩|色)|这个(涩|色)吗|这(个|张|图|张图|个图)(涩|色)不(涩|色)|(涩|色)不(涩|色)$',
          fnc: 'HpicMarker',
        },
        {
          reg: '',
          fnc: 'Hpicmark',
        },
      ],
    })
  }

  // 配置帮助提示词
  async cfgHelp(e) {
    await e.reply(CFG_HELP)
    return true
  }

  async HpicMarker(e) {
    if (!isKeyReady()) {
      await e.reply([`当前打分接口（${PROVIDERS[getProvider()].label}）尚未配置 key，无法打分~\n`, CFG_HELP])
      return true
    }

    const isCD = !!getCfg('isCD')
    const CD = Math.max(1, parseInt(getCfg('CD')) || 60)

    let data = await redis.get(`Yunzai:setlinshimsg:${e.user_id}_hpicmark`)
    if (data && isCD && !e.isMaster) {
      e.reply([segment.at(e.user_id), `该命令有${CD}分钟CD~`])
      return true
    }

    // 取引用/回复消息里的图片（兼容 NapCat 与 icqq）
    if (!e.img || !e.img.length) {
      const replyImgs = await getReplyImg(e)
      if (replyImgs.length) e.img = replyImgs
    }

    // 本条消息没带图（也没引用图）：进入「等下一张图」的等待态，交给 Hpicmark 兜底
    if (!e.img || !e.img.length) {
      if (markUser[e.user_id]) clearTimeout(markUser[e.user_id])
      markUser[e.user_id] = setTimeout(() => {
        if (markUser[e.user_id]) delete markUser[e.user_id]
      }, 60000)
      e.reply([segment.at(e.user_id), ' 请发送需要打分的图片'])
      return true
    }

    // 本条消息已带图（含引用图）：清掉可能残留的等待态后直接打分，绝不进入等待态，
    // 返回 true 让 loader 停止，避免再落到 reg:'' 的 Hpicmark 重复打分
    await this.cancel(e)
    await this.doScore(e)
    return true
  }

  // 兜底规则（reg:''）：只服务「先说有多涩、再发图」的两步流程
  async Hpicmark(e) {
    if (!markUser[e.user_id]) return false
    // 命中后立刻解除等待态（同步删除），避免用户连发多张图时后面那张又被打分
    await this.cancel(e)

    // 两步流程下，这张「补发」的图也可能是引用图片
    if (!e.img || !e.img.length) {
      const replyImgs = await getReplyImg(e)
      if (replyImgs.length) e.img = replyImgs
    }
    if (!e.img || !e.img.length) return false

    await this.doScore(e)
    return false
  }

  // 真正的打分逻辑，独立于 markUser 等待态，供「内联打分」与「两步流程」复用
  async doScore(e) {
    const CD = Math.max(1, parseInt(getCfg('CD')) || 60)
    const dic = getCfg('dic') || []
    const provider = getProvider()

    try {
      const ret = await PROVIDERS[provider].score(e.img[0])
      logger.info('【涩图打分】provider:', provider, 'ret:', ret)

      if (!ret.ok) {
        e.reply(`打分失败：${ret.error}`)
        return
      }

      const score = ret.score
      const idx = Math.min(9, Math.max(0, parseInt(score / 10)))
      e.reply([`涩度：${score.toFixed(2)}%\n`, segment.at(e.user_id), ` ${dic[idx] || ''}`])

      redis.set(`Yunzai:setlinshimsg:${e.user_id}_hpicmark`, '{"mark":1}', { EX: parseInt(60 * CD) })
    } catch (err) {
      logger.error('[涩图打分] error', err)
      e.reply(`error！\n${err?.message || err}`)
    }
  }

  async cancel(e) {
    if (markUser[e.user_id]) {
      clearTimeout(markUser[e.user_id])
      delete markUser[e.user_id]
    }
  }
}
