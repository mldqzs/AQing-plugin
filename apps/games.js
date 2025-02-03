import plugin from '../../../lib/plugins/plugin.js';

// 游戏状态存储结构：Map<群号, { answer: 答案, timer: 超时计时器, active: 是否进行中 }>
const gameState = new Map();

export class example extends plugin {
  constructor() {
    super({
      name: 'AQ：成语游戏',
      dsc: '看图猜成语小游戏',
      event: 'message',
      priority: 4888,
      rule: [
        { reg: '^看图猜成语$', fnc: 'startGame' },
        { reg: '^猜成语\\s*(.*)$', fnc: 'submitAnswer' },
        { reg: '^提示$', fnc: 'getHint' }
      ]
    })
  }

  /** 开始游戏 */
  async startGame(e) {
    // 检查现有游戏状态
    if (this.checkGameState(e.group_id)) {
      return e.reply('当前已有进行中的游戏，请先完成上一轮')
    }

    try {
      const apiUrl = `https://xiaoapi.cn/API/game_ktccy.php?msg=开始游戏&id=${Bot.uin}`
      const res = await fetch(apiUrl)
      
      if (!res.ok) throw new Error(`API响应异常: ${res.status}`)
      const data = await res.json()

      // 初始化游戏状态
      gameState.set(e.group_id, {
        answer: data.data.answer,
        timer: this.setTimeout(e.group_id),
        active: true
      })

      const msg = [
        data.data.msg,
        segment.image(data.data.pic),
        '\n请使用以下指令参与：',
        '1. 猜成语 [答案] - 提交答案',
        '2. 提示 - 获取提示',
        '（60秒后自动揭晓答案）'
      ]
      await e.reply(msg)
      
    } catch (err) {
      console.error('[游戏启动失败]', err)
      await e.reply('游戏启动失败，请稍后再试')
    }
    return true
  }

  /** 提交答案 */
  async submitAnswer(e) {
    if (!this.validateGame(e.group_id)) return

    const answer = e.msg.replace('猜成语', '').trim()
    if (!answer) return e.reply('请提供要猜测的成语')

    try {
      const apiUrl = `https://xiaoapi.cn/API/game_ktccy.php?msg=我猜${encodeURIComponent(answer)}&id=${Bot.uin}`
      const res = await fetch(apiUrl)
      
      if (!res.ok) throw new Error(`API响应异常: ${res.status}`)
      const data = await res.json()

      if (data.data.msg.includes('不对')) {
        await e.reply([
          '答案不正确，再想想吧~',
          '可以使用【提示】获取帮助'
        ])
      } else {
        this.clearGameState(e.group_id)
        await e.reply([
          '🎉 恭喜答对啦！',
          segment.image('https://api.lolimi.cn/API/tup/xjj.php'),
          `正确答案：${answer}`
        ])
      }
    } catch (err) {
      console.error('[答案提交失败]', err)
      await e.reply('答案验证失败，请稍后再试')
    }
    return true
  }

  /** 获取提示 */
  async getHint(e) {
    if (!this.validateGame(e.group_id)) return

    try {
      const apiUrl = `https://xiaoapi.cn/API/game_ktccy.php?msg=提示&id=${Bot.uin}`
      const res = await fetch(apiUrl)
      
      if (!res.ok) throw new Error(`API响应异常: ${res.status}`)
      const data = await res.json()
      
      await e.reply([
        '🕵️♂️ 提示来啦：',
        data.data.msg,
      ])
    } catch (err) {
      console.error('[提示获取失败]', err)
      await e.reply('提示获取失败，请直接尝试猜答案')
    }
    return true
  }

  /** 验证游戏状态 */
  validateGame(groupId) {
    if (!gameState.get(groupId)?.active) {
      this.reply('当前没有进行中的游戏，请先发送【看图猜成语】开始游戏')
      return false
    }
    return true
  }

  /** 检查重复游戏 */
  checkGameState(groupId) {
    return gameState.has(groupId) && gameState.get(groupId).active
  }

  /** 设置超时定时器 */
  setTimeout(groupId) {
    return setTimeout(async () => {
      const answer = gameState.get(groupId)?.answer
      await this.reply([
        '⏰ 时间到！',
        `正确答案是：${answer}`,
        '发送【看图猜成语】开始新游戏'
      ])
      this.clearGameState(groupId)
    }, 60000)
  }

  /** 清理游戏状态 */
  clearGameState(groupId) {
    const state = gameState.get(groupId)
    if (state) {
      clearTimeout(state.timer)
      gameState.delete(groupId)
    }
  }
}