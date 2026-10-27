import { extractVideoStats } from './videoStats.js'

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
const HEADERS = { 'User-Agent': MOBILE_UA, Referer: 'https://v.kuaishou.com/' }

// 网页作品页没有 INIT_STATE，统一走公开移动分享页；短链仍先跟随跳转。
export function kuaishouShareUrl(rawUrl) {
  const url = new URL(rawUrl)
  if (/(^|\.)kuaishou\.com$/i.test(url.hostname)) {
    const id = url.pathname.match(/^\/short-video\/([\w-]+)/)?.[1]
      || url.pathname.match(/^\/photo\/[^/]+\/([\w-]+)/)?.[1]
    if (id) return `https://v.m.chenzhongtech.com/fw/photo/${id}`
  }
  return url.href.replace('/fw/long-video/', '/fw/photo/')
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    await res.body?.cancel()
    throw new Error(`快手分享页请求失败 HTTP ${res.status}`)
  }
  return res
}

export async function parseKuaishou(rawUrl) {
  let res = await fetchPage(kuaishouShareUrl(rawUrl))
  const pageUrl = res.url || rawUrl
  const shareUrl = kuaishouShareUrl(pageUrl)
  if (shareUrl !== pageUrl) {
    await res.body?.cancel()
    res = await fetchPage(shareUrl)
  }
  const html = await res.text()

  // 直播分享使用独立播放器，只返回房间信息。
  if (/\/fw\/live\//i.test(pageUrl)) {
    const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
      || html.match(/<title[^>]*>([^<]+)/i)?.[1] || '快手直播'
    const cover = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] || ''
    return { platform: '快手直播', title: title.trim(), author: '', cover, online: '', live: true, pageUrl, video: null }
  }

  const match = html.match(/window\.INIT_STATE\s*=\s*(.*?)<\/script>/s)
  if (!match) throw new Error('快手页面结构变化，解析失败')
  let data
  try { data = JSON.parse(match[1].trim().replace(/;\s*$/, '')) } catch { throw new Error('快手页面数据解析失败') }
  // INIT_STATE 的缓存键会变化，只读取 photo，不能把 counts 中作者的获赞总数当作作品点赞。
  const entries = Object.values(data).filter(value => value && typeof value === 'object')
  const photo = entries.find(value => value.photo)?.photo
  if (!photo) throw new Error('快手作品获取失败（可能已删除、需要登录，或页面已改版）')

  const result = {
    platform: '快手', title: photo.caption || '', author: photo.userName || '',
    cover: photo.coverUrls?.[0]?.url || '', duration: Math.round((photo.duration || 0) / 1000),
    pageUrl, stats: extractVideoStats('kuaishou', photo, photo.statistics, photo.stats),
    video: null, images: null,
  }
  const atlas = photo.ext_params?.atlas
  if (atlas?.cdnList?.length && atlas?.list?.length) {
    const host = atlas.cdnList[0]?.cdn || atlas.cdnList[0]
    const images = atlas.list.map(route => `https://${host}/${route}`).filter(Boolean)
    if (images.length) return { ...result, duration: 0, images }
  }
  const url = photo.mainMvUrls?.[0]?.url || ''
  if (!url) throw new Error('未取到快手视频直链')
  return { ...result, video: { url, headers: HEADERS } }
}
