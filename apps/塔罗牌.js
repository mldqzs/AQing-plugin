import plugin from '../../../lib/plugins/plugin.js'
import fetch from 'node-fetch'
import common from '../../../lib/common/common.js'

export class TarotPlugin extends plugin {
  constructor() {
    super({
      name: '塔罗牌',
      dsc: '塔罗牌占卜解读',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#?(塔罗牌|tarot)$',
          fnc: 'tarot'
        }
      ]
    })
  }

  async tarot(e) {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    const date_time = `${year}-${month}-${day}`;

    const cacheKey = `Yunzai:taluo:${e.user_id}_daka`;

    // 读取当天缓存记录
    let record = null;
    try {
      record = JSON.parse(await redis.get(cacheKey));
    } catch {
      record = null;
    }

    // 当天已抽过：直接返回当天抽到的那副牌
    if (record && record.date === date_time && Array.isArray(record.data)) {
      const msg = await common.makeForwardMsg(
        e,
        this.buildForwardMsg(record.data, true),
        '塔罗牌解读结果（今日已抽）'
      );
      await e.reply([segment.at(e.user_id), '\n你今天已经抽过啦，这是今日的牌面~']);
      await e.reply(msg);
      return true;
    }

    try {
      // 请求API获取数据
      const res = await fetch('https://oiapi.net/API/Tarot')
      const { code, data } = await res.json()

      if (code !== 1 || !data?.length) {
        await e.reply('塔罗牌连接失败...')
        return true
      }

      const msg = await common.makeForwardMsg(e, this.buildForwardMsg(data, false), '塔罗牌解读结果')

      // 缓存当天牌面，保留约 2 天后自动过期
      await redis.set(cacheKey, JSON.stringify({ date: date_time, data }), { EX: 60 * 60 * 48 });

      await e.reply(msg)
      return true

    } catch (err) {
      console.error(err)
      await e.reply('塔罗牌解析失败')
      return true
    }
  }

  /**
   * 根据牌面数据构建转发消息数组
   * @param {Array} data 塔罗牌数据
   * @param {boolean} replay 是否为当天重复展示
   */
  buildForwardMsg(data, replay = false) {
    const forwardMsg = []

    forwardMsg.push(`✨ 塔罗牌解读 ✨${replay ? '（今日牌面）' : ''}\n━━━━━━━━━━━━━━`)

    data.forEach(card => {
      let text = `${card.position} - ${card.name_cn}(${card.name_en})\n`
      text += `📖 含义: ${card.meaning}\n`
      text += `🎴 牌型: ${card.type}\n`

      const positionText = card.type === '正位' ? card.正位 : card.逆位
      text += `💬 解读:\n${positionText.split('、').map(item => `• ${item}`).join('\n')}`

      forwardMsg.push(text)
      forwardMsg.push(segment.image(card.pic))
      forwardMsg.push('━━━━━━━━━━━━━━')
    })

    forwardMsg.push(
      '※ 解牌须知 ※\n' +
      '1. 正位表示常规含义\n' +
      '2. 逆位代表需要注意\n' +
      '3. 需结合整体牌阵解读\n' +
      '🔮 仅供娱乐参考'
    )

    return forwardMsg
  }
}
