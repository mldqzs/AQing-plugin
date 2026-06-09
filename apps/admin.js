
import setting from '../utils/setting.js'
import lodash from 'lodash'
import yaml from 'yaml'
import path from 'path'
import fs from 'fs'
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVersionInfo, getLatestChangelog } from '../model/version.js'

const currentFileURL = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFileURL);

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

    const newConfig = lodash.set(setting.merge(), 'botname', newBotName)
    setting.analysis(newConfig)

    const configPath = path.join(currentDirectory, '../config/config/config.yaml')
    const configContent = yaml.stringify(newConfig)
    fs.writeFileSync(configPath, configContent, 'utf8')
    e.reply(`机器人名字已成功修改为：${newBotName}`)
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
