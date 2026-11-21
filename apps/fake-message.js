/**
 * 伪造消息：把「@某人 + 内容」拼成一条以假乱真的合并转发
 *
 *  伪造消息@甲 你好|在吗 @乙 [图片]
 *  伪造消息^123456 你好 ^654321 不在        （不 @ 也能指定 QQ）
 *
 *  名单（仅主人）：#伪造加白/删白、#伪造加黑/删黑、#伪造白名单/黑名单
 */
import plugin from '../../../lib/plugins/plugin.js'
import cfg from '../../../lib/config/config.js'
import Y from '../Yaml/y.js'

const BM_PATH = './plugins/AQing-plugin/config/config/bm.yaml'
const PLUGIN_CFG = './plugins/AQing-plugin/config/config/config.yaml'

/** 单次最多伪造的消息条数，防刷屏 */
const MAX_NODES = 100

/** 原样放进转发里的消息段类型（表情、大表情、视频、动图等） */
const PASS_TYPES = new Set(['face', 'mface', 'bface', 'sface', 'video', 'dice', 'rps', 'poke', 'markdown'])

/** ^123456 形式指定发言人 */
const QQ_TOKEN = /[\^＾](\d{5,11})/

const USAGE = [
  '【伪造消息】',
  '格式：伪造消息@某人 内容@另一个人 内容',
  '· 同一人多句用 | 分隔：@甲 第一句|第二句',
  '· 不想 @ 时可写 ^QQ号：^123456 你好',
  '· 支持图片、QQ表情、大表情、视频',
  '',
  '名单管理（仅主人）：',
  '#伪造加白/删白 @某人 —— 白名单不可被伪造（主人自动保护）',
  '#伪造加黑/删黑 @某人 —— 黑名单禁止使用伪造',
  '#伪造白名单 / #伪造黑名单 —— 查看名单'
].join('\n')

const LIST_INFO = {
  白名单: { add: '已将该用户加入伪造白名单（不可被伪造）', del: '已将该用户移出伪造白名单', title: '伪造白名单（不可被伪造）' },
  黑名单: { add: '已将该用户加入伪造黑名单（禁止使用伪造）', del: '已将该用户移出伪造黑名单', title: '伪造黑名单（禁止使用）' }
}

/* ───────────── 工具函数 ───────────── */

/** 配置里的 QQ 可能是数字也可能是字符串，两种都要匹配 */
const idForms = id => [...new Set([Number(id), String(id)])].filter(v => v && !Number.isNaN(v))
const inList = (yaml, key, id) => idForms(id).some(v => yaml.value(key, v))

export class Fakemessage extends plugin {
  constructor () {
    super({
      name: 'AQ：伪造消息',
      dsc: '伪造消息',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: '^[#＃/]*伪造消息([\\s\\S]*)$', fnc: 'Fakemessage' },
        { reg: '^#?伪造加白.*$', fnc: 'addWhite' },
        { reg: '^#?伪造删白.*$', fnc: 'delWhite' },
        { reg: '^#?伪造加黑.*$', fnc: 'addBlack' },
        { reg: '^#?伪造删黑.*$', fnc: 'delBlack' },
        { reg: '^#?伪造白名单$', fnc: 'listWhite' },
        { reg: '^#?伪造黑名单$', fnc: 'listBlack' }
      ]
    })
  }

  /* ═════════════ 伪造消息 ═════════════ */

  async Fakemessage (e) {
    const bm = new Y(BM_PATH)

    if (!e.isMaster && inList(bm, '黑名单', e.user_id)) {
      await e.reply([segment.at(e.user_id), ' 你已被禁止使用伪造消息功能'])
      return true
    }

    // 复制一份再处理，不改动 e.message（避免影响后续插件）
    const segs = this.stripCommand(e, (e.message || []).map(s => ({ ...s })))
    if (!segs) return this.usage(e)

    const result = await this.buildNodes(e, segs, bm)
    if (result === 'protected') return true
    if (!result?.length) return this.usage(e)

    const nodes = result.slice(0, MAX_NODES)
    return this.send(e, nodes)
  }

  usage (e) {
    e.reply(USAGE)
    return true
  }

  /**
   * 去掉开头的 @机器人 / 引用回复，以及「(机器人别名)#伪造消息」前缀
   * @returns 处理后的消息段；无法识别指令时返回 null
   */
  stripCommand (e, segs) {
    while (segs.length && segs[0].type !== 'text') {
      const s = segs[0]
      if (s.type === 'reply' || (s.type === 'at' && String(s.qq) === String(e.self_id))) segs.shift()
      else break
    }
    if (segs[0]?.type !== 'text' || typeof segs[0].text !== 'string') return null

    // TRSS 签名为 getGroup(bot_id, group_id)
    const alias = cfg.getGroup(e.self_id, e.group_id)?.botAlias || []
    const escape = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // TRSS 会把 / 当成 # 处理（e.msg 里是 #，原始消息段里仍是 /），三种前缀都要去掉
    const prefix = new RegExp(`^\\s*(?:(?:${alias.map(escape).join('|') || '(?!)'})\\s*)?[#＃/]*伪造消息`)
    segs[0].text = segs[0].text.replace(prefix, '')
    return segs
  }

  /**
   * 把消息段转成转发节点 [{ user_id, nickname, message }]
   * @returns 节点数组；目标受保护时返回 'protected'；格式不对返回 null
   */
  async buildNodes (e, segs, bm) {
    const nodes = []
    const checked = new Map() // qq → 是否受保护，避免重复查
    let speaker = null

    const setSpeaker = async (qq, name) => {
      qq = String(qq)
      if (!checked.has(qq)) checked.set(qq, await this.checkProtected(e, qq, bm))
      if (checked.get(qq)) return false
      speaker = { user_id: qq, nickname: name || await this.getName(e, qq) }
      return true
    }
    const push = message => {
      if (!speaker) return false
      nodes.push({ ...speaker, message })
      return true
    }

    for (const seg of segs) {
      switch (seg.type) {
        case 'at': {
          const name = String(seg.text || '').replace(/^@/, '').trim()
          if (!await setSpeaker(seg.qq, name)) return 'protected'
          break
        }
        case 'text': {
          // "^123456 内容" 拆成 [前文, qq, 内容, qq, 内容 ...]，QQ 后面的内容不再丢失
          const tokens = seg.text.split(new RegExp(QQ_TOKEN.source))
          for (let i = 0; i < tokens.length; i++) {
            if (i % 2 === 1) {
              if (!await setSpeaker(tokens[i])) return 'protected'
              continue
            }
            for (const line of tokens[i].split('|')) {
              const text = line.trim()
              if (text && !push(text)) return null
            }
          }
          break
        }
        case 'image': {
          if (!push(segment.image(seg.url || seg.file))) return null
          break
        }
        default: {
          if (PASS_TYPES.has(seg.type) && !push(seg)) return null
        }
      }
    }
    return nodes
  }

  /**
   * 目标是否受保护（主人 / 绝对主人 / 白名单），受保护则提示并禁言伪造者。
   * 操作者是主人时不受限制。
   */
  async checkProtected (e, qq, bm) {
    if (e.isMaster) return false

    const botMasters = (cfg.master?.[e.self_id] || []).map(String)
    const isMaster = cfg.masterQQ.map(String).includes(qq) ||
      botMasters.includes(qq) ||
      inList(new Y(PLUGIN_CFG), '绝对主人', qq)
    if (!isMaster && !inList(bm, '白名单', qq)) return false

    await e.reply([segment.at(e.user_id), isMaster ? ' 不可以伪造主人哦！' : ' 不可以这样！'])
    const muteMin = Number(bm.get('禁言时间')) || 5
    if (e.group?.muteMember) await e.group.muteMember(e.user_id, muteMin * 60)?.catch?.(() => {})
    return true
  }

  /** 昵称：群名片 → 陌生人/好友信息 → QQ 号（兼容 TRSS 的 pickMember 与 icqq 的 getGroupMemberInfo） */
  async getName (e, qq) {
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

  /* ═════════════ 发送 ═════════════ */

  /**
   * OneBot v11（NapCat 等）走原生 forward API：每个节点同时写 user_id/nickname 和 uin/name。
   * NapCat 只认 user_id/nickname，Yunzai 通用转发只写 uin/name，会导致发言人全变成机器人，
   * 所以原生发送失败时直接报错，不再静默回退成「机器人本人」。
   * 其他适配器（icqq 等）没有 sendApi，走通用 makeForwardMsg。
   */
  async send (e, nodes) {
    const bot = (typeof Bot !== 'undefined' && Bot[e.self_id]) || e.bot
    const adapter = bot?.adapter
    if (!bot?.sendApi || typeof adapter?.makeMsg !== 'function') return this.sendGeneric(e, nodes)

    try {
      const messages = []
      for (const node of nodes) {
        // 复用适配器 makeMsg 生成 content（保留图片下载等兼容处理）
        const [content] = await adapter.makeMsg(node.message)
        if (!content?.length) continue
        const uid = String(Number(node.user_id) || 80000000)
        const name = String(node.nickname || '匿名消息')
        messages.push({ type: 'node', data: { user_id: uid, nickname: name, uin: uid, name, content } })
      }
      if (!messages.length) return this.usage(e)

      const isGroup = e.isGroup ?? !!e.group_id
      const res = await bot.sendApi(
        isGroup ? 'send_group_forward_msg' : 'send_private_forward_msg',
        isGroup ? { group_id: e.group_id, messages } : { user_id: e.user_id, messages }
      )
      // TRSS 适配器失败会直接抛错；兼容少数只返回 status: failed 的实现（retcode 1 为异步受理，算成功）
      if (res && (res.status === 'failed' || res.retcode > 1)) {
        throw new Error(res.wording || res.message || res.msg || `retcode ${res.retcode}`)
      }
      return true
    } catch (err) {
      const reason = err?.error?.wording || err?.error?.message || err?.message || String(err)
      logger.error(`[伪造消息] 发送失败：${reason}`)
      await e.reply(`伪造消息发送失败：${reason}`)
      return true
    }
  }

  /** 非 OneBot 适配器：Yunzai 通用合并转发 */
  async sendGeneric (e, nodes) {
    const target = e.group?.makeForwardMsg ? e.group : e.friend?.makeForwardMsg ? e.friend : null
    const forward = target
      ? await target.makeForwardMsg(nodes)
      : await Bot.makeForwardMsg?.(nodes)
    if (!forward) {
      await e.reply('当前环境不支持伪造消息')
      return true
    }
    await e.reply(forward)
    return true
  }

  /* ═════════════ 黑白名单（仅主人） ═════════════ */

  addWhite (e) { return this.editList(e, '白名单', 'add', /^#?伪造加白/) }
  delWhite (e) { return this.editList(e, '白名单', 'del', /^#?伪造删白/) }
  addBlack (e) { return this.editList(e, '黑名单', 'add', /^#?伪造加黑/) }
  delBlack (e) { return this.editList(e, '黑名单', 'del', /^#?伪造删黑/) }
  listWhite (e) { return this.showList(e, '白名单') }
  listBlack (e) { return this.showList(e, '黑名单') }

  async editList (e, key, action, cmd) {
    if (!e.isMaster) {
      await e.reply('只有主人才能管理伪造名单哦')
      return false
    }
    const raw = e.at || e.msg.replace(cmd, '').trim()
    if (!raw) return e.reply('请 @ 对方或附带其 QQ 号')
    const id = Number(raw) || String(raw)

    const bm = new Y(BM_PATH)
    const exists = inList(bm, key, id)
    if (action === 'add') {
      if (exists) return e.reply(`该用户已在${key}中`)
      bm.addVal(key, id, 'Array')
      return e.reply(LIST_INFO[key].add)
    }
    if (!exists) return e.reply(`该用户不在${key}中`)
    idForms(id).forEach(v => bm.value(key, v) && bm.delVal(key, v))
    return e.reply(LIST_INFO[key].del)
  }

  async showList (e, key) {
    if (!e.isMaster) {
      await e.reply('只有主人才能查看伪造名单哦')
      return false
    }
    const list = new Y(BM_PATH).get(key) || []
    return e.reply(list.length ? `${LIST_INFO[key].title}：\n${list.join('\n')}` : `${key}为空`)
  }
}
