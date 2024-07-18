
import Y from '../Yaml/y.js'
import crypto from 'crypto'
const _path = process.cwd();
let path = './plugins/AQing-plugin/config/config/config.yaml'
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
          ]
      })
  }


  async zr(e) {
    let mst = await Y.getread(path)
    let uid = mst.绝对主人;
    if (!uid.includes(e.user_id)){
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
      else{return await this.e.reply(this.addmaster(user_id))}
    } else {
      const cfg = new Y('./config/config/other.yaml')
      if (cfg.value('masterQQ', user_id)) return e.reply([segment.at(user_id), "这个憨憨已经是主人了哦"])
      return await this.e.reply(this.addmaster(user_id))
    }
  }

   async del (e) {
    let mst = await Yaml.getread(path)
    let uid = mst.绝对主人;
    if (!uid.includes(e.user_id)){
        e.reply(`暂无权限`)
        return false
    }

    let user_id = e.at || e.msg.replace(/#|删除主人/g, '')
    user_id = Number(user_id) || String(user_id)

    if (!user_id) return await e.reply('哎呀，你这样我不知道是谁了啦')
    const cfg = new Y('./config/config/other.yaml')
    if (!cfg.value('masterQQ', user_id)) return await e.reply("这个人是谁呀，好像不是我的主人哦", false, { at: true })
    cfg.delVal('masterQQ', user_id)
    return await e.reply([segment.at(user_id), '你不是我的主人了！'])
  }

  addmaster (user_id) {
    const cfg = new Y('./config/config/other.yaml')
    cfg.addVal('masterQQ', user_id, 'Array')
    return [segment.at(user_id), '你好，你已经是我的主人了！']
  }
  async st (e) {
    let user_id = e.at || e.msg.replace(/#设置绝对主人/, '') || e.user_id
    user_id = Number(user_id) || String(user_id)
    let mst = await Yaml.getread(path)
    let uid = mst.绝对主人;
    /** 检测是否为触发用户自身 */
    if (user_id === e.user_id) {
      if (uid.includes(e.user_id)) {
        return await e.reply([segment.at(user_id), "你好像是绝对主人哦"])
      }
    } else { 
      if (!uid.includes(e.user_id)) return await e.reply('暂无权限')
      const cfg = new Y('./plugins/AQing-plugin/config/config/config.yaml')
      if (cfg.value('绝对主人', user_id)) return e.reply([segment.at(user_id), "这个憨憨已经是绝对主人了哦"])
      return await this.e.reply(this.add(user_id))
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
    let mst = await Yaml.getread(path)
    let uid = mst.绝对主人;
    if (!uid.includes(e.user_id)){
        e.reply(`暂无权限`)
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
  }
