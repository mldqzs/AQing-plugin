// 只使用详情接口已有的统计，不额外请求；缺失值与真实的 0 分开处理。
const FIELDS = {
  bili: { likes: ['like'], comments: ['reply'], shares: ['share'], views: ['view'], favorites: ['favorite'], coins: ['coin'], danmaku: ['danmaku'] },
  douyin: { likes: ['digg_count', 'diggCount'], comments: ['comment_count', 'commentCount'], shares: ['share_count', 'shareCount'], views: ['play_count', 'playCount'], favorites: ['collect_count', 'collectCount'] },
  kuaishou: { likes: ['likeCount', 'like_count', 'likeCnt'], comments: ['commentCount', 'comment_count', 'commentCnt'], shares: ['shareCount', 'share_count', 'shareCnt'], views: ['viewCount', 'view_count', 'viewCnt'], favorites: ['collectCount', 'collect_count', 'collectCnt'] },
}

function countValue(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string') {
    const match = value.trim().replace(/[,，]/g, '').match(/^(\d+(?:\.\d+)?)\s*([万亿wW]?)\+?$/)
    if (!match) return null
    value = Number(match[1]) * ({ 万: 1e4, 亿: 1e8, w: 1e4, W: 1e4 }[match[2]] || 1)
  }
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null
}

export function extractVideoStats(platform, ...sources) {
  const result = {}
  for (const [key, aliases] of Object.entries(FIELDS[platform] || {})) {
    result[key] = null
    for (const source of sources) {
      for (const alias of aliases) {
        const value = countValue(source?.[alias])
        // 抖音公开详情里的 play_count=0 是未公开播放量的占位值。
        if (platform === 'douyin' && key === 'views' && value === 0) continue
        if (value !== null) { result[key] = value; break }
      }
      if (result[key] !== null) break
    }
  }
  return result
}

export function formatVideoCount(value) {
  const count = countValue(value)
  if (count === null) return '—'
  const compact = (unit, suffix) => `${Number((count / unit).toFixed(1))}${suffix}`
  if (count >= 99995000) return compact(1e8, '亿')
  if (count >= 10000) return compact(1e4, '万')
  return String(count)
}

export function buildVideoStats(result) {
  if (result.live) return []
  const stats = result.stats || {}
  return [
    ['likes', '点赞'], ['comments', '评论'], ['shares', '转发'],
    ['views', '播放'], ['favorites', '收藏'], ['coins', '投币'], ['danmaku', '弹幕'],
  ].filter(([key], index) => index < 3 || countValue(stats[key]) !== null)
    .map(([key, label]) => ({ key, label, value: formatVideoCount(stats[key]) }))
}
