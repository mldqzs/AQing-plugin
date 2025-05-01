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
          reg,
          fnc: 'fudu',
          log: false
        }
      ]
    })
  }

  async fudu (e) {
    if (e.user_id === e.self_id || /^(2854|3889)/.test(e.user_id)) return false
    e.reply(e.msg.replace(reg, '$&$1'))
    return false
  }
}
