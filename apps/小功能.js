import plugin from '../../../lib/plugins/plugin.js'
import setting from '../utils/setting.js'

const reg = /^(.+?)\1+$/
export class example extends plugin {
  constructor () {
    super({
      name: 'AQ：小功能',
      dsc: '小功能',
      event: 'message',
      priority: -Infinity,
      rule: [
        {
          // 复读总开关：「复读开启 / 复读关闭」（全局，仅主人）
          reg: '^复读\\s*(开启|关闭|on|off)$',
          fnc: 'toggleFudu',
          permission: 'master'
        },
        {
          reg,
          fnc: 'fudu',
          log: false
        }
      ]
    })
  }

  // 复读开关（全局，写入 config.fudu，热生效，支持锅巴）
  async toggleFudu (e) {
    const arg = e.msg.trim().replace(/^复读\s*/, '').toLowerCase()
    const turnOn = arg === '开启' || arg === 'on'
    // 先取完整配置再写回，避免覆盖其它配置项
    const cfg = setting.getConfig('config') || {}
    cfg.fudu = turnOn
    setting.setConfig('config', cfg)
    await e.reply(turnOn ? '复读已开启，我会跟着你复读啦~' : '复读已关闭', true)
    return true
  }

  async fudu (e) {
    // 复读开关（默认关闭，可用「复读开启/关闭」或在锅巴/配置文件中开启）
    // 行为：消息由重复内容组成时叠加一节复读，如 11→111、1212→121212
    if (!setting.getConfig('config')?.fudu) return false
    if (e.user_id === e.self_id || /^(2854|3889)/.test(e.user_id)) return false
    e.reply(e.msg.replace(reg, '$&$1'))
    return false
  }
}
