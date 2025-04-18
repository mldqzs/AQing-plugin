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
    let date_time2 = await redis.get(`Yunzai:taluo:${e.user_id}_daka`);date_time2 = JSON.parse(date_time2);//获取用户最后一次打卡日期
    if (date_time === date_time2) {
        let msg = [
            segment.at(e.user_id),
            `\n你今天已经抽过了哦`
        ]
        e.reply(msg)
        return;
      }
    try {
      // 请求API获取数据
      const res = await fetch('https://oiapi.net/API/Tarot')
      const { code, data } = await res.json()
      
      if (code !== 1 || !data?.length) {
        await e.reply('塔罗牌连接失败...')
        return true
      }

      // 构建转发消息数组
      const forwardMsg = []
      
      // 添加标题
      forwardMsg.push("✨ 塔罗牌解读 ✨\n━━━━━━━━━━━━━━")
      
      // 处理每张牌
      data.forEach(card => {
        // 文字部分
        let text = `${card.position} - ${card.name_cn}(${card.name_en})\n`
        text += `📖 含义: ${card.meaning}\n`
        text += `🎴 牌型: ${card.type}\n`
        
        // 正逆位处理
        const positionText = card.type === '正位' ? card.正位 : card.逆位
        text += `💬 解读:\n${positionText.split('、').map(item => `• ${item}`).join('\n')}`
        
        // 图片部分
        const img = segment.image(card.pic)
        
        // 添加到消息数组
        forwardMsg.push(text)
        forwardMsg.push(img)
        forwardMsg.push('━━━━━━━━━━━━━━')
      })

      // 添加底部说明
      forwardMsg.push(
        '※ 解牌须知 ※\n' +
        '1. 正位表示常规含义\n' +
        '2. 逆位代表需要注意\n' +
        '3. 需结合整体牌阵解读\n' +
        '🔮 仅供娱乐参考'
      )

      // 生成转发消息
      const msg = await common.makeForwardMsg(e, forwardMsg, '塔罗牌解读结果')
      redis.set(`Yunzai:taluo:${e.user_id}_daka`, JSON.stringify(date_time));
      
      // 发送消息
      await e.reply(msg)

      return true

    } catch (err) {
      console.error(err)
      await e.reply('塔罗牌解析失败')
      return true
    }
  }
}