
import Y from '../Yaml/y.js'
import { getVersionInfo, getLatestChangelog } from '../model/version.js'

const CFG_PATH = './plugins/AQing-plugin/config/config/config.yaml'

export default class BotNameModifier extends plugin {
  constructor() {
    super({
      name: 'AQ: 插件管理',
      dsc: '插件管理',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: '^#修改机器人名字(.+)$',
          fnc: 'modifyName',
        },
        {
          reg: '^#?阿晴版本$',
          fnc: 'showVersion',
        },
      ],
    })
  }

  async modifyName(e) {
    if (!e.isMaster) {
      e.reply('只有主人才能修改机器人名字哦！')
      return true
    }

    const newBotName = e.msg.match(/^#修改机器人名字(.+)$/)[1].trim()
    if (!newBotName) {
      e.reply('新名字不能为空哦！')
      return true
    }

    // 直接写入 config.yaml 的 botname 字段，提示语实时读取即时生效
    const cfg = new Y(CFG_PATH)
    cfg.set('botname', newBotName)
    e.reply(`机器人名字已成功修改为：${newBotName}\n（上/下班命令已即时生效，无需重启）`)
    return true
  }

  async showVersion(e) {
    const { yunzaiVersion, pluginVersion } = getVersionInfo()
    const changelog = getLatestChangelog()
    let msg = '【阿晴插件 版本信息】\n'
    msg += `━━━━━━━━━━━━━━\n`
    msg += `TRSS-Yunzai：v${yunzaiVersion}\n`
    msg += `AQing-plugin：v${pluginVersion}\n`
    if (changelog) {
      msg += `━━━━━━━━━━━━━━\n`
      msg += `最新更新：\n${changelog}`
    }
    e.reply(msg)
    return true
  }
}
