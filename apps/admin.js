
import setting from '../utils/setting.js'
import lodash from 'lodash'
import yaml from 'yaml'
import path from 'path'
import fs from 'fs'
import puppeteer from 'puppeteer'
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 获取当前文件的目录路径
const currentFileURL = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFileURL);

// 插件信息
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
          reg: '^#阿晴版本$',
          fnc: 'showChangelog',
        },
      ],
    })
  }

  async modifyName(e) {
    if (!this.e.isMaster) {
      e.reply('只有主人才能修改机器人名字哦！')
      return true
    }

    const newBotName = e.msg.match(/^#修改机器人名字(.+)$/)[1].trim()
    if (!newBotName) {
      e.reply('新名字不能为空哦！')
      return true
    }

    // 更新设置中的机器人名字
    const newConfig = lodash.set(setting.merge(), 'config.botname', newBotName)
    setting.analysis(newConfig)

    // 保存设置到 config.yaml
    const configPath = path.join(currentDirectory, '../config/config/config.yaml')
    const configContent = yaml.stringify(newConfig)
    fs.writeFileSync(configPath, configContent, 'utf8')
    e.reply(`机器人名字已成功修改为：${newBotName}`)
    return true
  }


}