/* ─────────────────────────────────────────────────────────────
 * 扫雷纯逻辑（与 QQ / 渲染无关，方便单独测试）
 *
 * ⚠️ 加载器铁律：apps/ 下文件只导出插件类，公共逻辑放这里。
 * 详见 [[aqing-app-single-export]]。
 *
 * 棋盘坐标：列用字母 A.. （col，从 0 起），行用数字 1.. （row，从 0 起）。
 * 状态对象全部可 JSON 序列化，直接丢 redis。
 * ───────────────────────────────────────────────────────────── */

// 难度预设：尺寸不超过 12 列，方便出图与字母 A-L 标注
export const PRESETS = {
  简单: { rows: 8, cols: 8, mines: 10, reward: 10 },
  中等: { rows: 10, cols: 10, mines: 16, reward: 25 },
  困难: { rows: 12, cols: 12, mines: 30, reward: 60 }
}

// 难度别名 → 标准名
const DIFF_ALIAS = {
  简单: '简单', 初级: '简单', 新手: '简单', 低: '简单',
  中等: '中等', 中级: '中等', 普通: '中等', 中: '中等',
  困难: '困难', 高级: '困难', 地狱: '困难', 高: '困难'
}

export function normDifficulty(name) {
  return DIFF_ALIAS[name] || '中等'
}

const COL_LETTERS = 'ABCDEFGHIJKL'

export function colLabel(c) {
  return COL_LETTERS[c] || String(c + 1)
}

/** 建一局新游戏（此时还没布雷，首挖才布，保证第一下不踩雷） */
export function createGame(difficulty, starter = {}) {
  const d = normDifficulty(difficulty)
  const { rows, cols, mines, reward } = PRESETS[d]
  return {
    difficulty: d,
    rows,
    cols,
    mines,
    reward,
    placed: false,                 // 是否已布雷
    mine: makeGrid(rows, cols, false),
    adj: makeGrid(rows, cols, 0),  // 周围雷数
    open: makeGrid(rows, cols, false),
    flag: makeGrid(rows, cols, false),
    status: 'playing',             // playing | won | lost
    boomR: -1, boomC: -1,          // 踩到的那颗雷（用于高亮）
    moves: 0,
    startTs: Date.now(),
    starterId: starter.id || '',
    starterName: starter.name || '',
    lastId: starter.id || '',
    lastName: starter.name || '',
    players: {}                    // uid -> { name, opened } 各人挖开的安全格数，用于按出力分配积分
  }
}

/** 记录某人这一下挖开了多少安全格（洪水展开都算给点的人），用于积分分配 */
export function addContribution(g, id, name, opened) {
  if (!id) return
  if (!g.players) g.players = {}
  if (!g.players[id]) g.players[id] = { name, opened: 0 }
  g.players[id].name = name
  g.players[id].opened += (opened || 0)
}

function makeGrid(rows, cols, fill) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill))
}

function inBounds(g, r, c) {
  return r >= 0 && r < g.rows && c >= 0 && c < g.cols
}

function neighbors(g, r, c) {
  const out = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr, nc = c + dc
      if (inBounds(g, nr, nc)) out.push([nr, nc])
    }
  }
  return out
}

/** 首挖布雷：避开首挖格及其周围 8 格，保证第一下能炸开一片 */
function placeMines(g, sr, sc) {
  const safe = new Set([`${sr},${sc}`])
  for (const [nr, nc] of neighbors(g, sr, sc)) safe.add(`${nr},${nc}`)

  // 可用格子不够时（小盘高雷），只保留首挖格本身安全
  const total = g.rows * g.cols
  let safeSet = safe
  if (total - safe.size < g.mines) safeSet = new Set([`${sr},${sc}`])

  const cells = []
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!safeSet.has(`${r},${c}`)) cells.push([r, c])
    }
  }
  // 洗牌取前 mines 个
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  for (let i = 0; i < g.mines && i < cells.length; i++) {
    const [r, c] = cells[i]
    g.mine[r][c] = true
  }
  // 计算每格周围雷数
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (g.mine[r][c]) continue
      let n = 0
      for (const [nr, nc] of neighbors(g, r, c)) if (g.mine[nr][nc]) n++
      g.adj[r][c] = n
    }
  }
  g.placed = true
}

/**
 * 解析坐标输入，返回 {r,c} 或 null。
 * 支持「B3」「3B」「b 3」等，列字母 A-L，行数字 1-99。
 */
export function parseCoord(g, raw) {
  if (!raw) return null
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, '')
  const letter = s.match(/[A-L]/)
  const number = s.match(/\d{1,2}/)
  if (!letter || !number) return null
  const c = COL_LETTERS.indexOf(letter[0])
  const r = parseInt(number[0], 10) - 1
  if (!inBounds(g, r, c)) return null
  return { r, c }
}

/**
 * 翻开一格。返回 { ok, reason, opened, boom }
 * reason: 'invalid' | 'opened' | 'flagged' | 'over'
 */
export function dig(g, r, c) {
  if (g.status !== 'playing') return { ok: false, reason: 'over' }
  if (!inBounds(g, r, c)) return { ok: false, reason: 'invalid' }
  if (g.flag[r][c]) return { ok: false, reason: 'flagged' }
  if (g.open[r][c]) return { ok: false, reason: 'opened' }

  if (!g.placed) placeMines(g, r, c)
  g.moves++

  if (g.mine[r][c]) {
    g.open[r][c] = true
    g.boomR = r; g.boomC = c
    g.status = 'lost'
    return { ok: true, boom: true }
  }

  // 洪水填充：0 周围雷数自动展开
  const stack = [[r, c]]
  let opened = 0
  while (stack.length) {
    const [cr, cc] = stack.pop()
    if (g.open[cr][cc]) continue
    if (g.flag[cr][cc]) continue
    g.open[cr][cc] = true
    opened++
    if (g.adj[cr][cc] === 0) {
      for (const [nr, nc] of neighbors(g, cr, cc)) {
        if (!g.open[nr][nc] && !g.mine[nr][nc]) stack.push([nr, nc])
      }
    }
  }

  if (isWin(g)) g.status = 'won'
  return { ok: true, boom: false, opened }
}

/** 插旗 / 取消旗。返回 { ok, reason, flagged } */
export function toggleFlag(g, r, c) {
  if (g.status !== 'playing') return { ok: false, reason: 'over' }
  if (!inBounds(g, r, c)) return { ok: false, reason: 'invalid' }
  if (g.open[r][c]) return { ok: false, reason: 'opened' }
  g.flag[r][c] = !g.flag[r][c]
  return { ok: true, flagged: g.flag[r][c] }
}

/** 是否胜利：所有非雷格都已翻开 */
export function isWin(g) {
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!g.mine[r][c] && !g.open[r][c]) return false
    }
  }
  return true
}

export function flagCount(g) {
  let n = 0
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) if (g.flag[r][c]) n++
  return n
}

/**
 * 构造渲染用的二维格子数据。
 * reveal=true 时（游戏结束）把所有雷亮出来。
 * 每格：{ text, cls }
 */
export function renderGrid(g) {
  const over = g.status !== 'playing'
  const grid = []
  for (let r = 0; r < g.rows; r++) {
    const row = []
    for (let c = 0; c < g.cols; c++) {
      row.push(cellView(g, r, c, over))
    }
    grid.push(row)
  }
  return grid
}

function cellView(g, r, c, over) {
  const isMine = g.mine[r][c]
  if (g.open[r][c]) {
    if (isMine) {
      const boom = r === g.boomR && c === g.boomC
      return { text: boom ? '💥' : '💣', cls: boom ? 'open boom' : 'open mine' }
    }
    const n = g.adj[r][c]
    return { text: n ? String(n) : '', cls: n ? `open n${n}` : 'open' }
  }
  // 未翻开
  if (over && isMine && !g.flag[r][c]) return { text: '💣', cls: 'open mine' }
  if (g.flag[r][c]) {
    // 游戏结束且这里其实不是雷 → 标错
    if (over && !isMine) return { text: '🚩', cls: 'covered flag wrong' }
    return { text: '🚩', cls: 'covered flag' }
  }
  return { text: '', cls: 'covered' }
}
