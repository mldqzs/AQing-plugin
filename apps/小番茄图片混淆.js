/* ─────────────────────────────────────────────────────────────
 * 小番茄图片混淆
 * 指令：
 *   小番茄解图 + 图片/引用图片/图片链接 → 解混淆后发图
 *   小番茄混图 + 图片/引用图片/图片链接 → 混淆后发图
 *
 * ⚠️ 加载器铁律：apps/ 下文件只导出插件类，公共逻辑放 utils/。
 * ───────────────────────────────────────────────────────────── */

import plugin from '../../../lib/plugins/plugin.js'
import setting from '../utils/setting.js'
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

function rewriteLocalUrl (rawUrl, publicBaseUrl) {
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

async function bufferToImageUrl (buf, prefix = 'hideimg') {
  const c = cfg()
  const filename = `${prefix}-${Date.now()}.jpg`
  const linkMode = String(c.linkMode || 'external').toLowerCase()
  const provider = String(c.externalProvider || 'auto').toLowerCase()

  // 外部图床：返回真正的公网 http 链接，而不是 QQ 图片消息。
  // 默认 external + auto：先 catbox，再 litterbox；如果用户在锅巴选 local，就只走本地图链。
  if (linkMode !== 'local') {
    const allBeds = [
      {
        key: 'catbox',
        name: 'catbox',
        url: 'https://catbox.moe/user/api.php',
        fields: { reqtype: 'fileupload', userhash: '' }
      },
      {
        key: 'litterbox',
        name: 'litterbox',
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
        form.append('fileToUpload', new Blob([buf], { type: 'image/jpeg' }), filename)

        const res = await fetch(bed.url, { method: 'POST', body: form })
        const text = (await res.text()).trim()
        if (res.ok && /^https?:\/\//i.test(text)) return { url: text, source: bed.name }
        logger?.warn?.(`[小番茄图片混淆] ${bed.name} 图床上传失败：${res.status} ${text.slice(0, 120)}`)
      } catch (err) {
        logger?.warn?.(`[小番茄图片混淆] ${bed.name} 图床上传异常：${err?.message || err}`)
      }
    }
  }

  if (typeof Bot?.fileToUrl === 'function') {
    const expire = Math.max(1, Math.min(1440, Number(c.localExpireMin) || 10))
    const viewsRaw = Number(c.localMaxViews)
    const views = Number.isFinite(viewsRaw) && viewsRaw > 0
      ? Math.min(1000, Math.floor(viewsRaw))
      : false // false=不传 times，云崽不会扣次数，只靠有效期过期
    const opts = { time: expire * 60000 }
    if (views) opts.times = views
    const rawUrl = await Bot.fileToUrl({
      name: filename,
      buffer: buf
    }, opts)
    return { url: rewriteLocalUrl(rawUrl, c.localPublicBaseUrl), source: 'local' }
  }

  throw new Error('外部图床上传失败，且当前环境没有可用的本地图链服务')
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
    const mode = String(c.linkMode || 'external').toLowerCase() === 'local' ? '本地图链' : '外部图床'
    const provider = String(c.externalProvider || 'auto').toLowerCase()
    await e.reply([
      '🍅 小番茄图片混淆配置',
      `\n· 链接模式：${mode}`,
      `\n· 外部图床：${provider === 'auto' ? '自动（Catbox → Litterbox）' : provider}`,
      `\n· 图片上限：${Number(c.maxMB) || DEFAULT_MAX_MB}MB`,
      `\n· 本地图链有效期：${Number(c.localExpireMin) || 10}分钟`,
      `\n· 本地图链访问次数：${Number(c.localMaxViews) > 0 ? `${Number(c.localMaxViews)}次` : '不限次数'}`,
      `\n· 本地公网地址：${c.localPublicBaseUrl || '未设置（使用云崽原始地址）'}`,
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
    const img = await this.findImage(e)
    if (!img) {
      waitUser[e.user_id] = {
        mode,
        timer: setTimeout(() => { delete waitUser[e.user_id] }, 60000)
      }
      await e.reply([segment.at(e.user_id), mode === 'decrypt' ? ' 把要解的小番茄图发来，或引用图片发「小番茄解图」' : ' 把要混淆的图片发来，或引用图片发「小番茄混图」'])
      return true
    }
    await this.process(e, mode, img)
    return true
  }

  async waitImage (e) {
    if (cfg().enable === false) return false
    const st = waitUser[e.user_id]
    if (!st) return false
    await this.cancel(e)
    const img = await this.findImage(e)
    if (!img) return false
    await this.process(e, st.mode, img)
    return false
  }

  async findImage (e) {
    let imgs = e.img && e.img.length ? e.img : []
    if (!imgs.length) imgs = pickImgs(e.message)
    if (!imgs.length) imgs = await getReplyImg(e)
    if (imgs.length) return imgs[0]
    return pickUrl(e.msg)
  }

  async process (e, mode, src) {
    try {
      await e.reply(mode === 'decrypt' ? '收到，正在解图...' : '收到，正在混图...')
      const input = await downloadImage(src)
      const out = await hideImgTransform(input, mode)
      const ret = await bufferToImageUrl(out, mode === 'decrypt' ? 'tomato-decode' : 'tomato-encode')
      const tip = ret.source === 'local' ? '本地临时链接' : `外部图床：${ret.source}`
      await e.reply(`${mode === 'decrypt' ? '解图完成' : '混图完成'}（${tip}）：\n${ret.url}`, true)
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
