import plugin from '../../../lib/plugins/plugin.js';
import Y from '../Yaml/y.js'

// 配置加载
const m = new Y('./plugins/AQing-plugin/config/config/config.yaml')
const cfg = new Y('./config/config/other.yaml')
const BOT_NAME = m.get('botname') || '机器人'

// 图片资源配置
const IMAGE_MAP = {
  MASTER: 'https://api.lolimi.cn/API/face_worship/',
  ADMIN: 'https://gchat.qpic.cn/gchatpic_new/0/0-0-3342AA8F1C10BE780788320262EB20DF/0',
  OWNER: 'https://gchat.qpic.cn/gchatpic_new/0/0-0-01D0F147B25D3748DA55C82635FE52A4/0',
  DEFAULT: 'http://gchat.qpic.cn/gchatpic_new/0/0-0-69B7103C54C2C5CA445C5C214EC11AB2/0?term=2'
}

export class IdentityCheck extends plugin {
  constructor() {
    super({
      name: 'AQ:身份查询',
      dsc: '群成员身份识别',
      event: 'message',
      priority: 5,
      rule: [{
        reg: '^#?(他|我)是谁\\s*(\\[CQ:at,qq=(\\d+)\\])?$',
        fnc: 'checkIdentity'
      }]
    })
  }

  async checkIdentity(e) {
    try {
      // 处理@机器人的情况
      if (e.atBot) return this.handleBotMention(e)
      
      // 解析查询目标
      const targetId = this.getTargetId(e)
      if (!targetId) return this.replyInvalidTarget(e)

      // 获取身份信息
      const identity = await this.getIdentityInfo(e.group_id, targetId)
      
      // 生成回复内容
      const reply = this.generateReply(e, targetId, identity)
      e.reply(reply)

    } catch (err) {
      console.error('[身份查询失败]', err)
      e.reply('身份识别系统暂时故障，请稍后再试')
    }
    return true
  }

  /** 处理@机器人的情况 */
  handleBotMention(e) {
    const msg = [
      `滚出去！连我都不认识!`,
      segment.image(`https://api.lolimi.cn/API/si/?QQ=${e.user_id}`)
    ]
    e.reply(msg)
    return false
  }

  /** 解析目标用户ID */
  getTargetId(e) {
    const match = e.msg.match(/\[CQ:at,qq=(\d+)\]/)
    return match ? match[1] : e.user_id
  }

  /** 无效目标处理 */
  replyInvalidTarget(e) {
    e.reply('请指定要查询的用户，格式：#他是谁@某人')
    return true
  }

  /** 获取身份信息 */
  async getIdentityInfo(groupId, userId) {
    const isSelfQuery = userId === this.e.user_id
    const memberInfo = await Bot.getGroupMemberInfo(groupId, userId)

    return {
      isAbsoluteMaster: m.value('绝对主人', userId),
      isBotMaster: cfg.value('masterQQ', userId),
      isGroupAdmin: memberInfo.role === 'admin',
      isGroupOwner: memberInfo.role === 'owner',
      isSelfQuery
    }
  }

  /** 生成回复内容 */
  generateReply(e, targetId, identity) {
    // 优先级顺序：绝对主人 > 主人 > 群主 > 管理员 > 普通成员
    if (identity.isAbsoluteMaster) {
      return [
        `这是老大，你们不许欺负TA哦！${BOT_NAME}会盯着你哒！`,
        segment.image(IMAGE_MAP.MASTER)
      ]
    }

    if (identity.isBotMaster) {
      return [
        `这是${BOT_NAME}的主人捏`,
        segment.image(`${IMAGE_MAP.MASTER}?QQ=${targetId}`)
      ]
    }

    if (identity.isGroupOwner) {
      return [
        `这是群主大大，很厉害的哦！`,
        segment.image(IMAGE_MAP.OWNER)
      ]
    }

    if (identity.isGroupAdmin) {
      return [
        '他是这个群的管理员，不要惹他哦~',
        segment.image(IMAGE_MAP.ADMIN)
      ]
    }

    // 处理自我查询的情况
    if (identity.isSelfQuery) {
      return this.handleSelfQuery(e)
    }

    return [
      '这人就是个小卡拉米',
      segment.image(IMAGE_MAP.DEFAULT)
    ]
  }

  /** 处理自我查询 */
  handleSelfQuery(e) {
    if (m.value('绝对主人', e.user_id)) {
      return [
        `你是${BOT_NAME}的老大！${BOT_NAME}可是不会忘记的哦！嘿嘿~`,
        segment.image(IMAGE_MAP.OWNER)
      ]
    }

    if (e.isMaster) {
      return [
        `你是${BOT_NAME}的主人，要保护好${BOT_NAME}哦！`,
        segment.image(IMAGE_MAP.MASTER)
      ]
    }

    if (this.e.member.is_admin) {
      return `你是这个群的管理员，看起来还挺厉害的嘛`
    }

    if (this.e.member.is_owner) {
      return `你是群主大大。${BOT_NAME}要和你告状，刚刚有人欺负${BOT_NAME}!`
    }

    return [
      '你就是个小卡拉米',
      segment.image(IMAGE_MAP.DEFAULT)
    ]
  }
}