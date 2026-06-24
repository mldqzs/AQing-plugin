import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import {
  PRESETS, normDifficulty, colLabel,
  createGame, dig, toggleFlag, parseCoord,
  renderGrid, flagCount, addContribution
} from '../utils/minesweeper.js'

const _path = process.cwd().replace(/\\/g, '/')
const TPL = './plugins/AQing-plugin/resources/html/saolei/saolei.html'

// 进行中的对局保留 2 小时无操作自动失效
const GAME_TTL = 60 * 60 * 2

/** 本群/私聊的作用域 key：群按群号、私聊按用户 */
function scope(e) {
  return e.group_id ? `g${e.group_id}` : `u${e.user_id}`
}
const gameKey = gid => `AQ:saolei:game:${gid}`
const rankKey = gid => `AQ:saolei:rank:${gid}`

export class saolei extends plugin {
  constructor() {
    super({
      name: 'AQ：扫雷',
      dsc: '群扫雷小游戏，带积分排行',
      event: 'message',
      priority: 600,
      rule: [
        { reg: '^#?扫雷(帮助|玩法|规则|怎么玩)$', fnc: 'howto' },
        { reg: '^#?扫雷(排名|排行|排行榜|榜)$', fnc: 'rank' },
        { reg: '^#?(我的扫雷|扫雷战绩|扫雷统计)$', fnc: 'myStat' },
        { reg: '^#?扫雷(认输|投降|退出|结束|放弃|重开|重置)$', fnc: 'giveup' },
        { reg: '^#?扫雷(简单|中等|困难|初级|中级|高级|新手|普通|地狱)?$', fnc: 'start' },
        { reg: '^(挖|点|翻|开|挖开|点开)\\s*[A-La-l]?\\s*\\d{1,2}\\s*[A-La-l]?$', fnc: 'dig' },
        { reg: '^(旗|标|标记|插旗|拔旗|取消旗|去旗)\\s*[A-La-l]?\\s*\\d{1,2}\\s*[A-La-l]?$', fnc: 'flag' }
      ]
    })
  }

  async loadGame(gid) {
    try {
      const raw = await redis.get(gameKey(gid))
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  async saveGame(gid, g) {
    await redis.set(gameKey(gid), JSON.stringify(g), { EX: GAME_TTL })
  }

  async clearGame(gid) {
    try { await redis.del(gameKey(gid)) } catch {}
  }

  /** ───────────── 开始一局 ───────────── */
  async start(e) {
    const gid = scope(e)
    const exist = await this.loadGame(gid)
    if (exist && exist.status === 'playing') {
      await e.reply('本局扫雷还没结束哦，继续挖或发「扫雷认输」结束这局~')
      await this.sendBoard(e, gid, exist)
      return true
    }
    const m = e.msg.match(/扫雷(简单|中等|困难|初级|中级|高级|新手|普通|地狱)?/)
    const diff = normDifficulty(m && m[1])
    const g = createGame(diff, { id: String(e.user_id), name: e.sender?.card || e.sender?.nickname || e.user_id })
    await this.saveGame(gid, g)
    const p = PRESETS[diff]
    await e.reply([
      `🎮 扫雷开局！难度【${diff}】 ${p.rows}×${p.cols}，${p.mines} 颗雷`,
      `\n挖格：发「挖 B3」；插旗：发「旗 B3」（列字母+行数字）`,
      `\n大家一起挖，通关 ${p.reward} 分按各人出力分；发「扫雷排名」看排行`
    ])
    await this.sendBoard(e, gid, g)
    return true
  }

  /** ───────────── 挖格 ───────────── */
  async dig(e) {
    const gid = scope(e)
    const g = await this.loadGame(gid)
    if (!g || g.status !== 'playing') return false // 没在玩就别抢话
    const co = parseCoord(g, e.msg)
    if (!co) { await e.reply('坐标看不懂，发「挖 B3」这种：列字母(A-L)+行数字'); return true }

    const r = dig(g, co.r, co.c)
    if (!r.ok) {
      const tip = { opened: '这格已经翻开啦', flagged: '这格插着旗，先「拔旗 ' + e.msg.replace(/[^A-La-l0-9]/g, '') + '」再挖', over: '这局已经结束了' }
      await e.reply(tip[r.reason] || '挖不了这格')
      return true
    }
    const uid = String(e.user_id)
    const nm = e.sender?.card || e.sender?.nickname || uid
    g.lastId = uid
    g.lastName = nm
    // 记录出力：这一下挖开的安全格都算给点的人（踩雷那下 opened 为 0）
    addContribution(g, uid, nm, r.opened || 0)

    if (g.status === 'lost') {
      await this.recordResult(e, gid, g, false)
      await this.clearGame(gid)
      await e.reply(`💥 ${g.lastName} 踩雷了，游戏结束！本局不计分，再来一局发「扫雷」`)
      await this.sendBoard(e, gid, g)
      return true
    }
    if (g.status === 'won') {
      const res = await this.recordResult(e, gid, g, true)
      await this.clearGame(gid)
      const awardStr = res.awards.length
        ? res.awards.map(a => `${a.name} +${a.share}`).join('、')
        : `${g.lastName} +${g.reward}`
      await e.reply(`🎉 通关！用时 ${res.sec}s，奖励 ${g.reward} 分按各人出力分配：\n${awardStr}`)
      await this.sendBoard(e, gid, g)
      return true
    }
    await this.saveGame(gid, g)
    await this.sendBoard(e, gid, g)
    return true
  }

  /** ───────────── 插旗 / 拔旗 ───────────── */
  async flag(e) {
    const gid = scope(e)
    const g = await this.loadGame(gid)
    if (!g || g.status !== 'playing') return false
    const co = parseCoord(g, e.msg)
    if (!co) { await e.reply('坐标看不懂，发「旗 B3」这种'); return true }
    const r = toggleFlag(g, co.r, co.c)
    if (!r.ok) {
      await e.reply(r.reason === 'opened' ? '这格已经翻开了，插不了旗' : '这里插不了旗')
      return true
    }
    await this.saveGame(gid, g)
    await this.sendBoard(e, gid, g)
    return true
  }

  /** ───────────── 认输 / 重开 ───────────── */
  async giveup(e) {
    const gid = scope(e)
    const g = await this.loadGame(gid)
    if (!g || g.status !== 'playing') { await e.reply('当前没有进行中的扫雷~ 发「扫雷」开一局'); return true }
    g.status = 'lost'
    g.lastName = e.sender?.card || e.sender?.nickname || String(e.user_id)
    await this.recordResult(e, gid, g, false)
    await this.clearGame(gid)
    await e.reply('🏳️ 本局已结束，雷区揭晓如下，再来发「扫雷」')
    await this.sendBoard(e, gid, g)
    return true
  }

  /**
   * 结算战绩与积分。
   * 胜利时，奖励池（g.reward）按各人挖开的安全格数比例分配——挖得多分得多，
   * 抢最后一刀只值那一下开的格子，基本拿不到分，从根上杜绝「抢尾刀」。
   * 失败/认输时所有参与者都记一局（影响胜率），但不得分。
   * 返回 { sec, awards:[{name,share}] } 供发消息展示。
   */
  async recordResult(e, gid, g, win) {
    const sec = Math.max(1, Math.round((Date.now() - g.startTs) / 1000))
    const players = g.players && Object.keys(g.players).length ? g.players : null
    const awards = []
    if (!players) return { sec, awards }

    const entries = Object.entries(players) // [uid, {name, opened}]
    const totalOpened = entries.reduce((s, [, p]) => s + (p.opened || 0), 0)

    // 按出力把奖励池切成整数份，余数补给出力最高的人
    const shareMap = {}
    if (win && totalOpened > 0) {
      const arr = entries
        .map(([uid, p]) => ({ uid, name: p.name, opened: p.opened || 0 }))
        .sort((a, b) => b.opened - a.opened)
      let allocated = 0
      for (const p of arr) {
        p.share = Math.floor((g.reward * p.opened) / totalOpened)
        allocated += p.share
      }
      let rem = g.reward - allocated
      for (let i = 0; i < arr.length && rem > 0; i++) { arr[i].share++; rem-- }
      for (const p of arr) {
        shareMap[p.uid] = p.share
        if (p.share > 0) awards.push({ name: p.name, share: p.share })
      }
    }

    for (const [uid, p] of entries) {
      let stat = { name: p.name, points: 0, wins: 0, games: 0, bestSec: 0 }
      try {
        const raw = await redis.hGet(rankKey(gid), uid)
        if (raw) stat = { ...stat, ...JSON.parse(raw) }
      } catch {}
      stat.name = p.name
      stat.games += 1
      if (win) {
        stat.wins += 1
        stat.points += (shareMap[uid] || 0)
        if (!stat.bestSec || sec < stat.bestSec) stat.bestSec = sec
      }
      try { await redis.hSet(rankKey(gid), uid, JSON.stringify(stat)) } catch {}
    }
    return { sec, awards }
  }

  /** ───────────── 排行榜 ───────────── */
  async rank(e) {
    const gid = scope(e)
    let all = {}
    try { all = await redis.hGetAll(rankKey(gid)) } catch {}
    const list = Object.entries(all || {}).map(([uid, raw]) => {
      let s = {}
      try { s = JSON.parse(raw) } catch {}
      return {
        uid,
        name: s.name || uid,
        points: s.points || 0,
        wins: s.wins || 0,
        games: s.games || 0,
        bestSec: s.bestSec || 0
      }
    }).filter(s => s.games > 0)

    if (!list.length) { await e.reply('还没有人玩过扫雷，发「扫雷」抢个头名~'); return true }

    list.sort((a, b) => b.points - a.points || b.wins - a.wins || a.bestSec - b.bestSec)
    const ranks = list.slice(0, 15).map((s, i) => ({
      idx: i + 1,
      name: s.name,
      points: s.points,
      wins: s.wins,
      games: s.games,
      rate: s.games ? Math.round((s.wins / s.games) * 100) : 0,
      best: s.bestSec ? `${s.bestSec}s` : '—'
    }))

    const data = {
      tplFile: TPL, pluResPath: _path, saveId: `rank_${gid}`,
      mode: 'rank',
      rankTitle: e.group_id ? '本群扫雷积分榜' : '扫雷积分榜',
      ranks, total: list.length
    }
    const img = await puppeteer.screenshot('saolei', data)
    if (img) await e.reply(img)
    else await e.reply(ranks.map(r => `${r.idx}. ${r.name}  ${r.points}分 (胜${r.wins}/${r.games})`).join('\n'))
    return true
  }

  /** ───────────── 个人战绩 ───────────── */
  async myStat(e) {
    const gid = scope(e)
    let raw = null
    try { raw = await redis.hGet(rankKey(gid), String(e.user_id)) } catch {}
    if (!raw) { await e.reply('你还没玩过扫雷呢，发「扫雷」来一局~'); return true }
    const s = JSON.parse(raw)
    const rate = s.games ? Math.round((s.wins / s.games) * 100) : 0
    await e.reply([
      `📊 ${s.name} 的扫雷战绩`,
      `\n积分：${s.points}　通关：${s.wins}/${s.games} 局　胜率：${rate}%`,
      s.bestSec ? `\n最快通关：${s.bestSec}s` : ''
    ])
    return true
  }

  /** ───────────── 玩法说明 ───────────── */
  async howto(e) {
    await e.reply([
      '🎮 扫雷玩法',
      '\n· 开始：发「扫雷」（默认中等），或「扫雷简单/中等/困难」',
      '\n· 挖格：发「挖 B3」——列用字母 A-L，行用数字',
      '\n· 插旗/拔旗：发「旗 B3」标记你怀疑的雷',
      '\n· 认输：发「扫雷认输」结束本局',
      '\n· 一局棋全群共用，开局后大家都能一起挖，把非雷格全翻开就通关',
      '\n',
      '\n💰 积分规则',
      '\n· 每局有奖励池，按难度定：简单 10 / 中等 25 / 困难 60',
      '\n· 通关后奖励池按各人「挖开的格子数」分配——挖得多分得多',
      '\n· 抢最后一刀没用：尾刀只算你那一下开的格，基本拿不到分',
      '\n· 踩雷或认输不得分，但参与的人都算一局（影响胜率）',
      '\n· 排名按总积分高到低，同分先比通关数、再比最快用时',
      '\n· 积分按群各算各的；排行发「扫雷排名」，个人战绩发「我的扫雷」'
    ])
    return true
  }

  /** ───────────── 出棋盘图（失败降级文字） ───────────── */
  async sendBoard(e, gid, g) {
    const grid = renderGrid(g)
    const colLabels = Array.from({ length: g.cols }, (_, c) => colLabel(c))
    const elapsed = Math.max(0, Math.round((Date.now() - g.startTs) / 1000))
    const flags = flagCount(g)
    const statusText = g.status === 'won' ? '🎉 通关！'
      : g.status === 'lost' ? '💥 踩雷，结束'
        : '进行中'
    const data = {
      tplFile: TPL, pluResPath: _path, saveId: `board_${gid}`,
      mode: 'board',
      title: `扫雷 · ${g.difficulty}`,
      rows: g.rows, cols: g.cols,
      colLabels, grid,
      mineCount: g.mines,
      flagCount: flags,
      minesLeft: g.mines - flags,
      status: g.status,
      statusText,
      elapsed,
      starterName: g.starterName || '',
      lastName: g.lastName || g.starterName || ''
    }
    const img = await puppeteer.screenshot('saolei', data)
    if (img) { await e.reply(img); return }
    // 降级：纯文字棋盘
    const lines = [`扫雷 ${g.difficulty}  雷:${g.mines}  旗:${flags}  ${statusText}`]
    lines.push('  ' + colLabels.join(' '))
    for (let r = 0; r < g.rows; r++) {
      const row = grid[r].map(cell => cell.text ? cell.text : (cell.cls.includes('covered') ? '■' : '·'))
      lines.push(String(r + 1).padStart(2, ' ') + ' ' + row.join(' '))
    }
    await e.reply(lines.join('\n'))
  }
}
