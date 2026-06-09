
import Y from '../Yaml/y.js'
import crypto from 'crypto'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
const _path = process.cwd().replace(/\\/g, '/');
let s = {}

export class example extends plugin {
  constructor() {
      super({
          name: 'AQ:主人管理',
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


  async zr(e) {
    const mst = new Y('./plugins/AQing-plugin/config/config/config.yaml')
    if (!mst.value('绝对主人', e.user_id)){
        e.reply(`还没有绝对主人或者你不是绝对主人，请先#设置绝对主人`)
        return false
    }

    let user_id = e.at || e.msg.replace(/#增加主人/, '') || e.user_id
    user_id = Number(user_id) || String(user_id)

    /** 检测是否为触发用户自身 */
    if (user_id === e.user_id) {
      if (e.isMaster) {
        return await e.reply([segment.at(user_id), "主人不要开玩笑啦"])
      }
      else{return await e.reply(this.addmaster(user_id))}
    } else {
      const cfg = new Y('./config/config/other.yaml')
      if (cfg.value('master', `${Bot.uin}:${user_id}`)) return e.reply([segment.at(user_id), "这个憨憨已经是主人了哦"])
      return await e.reply(this.addmaster(user_id))
    }
  }

   async del (e) {
    const mst = new Y('./plugins/AQing-plugin/config/config/config.yaml')
    if (!mst.value('绝对主人', e.user_id)){
        e.reply(`无权限`)
        return false
    }

    let user_id = e.at || e.msg.replace(/#|删除主人/g, '')
    user_id = Number(user_id) || String(user_id)

    if (!user_id) return await e.reply('哎呀，你这样我不知道是谁了啦')
    const cfg = new Y('./config/config/other.yaml')
    if (!cfg.value('master', `${Bot.uin}:${user_id}`)) return await e.reply("这个人是谁呀，好像不是我的主人哦", false, { at: true })
    cfg.delVal('master', `${Bot.uin}:${user_id}`)
    return await e.reply([segment.at(user_id), '你不是我的主人了！'])
  }

  addmaster (user_id) {
    const cfg = new Y('./config/config/other.yaml')
    cfg.addVal('master', `${Bot.uin}:${user_id}`, 'Array')
    return [segment.at(user_id), '你好，你已经是我的主人了！']
  }
  async st (e) {
    let user_id = e.at || e.msg.replace(/#设置绝对主人/, '') || e.user_id
    user_id = Number(user_id) || String(user_id)
    const mst = new Y('./plugins/AQing-plugin/config/config/config.yaml')
    /** 检测是否为触发用户自身 */
    if (user_id === e.user_id) {
      if (mst.value('绝对主人', e.user_id)) {
        return await e.reply([segment.at(user_id), "你好像是绝对主人哦"])
      }
    } else { 
      if (!mst.value('绝对主人', e.user_id)) return await e.reply('暂无权限')
      const cfg = new Y('./plugins/AQing-plugin/config/config/config.yaml')
      if (cfg.value('绝对主人', user_id)) return e.reply([segment.at(user_id), "这个憨憨已经是绝对主人了哦"])
      return await e.reply(this.add(user_id))
    }

    /** 生成验证码 */
    s[e.user_id] = { user_id, s: crypto.randomUUID() }
    logger.mark(`【AQ】绝对主人验证码：${logger.green(s[e.user_id].s)}`)
    await e.reply([segment.at(e.user_id), '验证码已发送，请查看控制台'])
    /** 开始上下文 */
    return await this.setContext('Set')
  }
    Set () {
      /** 结束上下文 */
      this.finish('Set')
      if (this.e.msg.trim() === s[this.e.user_id]?.s) {
        this.e.reply(this.add(s[this.e.user_id]?.user_id))
      } else {
        return this.reply([segment.at(this.e.user_id), 'QAQ验证码错了哎'])
      }
    }
    add (user_id) {
      const cfg = new Y('./plugins/AQing-plugin/config/config/config.yaml')
      cfg.addVal('绝对主人', user_id, 'Array')
      return [segment.at(user_id), '你已成为我的绝对主人了哦！']
    }

  async de (e) {
    const mst = new Y('./plugins/AQing-plugin/config/config/config.yaml')
    if (!mst.value('绝对主人', e.user_id)){
        e.reply(`无权限`)
        return false
    }

    let user_id = e.at || e.msg.replace(/#|删除绝对主人/g, '')
    user_id = Number(user_id) || String(user_id)

    if (!user_id) return await e.reply('哎呀，你这样我不知道是谁了啦')
    const cfg = new Y('./plugins/AQing-plugin/config/config/config.yaml')
    if (!cfg.value('绝对主人', user_id)) return await e.reply("这个人都不是我的绝对主人了啦", false, { at: true })
    cfg.delVal('绝对主人', user_id)
    return await e.reply([segment.at(user_id), '你不是我的绝对主人了！'])
  }




  async listMasters(e) {
    const mst = new Y('./plugins/AQing-plugin/config/config/config.yaml')
    if (!mst.value('绝对主人', e.user_id)){
        e.reply(`无权限`)
        return false
    }

    const cfg = new Y('./config/config/other.yaml')
    const masters = cfg.get('master')
    if (!masters || masters.length === 0) {
      return await e.reply('目前还没有主人。')
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
    return await e.reply('当前的主人有:\n' + list.map(m => `${m.nickname}(${m.qq})`).join('\n'))
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
