import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const _dir = dirname(fileURLToPath(import.meta.url))
const pluginRoot = join(_dir, '..')

function readJSON(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

/** 获取 Yunzai 版本与插件版本 */
export function getVersionInfo() {
  const yunzaiVersion = readJSON(join(process.cwd(), 'package.json')).version || '未知'
  const pluginVersion = readJSON(join(pluginRoot, 'package.json')).version || '未知'
  return { yunzaiVersion, pluginVersion }
}

/** 读取 CHANGELOG 最新一节（标题 + 内容） */
export function getLatestChangelog() {
  try {
    const text = fs.readFileSync(join(pluginRoot, 'CHANGELOG.md'), 'utf8')
    const blocks = text.split(/^#\s+/m).map(s => s.trim()).filter(Boolean)
    if (!blocks.length) return ''
    const last = blocks[blocks.length - 1].split('\n')
    const ver = last.shift().trim()
    const body = last.join('\n').trim()
    return body ? `v${ver}\n${body}` : `v${ver}`
  } catch {
    return ''
  }
}
