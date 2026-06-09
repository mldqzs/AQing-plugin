import plugin from '../../../lib/plugins/plugin.js'
import fs from 'node:fs'
import Y from '../Yaml/y.js'

/*
 * 涩图打分（参考 root/涩图打分（v3）.js 改写）
 * - 百度图片审核 key 已迁移到 config/config/spdf.yaml，支持锅巴/手动修改、热生效
 * - 直接调用百度内容审核 REST API，免去 baidu-aip-sdk 依赖
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
const isKeyReady = () => {
  const id = getCfg('APP_ID')
  const ak = getCfg('API_KEY')
  const sk = getCfg('SECRET_KEY')
  const bad = (v) => !v || /^你的/.test(String(v))
  return !(bad(id) || bad(ak) || bad(sk))
}

// 配置帮助提示词
const CFG_HELP = [
  '【涩图打分 · key 配置说明】',
  '需要先填入百度「图片内容审核」的 App ID / API Key / Secret Key。',
  '',
  '方式一【推荐】锅巴：',
  '  安装锅巴插件后，打开锅巴管理面板 →',
  '  AQing-plugin → 涩图打分，填入三个 key 即可。',
  '',
  '方式二【手动】编辑文件：',
  '  plugins/AQing-plugin/config/config/spdf.yaml',
  '  把 APP_ID / API_KEY / SECRET_KEY 改成你自己的，保存即生效。',
  '',
  '⚠ 若同时在用「色图监听」，请另建一个百度应用，勿复用同一 key。',
].join('\n')

// 获取百度 access_token
async function getAccessToken() {
  const ak = getCfg('API_KEY')
  const sk = getCfg('SECRET_KEY')
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(ak)}&client_secret=${encodeURIComponent(sk)}`
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error_description || data.error || '获取 access_token 失败，请检查 API Key / Secret Key')
  return data.access_token
}

// 调用图片内容审核，返回结果对象
async function censorImage(imgUrl) {
  const token = await getAccessToken()
  const url = `https://aip.baidubce.com/rest/2.0/solution/v1/img_censor/v2/user_defined?access_token=${token}`
  const body = new URLSearchParams({ imgUrl })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  return res.json()
}

let markUser = {}

export class spdf extends plugin {
  constructor() {
    super({
      name: '涩图打分',
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
      await e.reply(['尚未配置百度审核 key，无法打分~\n', CFG_HELP])
      return true
    }

    const isCD = !!getCfg('isCD')
    const CD = Math.max(1, parseInt(getCfg('CD')) || 60)

    let data = await redis.get(`Yunzai:setlinshimsg:${e.user_id}_hpicmark`)
    if (data && isCD && !e.isMaster) {
      e.reply([segment.at(e.user_id), `该命令有${CD}分钟CD~`])
      return true
    }

    // 取引用消息里的图片
    if (e.source) {
      let reply
      try {
        if (e.isGroup) {
          reply = (await e.group.getChatHistory(e.source.seq, 1)).pop()?.message
        } else {
          reply = (await e.friend.getChatHistory(e.source.time, 1)).pop()?.message
        }
      } catch (err) {
        logger.warn(`[涩图打分] 获取引用消息失败：${err?.message || err}`)
      }
      if (reply) {
        for (let val of reply) {
          if (val.type == 'image') {
            e.img = [val.url]
            break
          }
        }
      }
    }

    if (!e.img) {
      if (markUser[e.user_id]) clearTimeout(markUser[e.user_id])
      markUser[e.user_id] = setTimeout(() => {
        if (markUser[e.user_id]) delete markUser[e.user_id]
      }, 60000)
      e.reply([segment.at(e.user_id), ' 请发送需要打分的图片'])
      return true
    }

    markUser[e.user_id] = true
    return await this.Hpicmark(e)
  }

  async Hpicmark(e) {
    if (!markUser[e.user_id]) return false
    if (!e.img) {
      await this.cancel(e)
      return false
    }

    const CD = Math.max(1, parseInt(getCfg('CD')) || 60)
    const dic = getCfg('dic') || []

    try {
      const data = await censorImage(e.img[0])
      logger.info('【涩图打分】data:', data)

      if (data.error_code == 14) {
        e.reply('IAM认证失败，请确认你的百度 apikey 有效并且填写正确。')
        await this.cancel(e)
        return true
      }
      if (data.error_code == 18) {
        e.reply('触发QPS限制。可能是请求频率过高，或你没有在百度云控制台开通“内容审核-图像”资源，或开通时间过短（小于15分钟）')
        await this.cancel(e)
        return true
      }
      if (data.error_code) {
        e.reply(`审核失败：${data.error_msg || data.error_code}`)
        await this.cancel(e)
        return true
      }

      let score = 0.0
      if (data.conclusionType == 2 || data.conclusionType == 3) {
        let arr = []
        for (let i = 0; i < data.data.length; i++) {
          if (data.data[i].probability * 1 > 0.00001) arr.push(data.data[i].probability * 1)
        }
        const max = arr.length === 0 ? 0.0 : arr.sort((a, b) => b - a)[0]
        logger.info('【涩图打分】max:', max)
        score = max * 100
      } else if (data.conclusionType == 1) {
        score = 0
      } else {
        logger.info('【涩图打分】审核失败')
      }

      const idx = Math.min(9, Math.max(0, parseInt(score / 10)))
      e.reply([`涩度：${score.toFixed(2)}%\n`, segment.at(e.user_id), ` ${dic[idx] || ''}`])

      redis.set(`Yunzai:setlinshimsg:${e.user_id}_hpicmark`, '{"mark":1}', { EX: parseInt(60 * CD) })
    } catch (err) {
      logger.error('[涩图打分] error', err)
      e.reply(`error！\n${err?.message || err}`)
    }

    await this.cancel(e)
    return false
  }

  async cancel(e) {
    if (markUser[e.user_id]) {
      clearTimeout(markUser[e.user_id])
      delete markUser[e.user_id]
    }
  }
}
