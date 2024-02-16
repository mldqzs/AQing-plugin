import Yaml from '../Yaml/Yaml.js'
import Y from '../Yaml/y.js'
const _path = process.cwd();
let path = './plugins/AQing-plugin/config/config/config.yaml'


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
          ]
      })
  }


  async zr(e) {
    let mst = await Yaml.getread(path)
    let uid = mst.绝对主人;
    if (!uid.includes(e.user_id)){
        e.reply(`还没有绝对主人或者你不是绝对主人，请使用锅巴或者修改配置文件设置绝对主人`)
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
  }