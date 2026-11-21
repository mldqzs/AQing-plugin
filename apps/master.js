/**
 * 主人管理
 *  #增加主人 / #删除主人 [@某人|QQ]   —— 仅绝对主人
 *  #设置绝对主人 [@某人|QQ]           —— 首次给自己设置需控制台验证码
 *  #删除绝对主人 [@某人|QQ]           —— 仅绝对主人
 *  #主人列表                          —— 仅绝对主人
 */
import crypto from 'node:crypto'
import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import Y from '../Yaml/y.js'

const _path = process.cwd().replace(/\\/g, '/')

/** 云崽本体主人配置（masterQQ / master） */
const OTHER_CFG = './config/config/other.yaml'
/** 本插件配置（绝对主人） */
const PLUGIN_CFG = './plugins/AQing-plugin/config/config/config.yaml'
const ABS_KEY = '绝对主人'

/** 等待控制台验证码的请求：user_id → { target, code } */
const pendingCodes = new Map()

/* ───────────── 工具函数 ───────────── */

/** QQ 号统一成配置里的存储形式：能转数字就存数字 */
const normalizeId = id => Number(id) || String(id)

/** 配置里的 QQ 可能是数字也可能是字符串，两种都要匹配 */
const idForms = id => [...new Set([Number(id), String(id)])].filter(v => v && !Number.isNaN(v))

const hasId = (cfg, key, id) => idForms(id).some(v => cfg.value(key, v))
const removeId = (cfg, key, id) => idForms(id).forEach(v => cfg.value(key, v) && cfg.delVal(key, v))

const sameId = (a, b) => String(a) === String(b)

export class MasterManager extends plugin {
  constructor () {
    super({
      name: 'AQ：主人管理',
      dsc: '主人管理',
      event: 'message',
      priority: 5,
      rule: [
        { reg: /^#增加主人.*/, fnc: 'addMaster' },
        { reg: /^#删除主人.*/, fnc: 'delMaster' },
        { reg: /^#设置绝对主人.*/, fnc: 'setAbsMaster' },
        { reg: /^#删除绝对主人.*/, fnc: 'delAbsMaster' },
        { reg: /^#主人列表/, fnc: 'listMasters' }
      ]
    })
  }

  /* ───────────── 通用 ───────────── */

  get otherCfg () { return new Y(OTHER_CFG) }
  get pluginCfg () { return new Y(PLUGIN_CFG) }

  isAbsMaster (user_id) {
    return hasId(this.pluginCfg, ABS_KEY, user_id)
  }

  /**
   * 解析指令目标：优先 @，其次指令后的 QQ 号，最后（可选）回退为发送者
   * @returns {number|string|null}
   */
  getTarget (e, cmd, fallbackSelf = false) {
    const raw = e.at || e.msg.replace(cmd, '').trim() || (fallbackSelf ? e.user_id : '')
    return raw ? normalizeId(raw) : null
  }

  /** 绝对主人权限校验，不通过时直接回复原因 */
  async requireAbsMaster (e, action) {
    if (this.isAbsMaster(e.user_id)) return true
    const noneSet = !(this.pluginCfg.get(ABS_KEY) || []).length
    await e.reply(noneSet
      ? `尚未设置绝对主人，请先发送 #设置绝对主人。`
      : `您不是绝对主人，无权${action}。`)
    return false
  }

  /* ───────────── 普通主人 ───────────── */

  /**
   * 与云崽本体 #设置主人 保持一致：同时写入全局 masterQQ 和当前 Bot 的 master，
   * 让新主人在 cfg.masterQQ / cfg.master[e.self_id] 两种校验下都生效。
   * master 必须用 e.self_id（收到指令的 Bot），不能用 Bot.uin（多账号时是数组）。
   */
  async addMaster (e) {
    if (!await this.requireAbsMaster(e, '增加主人')) return false

    const target = this.getTarget(e, /^#增加主人/, true)
    const cfg = this.otherCfg
    const botKey = `${e.self_id}:${target}`

    if (hasId(cfg, 'masterQQ', target) && cfg.value('master', botKey)) {
      return e.reply([segment.at(target), ' 已经是主人了，无需重复添加。'])
    }
    if (!hasId(cfg, 'masterQQ', target)) cfg.addVal('masterQQ', target, 'Array')
    if (!cfg.value('master', botKey)) cfg.addVal('master', botKey, 'Array')
    return e.reply([segment.at(target), ' 已被设置为主人。'])
  }

  /** 全局 masterQQ 与当前 Bot 的 master 一并移除 */
  async delMaster (e) {
    if (!await this.requireAbsMaster(e, '删除主人')) return false

    const target = this.getTarget(e, /^#删除主人/)
    if (!target) return e.reply('未识别到目标用户，请 @ 对方或附带其 QQ 号。')

    const cfg = this.otherCfg
    const botKey = `${e.self_id}:${target}`
    const inMaster = cfg.value('master', botKey)
    const inMasterQQ = hasId(cfg, 'masterQQ', target)

    if (!inMaster && !inMasterQQ) {
      return e.reply([segment.at(target), ' 并不是主人，无需删除。'])
    }
    if (inMaster) cfg.delVal('master', botKey)
    if (inMasterQQ) removeId(cfg, 'masterQQ', target)
    return e.reply([segment.at(target), ' 的主人身份已解除。'])
  }

  /* ───────────── 绝对主人 ───────────── */

  async setAbsMaster (e) {
    const target = this.getTarget(e, /^#设置绝对主人/, true)

    // 给他人设置：仅现有绝对主人可操作
    if (!sameId(target, e.user_id)) {
      if (!this.isAbsMaster(e.user_id)) return e.reply('您不是绝对主人，无权设置他人为绝对主人。')
      if (this.isAbsMaster(target)) return e.reply([segment.at(target), ' 已经是绝对主人了，无需重复设置。'])
      return e.reply(this.writeAbsMaster(target))
    }

    if (this.isAbsMaster(e.user_id)) return e.reply('您已经是绝对主人了，无需重复设置。')

    // 首次给自己设置：控制台验证码，确保操作者能访问服务器
    const code = crypto.randomUUID()
    pendingCodes.set(String(e.user_id), { target, code })
    logger.mark(`【AQ】绝对主人验证码：${logger.green(code)}`)
    await e.reply([segment.at(e.user_id), ' 验证码已发送至控制台，请回复验证码以完成设置。'])
    return this.setContext('verifyAbsMaster')
  }

  /** setContext 回调：校验用户回复的验证码 */
  async verifyAbsMaster () {
    this.finish('verifyAbsMaster')
    const key = String(this.e.user_id)
    const pending = pendingCodes.get(key)
    pendingCodes.delete(key)
    if (!pending) return true

    // 下一条消息可能是图片/表情等非文本，e.msg 为空，不能直接 .trim()
    const reply = String(this.e.msg || this.e.raw_message || '').trim()
    await this.reply(reply === pending.code
      ? this.writeAbsMaster(pending.target)
      : '验证码有误，设置已取消。请重新发送「#设置绝对主人」获取新的验证码。')
    return true
  }

  writeAbsMaster (target) {
    this.pluginCfg.addVal(ABS_KEY, target, 'Array')
    return [segment.at(target), ' 已被设置为绝对主人。']
  }

  async delAbsMaster (e) {
    if (!await this.requireAbsMaster(e, '删除绝对主人')) return false

    const target = this.getTarget(e, /^#删除绝对主人/)
    if (!target) return e.reply('未识别到目标用户，请 @ 对方或附带其 QQ 号。')
    if (!this.isAbsMaster(target)) return e.reply([segment.at(target), ' 并不是绝对主人，无需删除。'])

    removeId(this.pluginCfg, ABS_KEY, target)
    return e.reply([segment.at(target), ' 的绝对主人身份已解除。'])
  }

  /* ───────────── 主人列表 ───────────── */

  async listMasters (e) {
    if (!await this.requireAbsMaster(e, '查看主人列表')) return false

    const cfg = this.otherCfg
    // master 为 "botuin:qq" 形式，masterQQ 为纯 QQ，合并去重
    const qqList = [...new Set([
      ...(cfg.get('masterQQ') || []).map(String),
      ...(cfg.get('master') || []).map(m => String(m).split(':').pop())
    ])].filter(Boolean)

    if (!qqList.length) return e.reply('当前暂无主人。')

    const masters = await Promise.all(qqList.map(async qq => ({
      qq,
      nickname: await this.getNickname(e, qq),
      avatar: `https://q1.qlogo.cn/g?b=qq&s=640&nk=${qq}`
    })))

    const img = await puppeteer.screenshot('master', {
      tplFile: './plugins/AQing-plugin/resources/html/master/master.html',
      pluResPath: _path,
      saveId: 'master',
      masters,
      total: masters.length
    })
    if (img) return e.reply(img)
    // 截图失败兜底为文字
    return e.reply('当前主人列表：\n' + masters.map(m => `${m.nickname}（${m.qq}）`).join('\n'))
  }

  /** 昵称：群名片 → 陌生人/好友信息 → QQ 号（兼容 TRSS 的 pickMember 与 icqq 的 getGroupMemberInfo） */
  async getNickname (e, qq) {
    const uin = Number(qq)
    const bot = e.bot || Bot[e.self_id] || Bot
    const tries = [
      async () => {
        if (!e.isGroup) return
        const m = await (e.group?.pickMember?.(uin) ?? bot.pickMember?.(e.group_id, uin))?.getInfo?.()
        return m?.card || m?.nickname
      },
      async () => {
        if (!e.isGroup || !Bot.getGroupMemberInfo) return
        const m = await Bot.getGroupMemberInfo(e.group_id, uin)
        return m?.card || m?.nickname
      },
      async () => (await bot.sendApi?.('get_stranger_info', { user_id: uin }))?.data?.nickname,
      async () => (await bot.pickFriend?.(uin)?.getInfo?.())?.nickname,
      async () => (await Bot.getStrangerInfo?.(uin))?.nickname
    ]
    for (const fn of tries) {
      try {
        const name = await fn()
        if (name) return name
      } catch {}
    }
    return String(qq)
  }
}
