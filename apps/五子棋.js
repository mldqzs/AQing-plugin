import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import axios from 'axios'
import setting from '../utils/setting.js'
import {
  SIZE, colLabel, createGame, parseCoord, place, boardAscii, heuristicMove
} from '../utils/gomoku.js'

const _path = process.cwd().replace(/\\/g, '/')
const TPL = './plugins/AQing-plugin/resources/html/gomoku/gomoku.html'

// 进行中的对局保留 2 小时无操作自动失效
const GAME_TTL = 60 * 60 * 2

/** 本群/私聊作用域 key：群按群号、私聊按用户 */
function scope (e) {
  return e.group_id ? `g${e.group_id}` : `u${e.user_id}`
}
const gameKey = gid => `AQ:gomoku:game:${gid}`
const rankKey = gid => `AQ:gomoku:rank:${gid}`

const cfg = () => setting.getConfig('gomoku') || {}
const uname = e => e.sender?.card || e.sender?.nickname || String(e.user_id)
const stoneCn = color => (color === 1 ? '⚫黑' : '⚪白')

export class gomoku extends plugin {
  constructor () {
    super({
      name: 'AQ：五子棋',
      dsc: '五子棋，支持人机对战与群友对战',
      event: 'message',
      priority: 600,
      rule: [
        { reg: '^#?五子棋(帮助|玩法|规则|怎么玩)$', fnc: 'howto' },
        { reg: '^#?五子棋(认输|投降|结束|退出|放弃|重开|不下了)$', fnc: 'giveup' },
        { reg: '^#?五子棋(排名|排行|排行榜|榜|战绩)$', fnc: 'rank' },
        { reg: '^#?(五子棋人机|人机五子棋|和ai下五子棋|五子棋ai|ai五子棋)(先手|后手|执黑|执白)?$', fnc: 'startAI' },
        { reg: '^#?五子棋(对战|双人|联机|pk|对决)$', fnc: 'startPvP' },
        { reg: '^#?(应战|接受挑战|我应战|接招|我来下)$', fnc: 'accept' },
        { reg: '^#?五子棋$', fnc: 'howto' },
        { reg: '^(落子?|下|走|放)\\s*([A-Oa-o]\\s*\\d{1,2}|\\d{1,2}\\s*[A-Oa-o])$', fnc: 'move' }
      ]
    })
  }

  /* ───────────── redis 读写 ───────────── */
  async loadGame (gid) {
    try {
      const raw = await redis.get(gameKey(gid))
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  async saveGame (gid, g) {
    await redis.set(gameKey(gid), JSON.stringify(g), { EX: GAME_TTL })
  }

  async clearGame (gid) {
    try { await redis.del(gameKey(gid)) } catch {}
  }

  isOn () { return cfg().enable !== false }

  /* ───────────── 人机开局 ───────────── */
  async startAI (e) {
    if (!this.isOn()) return false
    const gid = scope(e)
    const exist = await this.loadGame(gid)
    if (exist && exist.status !== 'won' && exist.status !== 'draw') {
      await e.reply('这里已经有一局在下啦，先发「五子棋认输」结束当前这局~')
      return true
    }
    // 后手/执白：人执白(2)，AI 执黑(1) 先走天元；否则人执黑(1) 先手
    const wantWhite = /后手|执白/.test(e.msg)
    const me = { id: String(e.user_id), name: uname(e) }
    let g
    if (wantWhite) {
      g = createGame('ai', null, me, { aiColor: 1 })
      g.players[1] = { id: 'AI', name: this.aiName() }
    } else {
      g = createGame('ai', me, { id: 'AI', name: this.aiName() }, { aiColor: 2 })
    }
    await e.reply([
      `🎯 五子棋人机开局！你执${wantWhite ? '⚪白' : '⚫黑'}，${this.aiName()}执${wantWhite ? '⚫黑' : '⚪白'}`,
      `\n落子发「落 H8」（列 A-O，行 1-15）；认输发「五子棋认输」`
    ])
    // AI 执黑先走
    if (g.turn === g.aiColor) await this.doAiMove(g)
    await this.saveGame(gid, g)
    await this.sendBoard(e, gid, g)
    return true
  }

  /* ───────────── 群友对战开局（开放挑战） ───────────── */
  async startPvP (e) {
    if (!this.isOn()) return false
    if (!e.group_id) { await e.reply('群友对战要在群里玩哦，私聊可以发「五子棋人机」和我下~'); return true }
    const gid = scope(e)
    const exist = await this.loadGame(gid)
    if (exist && exist.status !== 'won' && exist.status !== 'draw') {
      await e.reply('本群已经有一局在进行/等应战啦，先发「五子棋认输」结束当前这局~')
      return true
    }
    const me = { id: String(e.user_id), name: uname(e) }
    const g = createGame('pvp', me, null) // 发起人执黑先手，等人应战
    await this.saveGame(gid, g)
    await e.reply([
      `⚔️ ${me.name} 发起五子棋对战！执⚫黑先手`,
      `\n群友发「应战」即可加入执⚪白；落子发「落 H8」`
    ])
    return true
  }

  /* ───────────── 应战（加入为白方） ───────────── */
  async accept (e) {
    if (!this.isOn()) return false
    const gid = scope(e)
    const g = await this.loadGame(gid)
    if (!g || g.status !== 'waiting') return false // 没有待应战的局就别抢话
    if (String(e.user_id) === g.players[1]?.id) {
      await e.reply('自己不能应战自己啦，等别的群友来~'); return true
    }
    g.players[2] = { id: String(e.user_id), name: uname(e) }
    g.status = 'playing'
    g.turn = 1
    await this.saveGame(gid, g)
    await e.reply([
      `🔥 ${g.players[2].name} 应战！对局开始`,
      `\n⚫黑 ${g.players[1].name}　vs　⚪白 ${g.players[2].name}`,
      `\n${g.players[1].name} 先手，落子发「落 H8」`
    ])
    await this.sendBoard(e, gid, g)
    return true
  }

  /* ───────────── 落子 ───────────── */
  async move (e) {
    const gid = scope(e)
    const g = await this.loadGame(gid)
    if (!g) return false // 没在玩，放行给别的功能
    if (g.status === 'waiting') { await e.reply('还没有人应战呢，等群友发「应战」再开下~'); return true }
    if (g.status !== 'playing') return false

    const co = parseCoord(e.msg)
    if (!co) { await e.reply('坐标看不懂，发「落 H8」这种：列字母 A-O + 行数字 1-15'); return true }

    const uid = String(e.user_id)
    const mover = g.players[g.turn]
    // 人机模式：只有那个人能下；pvp：必须轮到你
    if (!mover || mover.id !== uid) {
      if (g.mode === 'ai') { await e.reply('这是你和我的对局，轮到你执子时再落~'); return true }
      const other = g.players[g.turn]
      await e.reply(`还没轮到你哦，现在该 ${other?.name || '对手'}（执${stoneCn(g.turn)}）落子~`)
      return true
    }

    const myColor = g.turn
    const r = place(g, co.r, co.c, myColor)
    if (!r.ok) {
      await e.reply(r.reason === 'taken' ? '这个点已经有子啦，换一个~' : '这步下不了，换个坐标~')
      return true
    }

    // 人赢了
    if (g.status === 'won') {
      await this.finish(e, gid, g)
      return true
    }
    if (g.status === 'draw') {
      await this.finishDraw(e, gid, g)
      return true
    }

    // 人机：轮到 AI
    if (g.mode === 'ai' && g.turn === g.aiColor) {
      await this.doAiMove(g)
      if (g.status === 'won') { await this.finish(e, gid, g); return true }
      if (g.status === 'draw') { await this.finishDraw(e, gid, g); return true }
    }

    await this.saveGame(gid, g)
    await this.sendBoard(e, gid, g)
    return true
  }

  /* ───────────── AI 落子（先问大模型，失败/非法用内置AI兜底） ───────────── */
  async doAiMove (g) {
    let co = await this.llmMove(g, g.aiColor)
    if (!co || g.board[co.r][co.c] !== 0) co = heuristicMove(g, g.aiColor)
    if (co) place(g, co.r, co.c, g.aiColor)
  }

  aiName () {
    const c = cfg()
    return (c.aiBaseUrl && c.aiKey) ? (c.aiModel || 'AI') : '内置AI'
  }

  /** 调外部大模型选点；未配置/失败/非法返回 null（由内置AI兜底） */
  async llmMove (g, color) {
    const c = cfg()
    const base = String(c.aiBaseUrl || '').replace(/\/+$/, '')
    if (!base || !c.aiKey) return null
    const url = /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`
    const me = color === 1 ? '黑(●)' : '白(○)'
    const sys = `你是五子棋高手，执${me}。棋盘 15×15，列 A-O（从左到右），行 1-15（从上到下）。任意一方先连成五子（横/竖/斜）即获胜。`
    const user = `当前棋盘（. 空位，● 黑子，○ 白子）：\n${boardAscii(g)}\n现在轮到你（${me}）落子。请只输出一个落子坐标，格式如 H8（列字母 A-O + 行号 1-15），不要任何解释或多余字符，且必须落在空位。`
    try {
      const { data } = await axios.post(url, {
        model: c.aiModel || 'gpt-4o-mini',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        temperature: 0.3,
        max_tokens: 20
      }, {
        headers: { Authorization: `Bearer ${c.aiKey}`, 'Content-Type': 'application/json' },
        timeout: (c.aiTimeout || 30) * 1000,
        proxy: false
      })
      const txt = data?.choices?.[0]?.message?.content || ''
      const co = parseCoord(txt)
      if (co && g.board[co.r][co.c] === 0) return co
      logger?.warn?.(`[AQ五子棋] AI返回无法落子: ${String(txt).slice(0, 40)}`)
      return null
    } catch (err) {
      logger?.warn?.(`[AQ五子棋] AI接口请求失败: ${err.message}`)
      return null
    }
  }

  /* ───────────── 认输 / 结束 ───────────── */
  async giveup (e) {
    const gid = scope(e)
    const g = await this.loadGame(gid)
    if (!g || (g.status !== 'playing' && g.status !== 'waiting')) {
      await e.reply('当前没有进行中的五子棋~ 发「五子棋人机」或「五子棋对战」开一局'); return true
    }
    const uid = String(e.user_id)
    const isPlayer = g.players[1]?.id === uid || g.players[2]?.id === uid
    if (!isPlayer && e.group_id) { await e.reply('只有对局里的人能结束这局哦~'); return true }

    if (g.status === 'waiting') {
      await this.clearGame(gid)
      await e.reply('🏳️ 已取消本局五子棋邀战~')
      return true
    }
    // 进行中认输：认输者判负，对手判胜
    const loser = g.players[1]?.id === uid ? 1 : 2
    const winner = loser === 1 ? 2 : 1
    g.status = 'won'
    g.winner = winner
    await this.recordResult(gid, g)
    await this.clearGame(gid)
    await e.reply(`🏳️ ${g.players[loser]?.name || '认输方'} 认输，${g.players[winner]?.name || '对手'}（执${stoneCn(winner)}）获胜！`)
    return true
  }

  /* ───────────── 收尾：胜利 ───────────── */
  async finish (e, gid, g) {
    await this.recordResult(gid, g)
    await this.clearGame(gid)
    const w = g.players[g.winner]
    await e.reply(`🎉 ${w?.name || stoneCn(g.winner)}（执${stoneCn(g.winner)}）五子连珠，获胜！`)
    await this.sendBoard(e, gid, g)
    return true
  }

  async finishDraw (e, gid, g) {
    await this.recordResult(gid, g)
    await this.clearGame(gid)
    await e.reply('🤝 棋盘下满，平局！再来一局发「五子棋人机 / 五子棋对战」')
    await this.sendBoard(e, gid, g)
    return true
  }

  /**
   * 记录战绩（按群隔离）。只统计真人；AI 不计入排行。
   * 胜者 +1 胜，负者 +1 负，平局双方各 +1 平；都 +1 局。
   */
  async recordResult (gid, g) {
    const real = [g.players[1], g.players[2]].filter(p => p && p.id && p.id !== 'AI')
    for (const p of real) {
      let stat = { name: p.name, wins: 0, losses: 0, draws: 0, games: 0 }
      try {
        const raw = await redis.hGet(rankKey(gid), p.id)
        if (raw) stat = { ...stat, ...JSON.parse(raw) }
      } catch {}
      stat.name = p.name
      stat.games += 1
      const color = g.players[1]?.id === p.id ? 1 : 2
      if (g.status === 'draw') stat.draws += 1
      else if (g.winner === color) stat.wins += 1
      else stat.losses += 1
      try { await redis.hSet(rankKey(gid), p.id, JSON.stringify(stat)) } catch {}
    }
  }

  /* ───────────── 排行榜 ───────────── */
  async rank (e) {
    const gid = scope(e)
    let all = {}
    try { all = await redis.hGetAll(rankKey(gid)) } catch {}
    const list = Object.entries(all || {}).map(([uid, raw]) => {
      let s = {}
      try { s = JSON.parse(raw) } catch {}
      return {
        uid,
        name: s.name || uid,
        wins: s.wins || 0,
        losses: s.losses || 0,
        draws: s.draws || 0,
        games: s.games || 0
      }
    }).filter(s => s.games > 0)

    if (!list.length) { await e.reply('还没有人玩过五子棋，发「五子棋对战」或「五子棋人机」抢个头名~'); return true }

    list.sort((a, b) => b.wins - a.wins || (b.wins - b.losses) - (a.wins - a.losses) || a.games - b.games)
    const ranks = list.slice(0, 15).map((s, i) => ({
      idx: i + 1,
      name: s.name,
      wins: s.wins,
      games: s.games,
      rate: s.games ? Math.round((s.wins / s.games) * 100) : 0
    }))

    const data = {
      tplFile: TPL, pluResPath: _path, saveId: `gmk_rank_${gid}`, imgType: 'png',
      mode: 'rank',
      rankTitle: e.group_id ? '本群五子棋榜' : '五子棋战绩',
      ranks, total: list.length
    }
    const img = await puppeteer.screenshot('gomoku', data)
    if (img) await e.reply(img)
    else await e.reply(ranks.map(r => `${r.idx}. ${r.name}  胜${r.wins}/${r.games} (${r.rate}%)`).join('\n'))
    return true
  }

  /* ───────────── 玩法说明 ───────────── */
  async howto (e) {
    await e.reply([
      '⚫⚪ 五子棋玩法',
      '\n· 人机对战：发「五子棋人机」（你执黑先手）；想后手发「五子棋人机后手」',
      '\n· 群友对战：发「五子棋对战」发起，另一位群友发「应战」加入，发起方执黑先手',
      '\n· 落子：发「落 H8」——列用字母 A-O，行用数字 1-15（也可「落子 H8 / 下 H8」）',
      '\n· 认输：发「五子棋认输」结束本局',
      '\n· 战绩：发「五子棋排名」看本群榜单',
      '\n',
      '\n🤖 关于 AI',
      '\n· 默认用内置 AI，开箱即玩；',
      '\n· 在锅巴（AQing-plugin → 五子棋）填好「接口地址 / API Key / 模型」后，',
      '\n  人机对手会换成你配置的大模型来下（接口异常时自动退回内置 AI）。',
      '\n· 一个群同时只进行一局，无操作 2 小时自动失效。'
    ])
    return true
  }

  /* ───────────── 出棋盘图（失败降级文字） ───────────── */
  async sendBoard (e, gid, g) {
    const data = this.buildBoardData(g, gid)
    const img = await puppeteer.screenshot('gomoku', data)
    if (img) { await e.reply(img); return }
    // 降级：纯文字棋盘
    await e.reply(boardAscii(g))
  }

  buildBoardData (g, gid) {
    const cell = 42
    const pad = 46
    const innerPx = (g.size - 1) * cell
    const boardPx = innerPx + pad * 2

    const stones = []
    for (let r = 0; r < g.size; r++) {
      for (let c = 0; c < g.size; c++) {
        const v = g.board[r][c]
        if (!v) continue
        const isLast = g.last && g.last[0] === r && g.last[1] === c
        const isWin = g.winLine.some(p => p[0] === r && p[1] === c)
        stones.push({
          x: pad + c * cell,
          y: pad + r * cell,
          color: v === 1 ? 'black' : 'white',
          last: isLast,
          win: isWin
        })
      }
    }
    const colLabels = []
    const rowLabels = []
    for (let c = 0; c < g.size; c++) colLabels.push({ label: colLabel(c), x: pad + c * cell })
    for (let r = 0; r < g.size; r++) rowLabels.push({ label: String(r + 1), y: pad + r * cell })
    const starI = [3, 7, 11]
    const stars = []
    for (const r of starI) for (const c of starI) stars.push({ x: pad + c * cell, y: pad + r * cell })
    const linesH = []
    const linesV = []
    for (let i = 0; i < g.size; i++) {
      linesH.push({ pos: pad + i * cell })
      linesV.push({ pos: pad + i * cell })
    }

    const p1 = g.players[1]
    const p2 = g.players[2]
    const statusText = g.status === 'won'
      ? `🎉 ${g.players[g.winner]?.name || ''} 获胜`
      : g.status === 'draw' ? '🤝 平局'
        : g.mode === 'ai'
          ? (g.turn === g.aiColor ? `${this.aiName()} 思考中…` : '轮到你落子')
          : `轮到 ${g.players[g.turn]?.name || ''}`
    const statusCls = g.status === 'won' ? 'won' : g.status === 'draw' ? 'draw' : ''

    return {
      tplFile: TPL, pluResPath: _path, saveId: `gmk_board_${gid}`, imgType: 'png',
      mode: 'board',
      title: g.mode === 'ai' ? '五子棋 · 人机' : '五子棋 · 对战',
      statusText, statusCls,
      blackName: p1?.name || '—',
      whiteName: p2?.name || '等应战…',
      turnColor: g.turn === 1 ? 'black' : 'white',
      moves: g.moves,
      cell, pad, innerPx, boardPx,
      stones, colLabels, rowLabels, stars, linesH, linesV
    }
  }
}
