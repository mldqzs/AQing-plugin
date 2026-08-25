import plugin from '../../../lib/plugins/plugin.js'
import setting from '../utils/setting.js'
import Y from '../Yaml/y.js'

const cfg = () => setting.getConfig('config') || {}
const pending = new Map()

const getTimeout = () => {
  const t = parseInt(cfg().groupJoinCheckTime)
  return Number.isFinite(t) && t > 0 ? t : 10
}

const isGroupEnabled = (group_id) => {
  const config = cfg()
  if (config.groupJoinCheck !== true) return false
  const list = config.groupJoinCheckGroups
  return Array.isArray(list) && list.map(String).includes(String(group_id))
}

const setGroupEnabled = (group_id, on) => {
  const cur = setting.getConfig('config') || {}
  const list = Array.isArray(cur.groupJoinCheckGroups) ? cur.groupJoinCheckGroups.map(String) : []
  const id = String(group_id)
  const next = on ? [...new Set([...list, id])] : list.filter(v => v !== id)
  setting.setConfig('config', { ...cur, groupJoinCheck: next.length > 0, groupJoinCheckGroups: next })
  return next.length
}

const isAbsMaster = (user_id) => {
  try {
    return !!new Y('./plugins/AQing-plugin/config/config/config.yaml').value('绝对主人', user_id)
  } catch { return false }
}

const getApplicantName = async (e) => {
  const user = e.user_id
  const cached = e.sender?.card || e.sender?.nickname || e.bot?.gml?.get(e.group_id)?.get(user)?.card || e.bot?.gml?.get(e.group_id)?.get(user)?.nickname || e.bot?.fl?.get(user)?.nickname
  if (cached) return cached
  try {
    const info = await e.bot?.pickFriend?.(user)?.getInfo?.(true, true)
    return info?.card || info?.nickname || user
  } catch { return user }
}

async function isApprover (e) {
  if (e.isMaster || isAbsMaster(e.user_id)) return true
  if (['owner', 'admin'].includes(e.sender?.role)) return true
  try {
    const info = await e.member?.getInfo?.()
    if (['owner', 'admin'].includes(info?.role)) return true
  } catch {}
  try {
    if (e.member?.is_admin) return true
  } catch {}
  return false
}

function enqueueJoinRequest (e) {
  if (!pending.has(e.group_id)) pending.set(e.group_id, [])
  const list = pending.get(e.group_id)
  const dup = list.findIndex(i => i.user_id === e.user_id)
  if (dup >= 0) {
    clearTimeout(list[dup].timer)
    list.splice(dup, 1)
  }

  const item = {
    flag: e.flag,
    user_id: e.user_id,
    comment: e.comment || '',
    approve: e.approve.bind(e),
    bot: e.bot,
    group_id: e.group_id,
    timer: null,
  }
  item.timer = setTimeout(() => expire(e.group_id, item), getTimeout() * 60 * 1000)
  list.push(item)
}

async function expire (group_id, item) {
  const list = pending.get(group_id)
  if (!list) return
  const idx = list.indexOf(item)
  if (idx < 0) return
  list.splice(idx, 1)
  if (!list.length) pending.delete(group_id)
  try {
    await item.bot.pickGroup(group_id).sendMsg(
      `QQ ${item.user_id} 的入群申请已超时（${getTimeout()}分钟内未审批），已从待审列表移除`
    )
  } catch {}
}

export class GroupJoinApprove extends plugin {
  constructor () {
    super({
      name: 'AQ：入群审核',
      dsc: '有人申请加群时群内播报，管理员/群主/主人回复同意或拒绝审批',
      event: '*',
      priority: 100,
      rule: [
        { event: 'request.group.add', reg: '^[\\s\\S]*$', fnc: 'request', log: false },
        { event: 'message.group.*', reg: '^#?(开启|开|打开|关闭|关)入群审核$', fnc: 'toggle' },
        { event: 'message.group.*', reg: '^#?入群审核$', fnc: 'status' },
        { event: 'message.group.*', reg: '^#?(同意|拒绝)[。.!！~～]?$', fnc: 'deal' },
      ]
    })
  }

  async request (e) {
    if (!isGroupEnabled(e.group_id)) return false
    if (typeof e.approve !== 'function') {
      logger.warn('[AQ入群审核] 当前适配器不支持 approve，忽略该入群申请')
      return false
    }

    const nickname = await getApplicantName(e)
    try {
      await e.reply([
        [
          '有新的入群申请啦！',
          '',
        ].join('\n'),
        segment.image(`https://q.qlogo.cn/g?b=qq&s=100&nk=${e.user_id}`),
        [
          '',
          `昵称：${nickname}`,
          `QQ：${e.user_id}`,
          `验证：${e.comment || '无'}`,
          '',
          `发送 同意 / 拒绝 处理申请`,
          `有效时间：${getTimeout()}分钟`,
        ].join('\n')
      ])
    } catch (err) {
      logger.warn(`[AQ入群审核] 播报入群申请失败：${err?.message || err}`)
    }
    enqueueJoinRequest(e)
    return true
  }

  async toggle (e) {
    if (!e.isGroup) {
      await e.reply('入群审核需要在群里开启哦~')
      return true
    }
    if (!e.isMaster && !isAbsMaster(e.user_id)) {
      await e.reply('只有主人能开关入群审核哦~ ฅ(>﹏<)ฅ')
      return true
    }
    const on = /开启|开|打开/.test(e.msg)
    const total = setGroupEnabled(e.group_id, on)
    await e.reply(on
      ? `本群入群审核已开启~ 以后本群有人申请加群我会播报，回复「同意」或「拒绝」即可审批 ฅ^•ﻌ•^ฅ\n当前已开启 ${total} 个群`
      : `本群入群审核已关闭~ 加群申请交还给群主管理员在 QQ 里处理 (=^･ω･^=)\n当前已开启 ${total} 个群`)
    return true
  }

  async status (e) {
    if (!e.isGroup) {
      await e.reply('入群审核状态请在群里查看哦~')
      return true
    }
    const list = pending.get(e.group_id)
    await e.reply(isGroupEnabled(e.group_id)
      ? `本群入群审核已开启，审批超时${getTimeout()}分钟；当前待审申请 ${list?.length || 0} 条`
      : '本群入群审核已关闭')
    return true
  }

  async deal (e) {
    const list = pending.get(e.group_id)
    if (!list?.length) return false

    if (!(await isApprover(e))) {
      await e.reply('只有群主、管理员或主人才能审批入群申请哦~', true)
      return true
    }

    const approve = e.msg.startsWith('同意')
    const item = list.shift()
    clearTimeout(item.timer)
    if (!list.length) pending.delete(e.group_id)

    try {
      await item.approve(approve, approve ? '群内管理员同意' : '群内管理员拒绝')
    } catch (err) {
      await e.reply(`操作失败了：${err?.message || err}`, true)
      return true
    }

    const rest = list.length ? `（还有 ${list.length} 条待审）` : ''
    await e.reply(`${approve ? '✅ 已同意' : '❌ 已拒绝'} QQ ${item.user_id} 的入群申请${rest}`, true)
    return true
  }
}
