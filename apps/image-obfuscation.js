/* ─────────────────────────────────────────────────────────────
 * 小番茄图片混淆
 * 指令：
 *   小番茄解图 + 图片/引用图片/图片链接 → 解混淆后发出结果
 *   小番茄混图 + 图片/引用图片/图片链接 → 混淆后发出结果
 *
 * 结果发送方式（锅巴配置默认值，指令后缀可临时覆盖）：
 *   合并转发（默认） → 「小番茄解图 转发」
 *   临时网址         → 「小番茄解图 链接」
 *
 * ⚠️ 加载器铁律：apps/ 下文件只导出插件类，公共逻辑放 utils/。
 * ───────────────────────────────────────────────────────────── */

import plugin from '../../../lib/plugins/plugin.js'
import setting from '../utils/setting.js'
import common from '../../../lib/common/common.js'
import { hideImgTransform } from '../utils/hideImg.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
const DEFAULT_MAX_MB = 12

function cfg () {
  return setting.getConfig('hideImg') || {}
}

function maxBytes () {
  const mb = Math.max(1, Math.min(50, Number(cfg().maxMB) || DEFAULT_MAX_MB))
  return mb * 1024 * 1024
}

let waitUser = {}

function pickImgs (segs) {
  return (segs || [])
    .filter(v => v?.type === 'image')
    .map(v => v.url || v.file || v.data?.url || v.data?.file)
    .filter(Boolean)
}

async function getReplyImg (e) {
  if (e.reply_id && typeof e.getReply === 'function') {
    try {
      const src = await e.getReply()
      const imgs = pickImgs(src?.message)
      if (imgs.length) return imgs
    } catch (err) {
      logger.warn(`[小番茄图片混淆] getReply 取引用图片失败：${err?.message || err}`)
    }
  }

  if (e.source) {
    try {
      const history = e.isGroup
        ? await e.group.getChatHistory(e.source.seq, 1)
        : await e.friend.getChatHistory(e.source.time, 1)
      const imgs = pickImgs(history?.pop()?.message)
      if (imgs.length) return imgs
    } catch (err) {
      logger.warn(`[小番茄图片混淆] getChatHistory 取引用图片失败：${err?.message || err}`)
    }
  }
  return []
}

function pickUrl (msg = '') {
  return (String(msg).match(/https?:\/\/[^\s\]"'<>]+/i) || [])[0] || ''
}

/** 发送方式：forward=合并转发, link=临时网址 */
function sendMode () {
  const mode = String(cfg().sendMode || 'forward').toLowerCase()
  return mode === 'link' ? 'link' : 'forward'
}

/** 指令后缀临时覆盖：链接/link/网址，转发/forward/合并（先剔除图片链接本身，避免误判） */
function pickModeByMsg (msg = '') {
  const text = String(msg).replace(/https?:\/\/[^\s\]"'<>]+/gi, ' ')
  if (/(链接|网址|link|url)/i.test(text)) return 'link'
  if (/(转发|合并|聊天记录|forward)/i.test(text)) return 'forward'
  return ''
}

function rewriteLinkUrl (rawUrl, publicBaseUrl) {
  const base = String(publicBaseUrl || '').trim().replace(/\/+$/, '')
  if (!base) return String(rawUrl)
  try {
    const src = new URL(String(rawUrl))
    const dst = new URL(base)
    dst.pathname = src.pathname
    dst.search = src.search
    dst.hash = src.hash
    return dst.toString()
  } catch {
    return String(rawUrl)
  }
}

/** 外部图床：返回公网临时链接，不暴露服务器 IP */
async function uploadExternal (buf, filename, ext, mime, provider) {
  const allBeds = [
    {
      key: 'catbox',
      name: 'Catbox',
      url: 'https://catbox.moe/user/api.php',
      fields: { reqtype: 'fileupload', userhash: '' }
    },
    {
      key: 'litterbox',
      name: 'Litterbox',
      url: 'https://litterbox.catbox.moe/resources/internals/api.php',
      fields: { reqtype: 'fileupload', time: '1h' }
    }
  ]
  const beds = provider === 'catbox' || provider === 'litterbox'
    ? allBeds.filter(v => v.key === provider)
    : allBeds

  for (const bed of beds) {
    try {
      const form = new FormData()
      for (const [k, v] of Object.entries(bed.fields)) form.append(k, v)
      form.append('fileToUpload', new Blob([buf], { type: mime }), filename)

      const res = await fetch(bed.url, { method: 'POST', body: form })
      const text = (await res.text()).trim()
      if (res.ok && /^https?:\/\//i.test(text)) return { url: text, source: bed.name }
      logger.warn(`[小番茄图片混淆] ${bed.name} 上传失败：${res.status} ${text.slice(0, 120)}`)
    } catch (err) {
      logger.warn(`[小番茄图片混淆] ${bed.name} 上传异常：${err?.message || err}`)
    }
  }
  return null
}

/** 本地临时链接：Bot.fileToUrl 生成带有效期的链接，不出站 */
async function makeLocalLink (buf, filename) {
  if (typeof Bot?.fileToUrl !== 'function') return null
  const c = cfg()
  const expire = Math.max(1, Math.min(1440, Number(c.linkExpireMin) || 10))
  const viewsRaw = Number(c.linkMaxViews)
  const views = Number.isFinite(viewsRaw) && viewsRaw > 0
    ? Math.min(1000, Math.floor(viewsRaw))
    : false
  const rawUrl = await Bot.fileToUrl({ name: filename, buffer: buf }, {
    time: expire * 60000,
    times: views || false
  })
  return { url: rewriteLinkUrl(rawUrl, c.linkPublicBaseUrl), source: 'local' }
}

/** 生成临时网址，按配置选择外部图床或本地链接 */
async function makeImageLink (buf, prefix, ext, mime) {
  const c = cfg()
  const filename = `${prefix}-${Date.now()}.${ext}`
  const provider = String(c.linkProvider || 'auto').toLowerCase()

  if (provider !== 'local') {
    const external = await uploadExternal(buf, filename, ext, mime, provider)
    if (external) return external
  }
  if (provider === 'local' || provider === 'auto') {
    const local = await makeLocalLink(buf, filename)
    if (local) return local
  }
  throw new Error('临时网址生成失败，请检查图床网络或本地图链配置')
}

async function downloadImage (src) {
  if (!src) throw new Error('没拿到图片')

  // base64 / 本地 file / 远程 url 都尽量兼容
  if (/^base64:\/\//i.test(src)) return Buffer.from(src.replace(/^base64:\/\//i, ''), 'base64')
  if (/^data:image\//i.test(src)) return Buffer.from(src.split(',')[1] || '', 'base64')

  if (!/^https?:\/\//i.test(src)) return src

  const res = await fetch(src, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  if (!res.ok) throw new Error(`图片下载失败：HTTP ${res.status}`)
  const max = maxBytes()
  const maxMB = Math.round(max / 1024 / 1024)
  const len = Number(res.headers.get('content-length') || 0)
  if (len > max) throw new Error(`图片太大啦，最多 ${maxMB}MB`)
  const ab = await res.arrayBuffer()
  if (ab.byteLength > max) throw new Error(`图片太大啦，最多 ${maxMB}MB`)
  return Buffer.from(ab)
}

export class hideImg extends plugin {
  constructor () {
    super({
      name: 'AQ：小番茄图片混淆',
      dsc: '小番茄图片混淆/解混淆',
      event: 'message',
      priority: 8000,
      rule: [
        {
          reg: '^#?(小番茄|番茄|图片)混淆(设置|配置|状态)?$',
          fnc: 'status'
        },
        {
          reg: '^#?(小番茄|番茄|图片)(混淆|混图|藏图|加密)(图片|图)?',
          fnc: 'encrypt'
        },
        {
          reg: '^#?(小番茄|番茄|图片)(解混淆|解图|还原|解密)(图片|图)?',
          fnc: 'decrypt'
        },
        {
          reg: '',
          fnc: 'waitImage'
        }
      ]
    })
  }

  async encrypt (e) {
    return this.run(e, 'encrypt')
  }

  async status (e) {
    if (cfg().enable === false) return false
    const c = cfg()
    const output = String(c.outputFormat || 'png').toLowerCase()
    const outputText = output === 'auto' ? '自动（混图 JPG / 解图 PNG）' : output.toUpperCase()
    const mode = sendMode()
    const provider = String(c.linkProvider || 'auto').toLowerCase()
    const providerText = provider === 'local'
      ? '本地临时链接'
      : provider === 'auto' ? '自动（外部图床 → 本地图链）' : provider === 'catbox' ? 'Catbox' : 'Litterbox'
    await e.reply([
      '🍅 小番茄图片混淆配置',
      `\n· 结果发送：${mode === 'link' ? '临时网址' : 'QQ 合并转发'}`,
      `\n· 临时网址来源：${providerText}`,
      `\n· 图片上限：${Number(c.maxMB) || DEFAULT_MAX_MB}MB`,
      `\n· 输出格式：${outputText}`,
      `\n· QQ抗压缩倍数：${Number(c.qqSafeScale) || 1}x`,
      `\n· 混图最大边：${Number(c.maxSide) || 0 || '不限制'}`,
      '\n· 临时切换：指令后加「链接」或「转发」',
      '\n\n可在锅巴：AQing-plugin → 小番茄图片混淆 里修改。'
    ])
    return true
  }

  async decrypt (e) {
    return this.run(e, 'decrypt')
  }

  async run (e, mode) {
    if (cfg().enable === false) return false
    await this.cancel(e)
    const send = pickModeByMsg(e.msg) || sendMode()
    const img = await this.findImage(e)
    if (!img) {
      waitUser[e.user_id] = {
        mode,
        send,
        timer: setTimeout(() => { delete waitUser[e.user_id] }, 60000)
      }
      await e.reply([segment.at(e.user_id), mode === 'decrypt' ? ' 把要解的小番茄图发来，或引用图片发「小番茄解图」' : ' 把要混淆的图片发来，或引用图片发「小番茄混图」'])
      return true
    }
    await this.process(e, mode, img, send)
    return true
  }

  async waitImage (e) {
    if (cfg().enable === false) return false
    const st = waitUser[e.user_id]
    if (!st) return false
    await this.cancel(e)
    const img = await this.findImage(e)
    if (!img) return false
    await this.process(e, st.mode, img, st.send || sendMode())
    return false
  }

  async findImage (e) {
    let imgs = e.img && e.img.length ? e.img : []
    if (!imgs.length) imgs = pickImgs(e.message)
    if (!imgs.length) imgs = await getReplyImg(e)
    if (imgs.length) return imgs[0]
    return pickUrl(e.msg)
  }

  async process (e, mode, src, send = sendMode()) {
    try {
      await e.reply(mode === 'decrypt' ? '收到，正在解图...' : '收到，正在混图...')
      const input = await downloadImage(src)
      const out = await hideImgTransform(input, mode, cfg().outputFormat || 'png', {
        upscale: Number(cfg().qqSafeScale) || 1,
        maxSide: Number(cfg().maxSide) || 0
      })
      const title = mode === 'decrypt' ? '小番茄解图完成' : '小番茄混图完成'
      const brief = `🍅 ${title}（${out.ext.toUpperCase()}）`
      const prefix = mode === 'decrypt' ? 'tomato-decode' : 'tomato-encode'

      if (send === 'link') {
        try {
          const ret = await makeImageLink(out.buffer, prefix, out.ext, out.mime)
          const tip = ret.source === 'local' ? '本地临时链接' : `外部图床：${ret.source}`
          await e.reply(`${brief}（${tip}，有效期有限）：\n${ret.url}`, true)
          return
        } catch (err) {
          logger.warn(`[小番茄图片混淆] 临时网址生成失败，改为合并转发：${err?.message || err}`)
        }
      }

      try {
        // 结果以「合并转发聊天记录」发送图片本体，不生成任何图片链接，
        // 也不依赖外部图床 / 本地图链公网地址，公网 IP 不会出现在消息里。
        const forward = await common.makeForwardMsg(e, [segment.image(out.buffer)], brief)
        // 合并转发本身是独立消息，不要再加引用，否则会被拆成「空引用 + 转发」两条
        const sent = await e.reply(forward, false)
        if (sent === false || sent?.error) throw new Error('合并转发发送失败')
      } catch (err) {
        logger.warn(`[小番茄图片混淆] 合并转发失败，改为直接发图：${err?.message || err}`)
        await e.reply([brief, segment.image(out.buffer)], true)
      }
    } catch (err) {
      logger.error('[小番茄图片混淆] error', err)
      await e.reply(`处理失败：${err?.message || err}`)
    }
  }

  async cancel (e) {
    if (waitUser[e.user_id]) {
      clearTimeout(waitUser[e.user_id].timer)
      delete waitUser[e.user_id]
    }
  }
}
