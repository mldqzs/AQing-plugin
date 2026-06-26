/* ─────────────────────────────────────────────────────────────
 * 五子棋纯逻辑（与 QQ / 渲染 / 网络无关，方便单独测试）
 *
 * ⚠️ 加载器铁律：apps/ 下文件只导出插件类，公共逻辑放这里。
 * 详见 [[aqing-app-single-export]]。
 *
 * 棋盘：15×15 交叉点。列用字母 A..O（col，从 0 起），行用数字 1..15（row，从 0 起）。
 * board[r][c]：0 空、1 黑（先手）、2 白。状态对象全部可 JSON 序列化，直接丢 redis。
 * 内置启发式 AI 不依赖外部接口，缺接口/接口失败时兜底，保证「人机」开箱即用。
 * ───────────────────────────────────────────────────────────── */

export const SIZE = 15
const COLS = 'ABCDEFGHIJKLMNO'
// 四个方向：横、竖、主对角、副对角（只取一半，往两边各探）
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]

export function colLabel (c) {
  return COLS[c] || String(c + 1)
}

function inB (g, r, c) {
  return r >= 0 && r < g.size && c >= 0 && c < g.size
}

/** 新开一局。mode: 'ai' | 'pvp'；black/white 为 {id,name}（白可后填） */
export function createGame (mode, black, white = null, opts = {}) {
  return {
    mode,
    size: SIZE,
    board: Array.from({ length: SIZE }, () => Array(SIZE).fill(0)),
    players: { 1: black || null, 2: white || null }, // 1=黑(先手) 2=白
    aiColor: opts.aiColor || 0, // 人机模式下 AI 执子颜色（1 或 2），pvp 为 0
    turn: 1,                    // 当前轮到谁落子：1 或 2
    status: mode === 'pvp' && !white ? 'waiting' : 'playing', // waiting=等应战
    winner: 0,                  // 1 | 2
    winLine: [],                // 连成五（含以上）的坐标 [[r,c],...]，用于高亮
    last: null,                 // 最后一手 [r,c]
    moves: 0,
    startTs: Date.now()
  }
}

/** 解析单个坐标「H8 / 8H / h 8」→ {r,c}，越界/非法返回 null */
export function parseCoord (raw) {
  if (!raw) return null
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, '')
  const letter = s.match(/[A-O]/)
  const number = s.match(/\d{1,2}/)
  if (!letter || !number) return null
  const c = COLS.indexOf(letter[0])
  const r = parseInt(number[0], 10) - 1
  if (!inB({ size: SIZE }, r, c)) return null
  return { r, c }
}

/**
 * 落一子。返回 { ok, reason }
 * reason: 'over' | 'invalid' | 'taken'
 * 命中即更新 status/winner/winLine；满盘判和。
 */
export function place (g, r, c, color) {
  if (g.status !== 'playing') return { ok: false, reason: 'over' }
  if (!inB(g, r, c)) return { ok: false, reason: 'invalid' }
  if (g.board[r][c] !== 0) return { ok: false, reason: 'taken' }
  g.board[r][c] = color
  g.last = [r, c]
  g.moves++
  const line = winLineAt(g, r, c, color)
  if (line) {
    g.status = 'won'
    g.winner = color
    g.winLine = line
  } else if (g.moves >= g.size * g.size) {
    g.status = 'draw'
  } else {
    g.turn = color === 1 ? 2 : 1
  }
  return { ok: true }
}

/** 落在 (r,c) 后，该方向上是否连成五子；是则返回整条连线坐标，否则 null */
function winLineAt (g, r, c, color) {
  for (const [dr, dc] of DIRS) {
    const cells = [[r, c]]
    for (let s = 1; s < 5; s++) {
      const nr = r + dr * s, nc = c + dc * s
      if (inB(g, nr, nc) && g.board[nr][nc] === color) cells.push([nr, nc]); else break
    }
    for (let s = 1; s < 5; s++) {
      const nr = r - dr * s, nc = c - dc * s
      if (inB(g, nr, nc) && g.board[nr][nc] === color) cells.unshift([nr, nc]); else break
    }
    if (cells.length >= 5) return cells
  }
  return null
}

/** 棋盘转 ASCII（喂给大模型用）：.空 ●黑 ○白，带行列坐标 */
export function boardAscii (g) {
  let out = '   ' + COLS.split('').join(' ') + '\n'
  for (let r = 0; r < g.size; r++) {
    const rl = String(r + 1).padStart(2, ' ')
    const row = g.board[r].map(v => (v === 0 ? '.' : v === 1 ? '●' : '○')).join(' ')
    out += `${rl} ${row}\n`
  }
  return out
}

/* ───────────────── 内置启发式 AI ───────────────── */

// 单方向连子评分：cnt=含落点的连子数，opens=两端空位数（0/1/2）
function lineScore (cnt, opens) {
  if (cnt >= 5) return 10000000          // 成五
  if (cnt === 4) return opens === 2 ? 100000 : opens === 1 ? 10000 : 0 // 活四/冲四
  if (cnt === 3) return opens === 2 ? 5000 : opens === 1 ? 400 : 0     // 活三/眠三
  if (cnt === 2) return opens === 2 ? 200 : opens === 1 ? 20 : 0
  if (cnt === 1) return opens === 2 ? 10 : opens === 1 ? 2 : 0
  return 0
}

/** 评估在 (r,c) 落 color 子能形成的进攻价值（四方向连子之和） */
function evalPoint (g, r, c, color) {
  let total = 0
  for (const [dr, dc] of DIRS) {
    let cnt = 1
    let i = 1
    while (inB(g, r + dr * i, c + dc * i) && g.board[r + dr * i][c + dc * i] === color) { cnt++; i++ }
    const openA = inB(g, r + dr * i, c + dc * i) && g.board[r + dr * i][c + dc * i] === 0 ? 1 : 0
    i = 1
    while (inB(g, r - dr * i, c - dc * i) && g.board[r - dr * i][c - dc * i] === color) { cnt++; i++ }
    const openB = inB(g, r - dr * i, c - dc * i) && g.board[r - dr * i][c - dc * i] === 0 ? 1 : 0
    total += lineScore(cnt, openA + openB)
  }
  return total
}

/** (r,c) 周围 radius 格内是否已有子（剪枝：只在已有棋子附近考虑落点） */
function hasNeighbor (g, r, c, radius) {
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr, nc = c + dc
      if (inB(g, nr, nc) && g.board[nr][nc] !== 0) return true
    }
  }
  return false
}

/**
 * 内置 AI 落子：兼顾进攻（自己成势）与防守（堵对手成势）。
 * color 为 AI 颜色；空盘走天元。返回 {r,c}。
 */
export function heuristicMove (g, color) {
  const opp = color === 1 ? 2 : 1
  if (g.moves === 0) return { r: 7, c: 7 }
  let best = null
  let bestScore = -1
  for (let r = 0; r < g.size; r++) {
    for (let c = 0; c < g.size; c++) {
      if (g.board[r][c] !== 0) continue
      if (!hasNeighbor(g, r, c, 2)) continue
      const atk = evalPoint(g, r, c, color)
      const def = evalPoint(g, r, c, opp)
      // 进攻略优先（自己能赢就别只顾堵），防守同样重视
      const score = atk * 1.05 + def
      if (score > bestScore) { bestScore = score; best = { r, c } }
    }
  }
  return best || { r: 7, c: 7 }
}

/* ═══════════════ 地狱模式：带前瞻搜索的强引擎 ═══════════════
 * 思路：在「内置 AI」那套攻防评分之上，加 α-β 剪枝的极大极小搜索（默认看 4 层）。
 * 会往前算几步，所以能识破「做双活三/四三逼你只能堵一边」这类先手必赢套路——
 * 哪条线会让对手下一两步内形成挡不住的双威胁，搜索都会提前避开/堵死。
 * ───────────────────────────────────────────────────────────── */

const WIN_SCORE = 1e9
const HELL_DEPTH = 4   // 前瞻层数（偶数，落到对手回应那一手）
const ROOT_BEAM = 12   // 根节点考虑的候选点数
const BEAM = 8         // 内部节点候选点数（越小越快）

const inN = (N, r, c) => r >= 0 && r < N && c >= 0 && c < N

/** 在原始棋盘上：落 (r,c) 是否立刻连成五（含长连） */
function makesFive (b, r, c, color) {
  const N = b.length
  for (const [dr, dc] of DIRS) {
    let cnt = 1
    for (let s = 1; s < 5; s++) { const nr = r + dr * s, nc = c + dc * s; if (inN(N, nr, nc) && b[nr][nc] === color) cnt++; else break }
    for (let s = 1; s < 5; s++) { const nr = r - dr * s, nc = c - dc * s; if (inN(N, nr, nc) && b[nr][nc] === color) cnt++; else break }
    if (cnt >= 5) return true
  }
  return false
}

/** 原始棋盘上、(r,c) 落 color 的攻防价值（四方向连子，用于走法排序与兜底） */
function threatAt (b, r, c, color) {
  const N = b.length
  let total = 0
  for (const [dr, dc] of DIRS) {
    let cnt = 1
    let i = 1
    while (inN(N, r + dr * i, c + dc * i) && b[r + dr * i][c + dc * i] === color) { cnt++; i++ }
    const openA = inN(N, r + dr * i, c + dc * i) && b[r + dr * i][c + dc * i] === 0 ? 1 : 0
    i = 1
    while (inN(N, r - dr * i, c - dc * i) && b[r - dr * i][c - dc * i] === color) { cnt++; i++ }
    const openB = inN(N, r - dr * i, c - dc * i) && b[r - dr * i][c - dc * i] === 0 ? 1 : 0
    total += lineScore(cnt, openA + openB)
  }
  return total
}

/** (r,c) 附近 radius 内是否有子 */
function near (b, r, c, radius) {
  const N = b.length
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr, nc = c + dc
      if (inN(N, nr, nc) && b[nr][nc] !== 0) return true
    }
  }
  return false
}

/** 生成候选落点（只在已有子附近），按「攻防价值」排序后取前 beam 个，助力 α-β 剪枝 */
function genCandidates (b, side, beam) {
  const N = b.length
  const opp = side === 1 ? 2 : 1
  const list = []
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (b[r][c] !== 0) continue
      if (!near(b, r, c, 1)) continue
      // 既看自己能成势、也看堵对手，排序更准
      const sc = threatAt(b, r, c, side) + threatAt(b, r, c, opp) * 0.9
      list.push({ r, c, sc })
    }
  }
  list.sort((a, b) => b.sc - a.sc)
  return list.slice(0, beam)
}

/* 棋型分值表（自己=1、空=0、墙/对手=2；含跳棋型，所以认得 ●●_●● 这类威胁） */
const PATS = [
  [/11111/g, 5000000],                                // 连五
  [/011110/g, 100000],                                // 活四（基本必胜）
  [/11110|01111|11011|10111|11101/g, 10000],          // 冲四 / 成四（一步成五）
  [/011100|001110|010110|011010/g, 1200],             // 活三（一步成活四）
  [/11100|00111|11010|01011|10011|11001|10101/g, 200],// 眠三 / 跳三
  [/011000|000110|001100|010100|001010|010010/g, 120],// 活二
  [/0110|0101|1010/g, 20]                             // 散二
]

// 缓存每个尺寸的所有「线」（行/列/两斜），避免每次评估都重建
const _lineCache = new Map()
function getLines (N) {
  if (_lineCache.has(N)) return _lineCache.get(N)
  const lines = []
  for (let r = 0; r < N; r++) { const ln = []; for (let c = 0; c < N; c++) ln.push([r, c]); lines.push(ln) }
  for (let c = 0; c < N; c++) { const ln = []; for (let r = 0; r < N; r++) ln.push([r, c]); lines.push(ln) }
  for (let k = -(N - 1); k <= N - 1; k++) { // ＼ 方向
    const ln = []; for (let r = 0; r < N; r++) { const c = r - k; if (c >= 0 && c < N) ln.push([r, c]) }
    if (ln.length >= 5) lines.push(ln)
  }
  for (let k = 0; k <= 2 * (N - 1); k++) { // ／ 方向
    const ln = []; for (let r = 0; r < N; r++) { const c = k - r; if (c >= 0 && c < N) ln.push([r, c]) }
    if (ln.length >= 5) lines.push(ln)
  }
  _lineCache.set(N, lines)
  return lines
}

function scoreLine (s) {
  let sc = 0
  for (const [re, val] of PATS) { const m = s.match(re); if (m) sc += m.length * val }
  return sc
}

/**
 * 整盘静态评估（从 me 视角，越大对 me 越有利）。
 * 把每条线转成「1自己/0空/2墙或对手」字符串，按棋型表打分；me 加、对手减。
 * 因为用棋型匹配，能认出跳三、跳四等带空隙的威胁（连续计数版认不出）。
 */
function evalBoard (b, me) {
  const N = b.length
  const opp = me === 1 ? 2 : 1
  const lines = getLines(N)
  let score = 0
  for (const cells of lines) {
    let sm = '2'; let so = '2' // 两端补墙
    for (const [r, c] of cells) {
      const v = b[r][c]
      sm += v === me ? '1' : v === 0 ? '0' : '2'
      so += v === opp ? '1' : v === 0 ? '0' : '2'
    }
    sm += '2'; so += '2'
    // 防守加权（>1）：对手的威胁看得比自己重一点，避免被先手一个 tempo 抢死
    score += scoreLine(sm) - scoreLine(so) * DEF_WEIGHT
  }
  return score
}
const DEF_WEIGHT = 1.2 // 防守略重于进攻：实测两色对内置AI均零负、胜率最高的平衡点

/** negamax + α-β：返回「轮到 side 的一方」能取得的最优分（自身视角） */
function negamax (b, depth, alpha, beta, side) {
  if (depth === 0) return evalBoard(b, side)
  const opp = side === 1 ? 2 : 1
  const cands = genCandidates(b, side, BEAM)
  if (!cands.length) return evalBoard(b, side)
  let best = -Infinity
  for (const { r, c } of cands) {
    b[r][c] = side
    let val
    if (makesFive(b, r, c, side)) val = WIN_SCORE - (HELL_DEPTH - depth) // 越早赢越好
    else val = -negamax(b, depth - 1, -beta, -alpha, opp)
    b[r][c] = 0
    if (val > best) best = val
    if (best > alpha) alpha = best
    if (alpha >= beta) break // 剪枝
  }
  return best
}

/* ═══════════════ 进攻强化：棋型识别 + 连续冲四杀(VCF) ═══════════════
 * 单靠静态评估线性相加，认不出「一手做两个威胁」的杀力（双活三/四三）。
 * 这里补一套主动进攻搜索：识别活四/双威胁，并做 VCF（只走冲四的强制杀），
 * 能算到几步外的必杀，让地狱 AI 不只会堵、还会主动逼杀。
 * ───────────────────────────────────────────────────────────── */

const VCF_DEPTH = 10 // 连续冲四搜索最大层数（我方冲四步数 ×2），有限所以很快

/** 以 (r,c) 为中心沿某方向取局部线串：1=color、0=空、2=墙/对手 */
function lineStr (b, color, r, c, dr, dc) {
  const N = b.length
  let s = ''
  for (let o = -5; o <= 5; o++) {
    const nr = r + dr * o, nc = c + dc * o
    if (!inN(N, nr, nc)) s += '2'
    else s += b[nr][nc] === color ? '1' : b[nr][nc] === 0 ? '0' : '2'
  }
  return s
}

/** 在 (r,c) 落 color 后形成的棋型：成五 / 活四 / 冲四数 / 活三数 */
function classifyMove (b, color, r, c) {
  b[r][c] = color
  let five = false, openFour = false, fours = 0, threes = 0
  for (const [dr, dc] of DIRS) {
    const s = lineStr(b, color, r, c, dr, dc)
    if (/11111/.test(s)) five = true
    else if (/011110/.test(s)) { openFour = true; fours++ }
    else if (/11110|01111|11011|10111|11101/.test(s)) fours++       // 冲四
    else if (/011100|001110|010110|011010/.test(s)) threes++        // 活三
  }
  b[r][c] = 0
  return { five, openFour, fours, threes }
}

/** 一手做成「挡不住的双威胁」：活四 / 双冲四 / 四三 / 双活三 */
function isWinningDouble (cl) {
  if (cl.openFour) return true
  if (cl.fours >= 2) return true
  if (cl.fours >= 1 && cl.threes >= 1) return true
  if (cl.threes >= 2) return true
  return false
}

/** color 已落在 (r,c) 后，能一步成五的空点（冲四=1个、活四≥2个） */
function fiveGainCells (b, color, r, c) {
  const N = b.length
  const out = []
  const seen = new Set()
  for (const [dr, dc] of DIRS) {
    for (let o = -4; o <= 4; o++) {
      const nr = r + dr * o, nc = c + dc * o
      if (!inN(N, nr, nc) || b[nr][nc] !== 0) continue
      const k = nr * N + nc
      if (seen.has(k)) continue
      b[nr][nc] = color
      const ok = makesFive(b, nr, nc, color)
      b[nr][nc] = 0
      if (ok) { seen.add(k); out.push([nr, nc]) }
    }
  }
  return out
}

/** 棋盘上 color 是否存在「一步成五」的点（判断对手能否立刻取胜） */
function anyImmediateFive (b, color) {
  const N = b.length
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (b[r][c] !== 0 || !near(b, r, c, 1)) continue
      b[r][c] = color
      const ok = makesFive(b, r, c, color)
      b[r][c] = 0
      if (ok) return true
    }
  }
  return false
}

/** 所有能形成「冲四/活四（威胁成五）」的落点，附其成五点 */
function fourMoves (b, color) {
  const N = b.length
  const out = []
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (b[r][c] !== 0 || !near(b, r, c, 1)) continue
      b[r][c] = color
      const win = makesFive(b, r, c, color)
      const gain = win ? [] : fiveGainCells(b, color, r, c)
      b[r][c] = 0
      if (win) out.push({ r, c, gain: [], win: true })
      else if (gain.length) out.push({ r, c, gain, win: false })
    }
  }
  out.sort((a, b) => b.gain.length - a.gain.length) // 活四(多成五点)优先
  return out
}

/**
 * VCF：只走「冲四/活四」这类强制手，逼对手必须堵，层层推进找必杀。
 * 返回制胜第一手 [r,c]，找不到返回 null。深度有限、很快。
 */
function vcf (b, me, depth) {
  if (depth <= 0) return null
  const opp = me === 1 ? 2 : 1
  for (const m of fourMoves(b, me)) {
    b[m.r][m.c] = me
    if (m.win || m.gain.length >= 2) { b[m.r][m.c] = 0; return [[m.r, m.c]] } // 成五 / 活四=必胜
    // 对手此刻若能自己成五，我的冲四就不强制了，放弃这条线
    if (anyImmediateFive(b, opp)) { b[m.r][m.c] = 0; continue }
    const [er, ec] = m.gain[0]   // 冲四唯一堵点，替对手堵上
    b[er][ec] = opp
    const sub = vcf(b, me, depth - 1)
    b[er][ec] = 0
    b[m.r][m.c] = 0
    if (sub) return [[m.r, m.c], ...sub]
  }
  return null
}

/**
 * 地狱模式落子。color 为 AI 颜色。
 * 顺序：能赢就赢 → 必堵 → 主动逼杀（活四/VCF/双威胁）→ 拆对手杀 → 前瞻定位。
 * 进攻层让它不只会防守，会主动做四三、连续冲四逼死你。
 */
export function hardMove (g, color) {
  const b = g.board
  const N = g.size
  const opp = color === 1 ? 2 : 1
  if (g.moves === 0) return { r: 7, c: 7 } // 开局走天元

  const cands = genCandidates(b, color, ROOT_BEAM)
  if (!cands.length) return heuristicMove(g, color)

  // 1) 自己能一步连五 → 直接赢
  for (const { r, c } of cands) if (makesFive(b, r, c, color)) return { r, c }

  // 2) 对手能一步连五 → 必堵
  const oppFive = []
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (b[r][c] === 0 && makesFive(b, r, c, opp)) oppFive.push({ r, c })
    }
  }
  if (oppFive.length) return oppFive[0]

  // 3) 我能走出活四 → 必胜，直接下
  for (const { r, c } of cands) {
    if (classifyMove(b, color, r, c).openFour) return { r, c }
  }

  // 4) 连续冲四杀（VCF）：有强制杀就果断进攻
  const kill = vcf(b, color, VCF_DEPTH)
  if (kill) return { r: kill[0][0], c: kill[0][1] }

  // 5) 对手能走出活四 → 提前占掉那个要点
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (b[r][c] !== 0 || !near(b, r, c, 1)) continue
      if (classifyMove(b, opp, r, c).openFour) return { r, c }
    }
  }

  // 6) 对手有 VCF 杀 → 占掉其第一手，拆掉连续冲四
  const oppKill = vcf(b, opp, VCF_DEPTH)
  if (oppKill) return { r: oppKill[0][0], c: oppKill[0][1] }

  // 7) 我能一手做出双威胁（四三 / 双活三）→ 制胜手
  let dbl = null, dblScore = -1
  for (const { r, c } of cands) {
    const cl = classifyMove(b, color, r, c)
    if (!isWinningDouble(cl)) continue
    b[r][c] = color
    const safe = !anyImmediateFive(b, opp) // 确认对手回应里没法直接成五
    b[r][c] = 0
    if (safe) {
      const sc = cl.fours * 2 + cl.threes
      if (sc > dblScore) { dblScore = sc; dbl = { r, c } }
    }
  }
  if (dbl) return dbl

  // 8) 对手能一手做双威胁 → 抢先占掉，别让他四三
  let oppDbl = null, oppDblScore = -1
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (b[r][c] !== 0 || !near(b, r, c, 1)) continue
      const cl = classifyMove(b, opp, r, c)
      if (!isWinningDouble(cl)) continue
      const sc = cl.fours * 2 + cl.threes
      if (sc > oppDblScore) { oppDblScore = sc; oppDbl = { r, c } }
    }
  }
  if (oppDbl) return oppDbl

  // 9) 前瞻搜索 + 进攻倾向定位（平稳局面也主动做攻势）
  let best = cands[0]
  let bestRank = -Infinity
  let alpha = -Infinity
  const beta = Infinity
  for (const { r, c } of cands) {
    b[r][c] = color
    const raw = makesFive(b, r, c, color)
      ? WIN_SCORE
      : -negamax(b, HELL_DEPTH - 1, -beta, -alpha, opp)
    b[r][c] = 0
    if (raw > alpha) alpha = raw // α-β 用真实分，保证剪枝正确
    const cl = classifyMove(b, color, r, c)
    const rank = raw + cl.fours * 1500 + cl.threes * 600 // 主动攻势的小加权
    if (rank > bestRank) { bestRank = rank; best = { r, c } }
  }
  return best
}
