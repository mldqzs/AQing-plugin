
import Y from '../Yaml/y.js'
import crypto from 'crypto'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
const _path = process.cwd().replace(/\\/g, '/');
let s = {}

export class example extends plugin {
  constructor() {
      super({
          name: 'AQ：主人管理',
          dsc: '主人管理',
          event: 'message',
          priority: 5,
          rule: [
            {
              reg: /^#增加主人.*/,
              fnc: 'zr'
            },
            {
              reg: /^#删除主人.*/,
              fnc: 'del'
            },
            {
              reg: /^#设置绝对主人.*/,
              fnc: 'st'
            },
            {
              reg: /^#删除绝对主人.*/,
              fnc: 'de'
            },
            {
              reg: /^#主人列表/,
              fnc: 'listMasters'
            }
          ]
      })
  }

  /** 判断指令发起者是否为绝对主人 */
  isAbsMaster (user_id) {
    const cfg = new Y('./plugins/AQing-plugin/config/config/config.yaml')
    return !!cfg.value('绝对主人', user_id)
  }

  async zr (e) {
    if (!this.isAbsMaster(e.user_id)) {
      await e.reply('您不是绝对主人，无权增加主人。若尚未设置绝对主人，请先发送 #设置绝对主人。')
      return false
    }

    let user_id = e.at || e.msg.replace(/#增加主人/, '').trim() || e.user_id
    user_id = Number(user_id) || String(user_id)

    const cfg = new Y('./config/config/other.yaml')
    if (cfg.value('master', `${e.self_id}:${user_id}`)) {
      return await e.reply([segment.at(user_id), ' 已经是主人了，无需重复添加。'])
    }
    return await e.reply(this.addmaster(e, user_id))
  }

  async del (e) {
    if (!this.isAbsMaster(e.user_id)) {
      await e.reply('您不是绝对主人，无权删除主人。')
      return false
    }

    let user_id = e.at || e.msg.replace(/#|删除主人/g, '').trim()
    user_id = Number(user_id) || String(user_id)

    if (!user_id) return await e.reply('未识别到目标用户，请 @ 对方或附带其 QQ 号。')
    const cfg = new Y('./config/config/other.yaml')
    const inMaster = cfg.value('master', `${e.self_id}:${user_id}`)
    const inMasterQQ = cfg.value('masterQQ', user_id)
    if (!inMaster && !inMasterQQ) {
      return await e.reply([segment.at(user_id), ' 并不是主人，无需删除。'])
    }
    // 与本体一致：全局 masterQQ 与该 Bot 的 master 一并移除
    if (inMaster) cfg.delVal('master', `${e.self_id}:${user_id}`)
    if (inMasterQQ) cfg.delVal('masterQQ', user_id)
    return await e.reply([segment.at(user_id), ' 的主人身份已解除。'])
  }

  // 与云崽本体 #设置主人 保持一致：同时写入全局 masterQQ 和当前 Bot 的 master，
  // 这样新主人在所有权限校验（cfg.masterQQ / cfg.master[e.self_id]）下都生效，
  // 而不只是单独某个机器人的主人。
  // 注意 master 必须用 e.self_id（当前收到指令的 Bot 账号），不能用 Bot.uin：
  // Bot.uin 是多账号数组，模板字符串化时多账号下取末位/随机值，会写到错误的 Bot 名下。
  addmaster (e, user_id) {
    const cfg = new Y('./config/config/other.yaml')
    if (!cfg.value('masterQQ', user_id)) cfg.addVal('masterQQ', user_id, 'Array')
    if (!cfg.value('master', `${e.self_id}:${user_id}`)) cfg.addVal('master', `${e.self_id}:${user_id}`, 'Array')
    return [segment.at(user_id), ' 已被设置为主人。']
  }

  async st (e) {
    let user_id = e.at || e.msg.replace(/#设置绝对主人/, '').trim() || e.user_id
    user_id = Number(user_id) || String(user_id)

    // 为他人设置绝对主人：仅现有绝对主人可操作
    if (user_id !== e.user_id) {
      if (!this.isAbsMaster(e.user_id)) return await e.reply('您不是绝对主人，无权设置他人为绝对主人。')
      if (this.isAbsMaster(user_id)) return await e.reply([segment.at(user_id), ' 已经是绝对主人了，无需重复设置。'])
      return await e.reply(this.add(user_id))
    }

    // 为自己设置：已是绝对主人则无需重复设置
    if (this.isAbsMaster(e.user_id)) {
      return await e.reply('您已经是绝对主人了，无需重复设置。')
    }

    // 首次设置自己为绝对主人：需控制台验证码，确保操作者拥有服务器权限
    s[e.user_id] = { user_id, s: crypto.randomUUID() }
    logger.mark(`【AQ】绝对主人验证码：${logger.green(s[e.user_id].s)}`)
    await e.reply([segment.at(e.user_id), ' 验证码已发送至控制台，请回复验证码以完成设置。'])
    return await this.setContext('Set')
  }

  Set () {
    this.finish('Set')
    const ctx = s[this.e.user_id]
    delete s[this.e.user_id]
    if (!ctx) return
    if (this.e.msg.trim() === ctx.s) {
      return this.reply(this.add(ctx.user_id))
    }
    return this.reply('验证码有误，设置已取消。')
  }

  add (user_id) {
    const cfg = new Y('./plugins/AQing-plugin/config/config/config.yaml')
    cfg.addVal('绝对主人', user_id, 'Array')
    return [segment.at(user_id), ' 已被设置为绝对主人。']
  }

  async de (e) {
    if (!this.isAbsMaster(e.user_id)) {
      await e.reply('您不是绝对主人，无权删除绝对主人。')
      return false
    }

    let user_id = e.at || e.msg.replace(/#|删除绝对主人/g, '').trim()
    user_id = Number(user_id) || String(user_id)

    if (!user_id) return await e.reply('未识别到目标用户，请 @ 对方或附带其 QQ 号。')
    if (!this.isAbsMaster(user_id)) {
      return await e.reply([segment.at(user_id), ' 并不是绝对主人，无需删除。'])
    }
    const cfg = new Y('./plugins/AQing-plugin/config/config/config.yaml')
    cfg.delVal('绝对主人', user_id)
    return await e.reply([segment.at(user_id), ' 的绝对主人身份已解除。'])
  }

  async listMasters (e) {
    if (!this.isAbsMaster(e.user_id)) {
      await e.reply('您不是绝对主人，无权查看主人列表。')
      return false
    }

    const cfg = new Y('./config/config/other.yaml')
    const masters = cfg.get('master')
    if (!masters || masters.length === 0) {
      return await e.reply('当前暂无主人。')
    }

    /** 从 botuin:qq 形式提取 qq，并去重 */
    const qqList = [...new Set(masters.map(m => String(m).split(':').pop()))].filter(Boolean)

    /** 获取头像、昵称 */
    const list = []
    for (const qq of qqList) {
      list.push({
        qq,
        nickname: await this.getNickname(e, qq),
        avatar: `https://q1.qlogo.cn/g?b=qq&s=640&nk=${qq}`
      })
    }

    const data = {
      tplFile: './plugins/AQing-plugin/resources/html/master/master.html',
      pluResPath: _path,
      saveId: 'master',
      masters: list,
      total: list.length
    }

    const img = await puppeteer.screenshot('master', data)
    if (img) return await e.reply(img)
    /** 截图失败兜底为文字 */
    return await e.reply('当前主人列表：\n' + list.map(m => `${m.nickname}（${m.qq}）`).join('\n'))
  }

  /** 获取昵称，优先群名片，其次陌生人信息，失败回退为 QQ 号 */
  async getNickname(e, qq) {
    try {
      if (e.isGroup && Bot.getGroupMemberInfo) {
        const member = await Bot.getGroupMemberInfo(e.group_id, Number(qq))
        if (member?.card || member?.nickname) return member.card || member.nickname
      }
    } catch {}
    try {
      const info = await Bot.getStrangerInfo?.(Number(qq))
      if (info?.nickname) return info.nickname
    } catch {}
    try {
      const info = await Bot.pickFriend?.(Number(qq))?.getInfo?.()
      if (info?.nickname) return info.nickname
    } catch {}
    return String(qq)
  }
}
