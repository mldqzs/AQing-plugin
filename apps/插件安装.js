import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import { Restart } from '../../other/restart.js'
import { exec } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

/*
 * 插件安装 / 删除（参考戏天插件 xitian-plugin）
 * - 支持安装 / 删除「单 js 插件」与「完整 plugin（git 仓库）」
 * - GitHub 链接自动按顺序尝试多个加速镜像，全部失败则退回原链接
 * - 仅主人可用
 */

// GitHub 加速镜像（按顺序尝试，最后退回原链接）
const GH_MIRRORS = [
  'https://ghfast.top/',
  'https://gh-proxy.com/',
  'https://ghproxy.net/',
  'https://github.moeyy.xyz/',
  'https://mirror.ghproxy.com/',
]

// 单 js 插件的存放目录（云崽会自动热加载该目录下的 js）
const JS_DIR = './plugins/example'

let uping = false

export class AQPluginInstall extends plugin {
  constructor() {
    super({
      name: 'AQ：插件安装',
      dsc: '安装/删除 js 插件与完整插件',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^#?阿晴(安装|新增)插件\\s*(\\S+)?$',
          fnc: 'install',
        },
        {
          reg: '^#?阿晴删除插件\\s*(\\S+)?$',
          fnc: 'remove',
        },
        {
          reg: '^#?阿晴(js)?插件列表$',
          fnc: 'list',
        },
      ],
    })
  }

  // 主人校验
  isMaster(e) {
    if (!e.isMaster) {
      e.reply('只有主人才能安装/删除插件哦~')
      return false
    }
    return true
  }

  /* ───────────── 安装 ───────────── */
  async install(e) {
    if (!this.isMaster(e)) return true

    const url = (e.msg.match(/^#?阿晴(?:安装|新增)插件\s*(\S+)?$/)?.[1] || '').trim()

    // 带链接：根据后缀判断单 js 还是完整插件
    if (url) {
      if (/\.js$/i.test(url)) return this.installJsFromUrl(e, url)
      return this.cloneGitPlugin(e, url)
    }

    // 不带链接：若消息已带 js 文件直接装，否则进入等待
    if (e.file) return this.installJsFromFile(e)

    this.setContext('getJsFile', e.isGroup, 60)
    await e.reply('请在 60 秒内发送要安装的 js 插件文件\n（或发送「#阿晴安装插件 仓库/文件链接」从链接安装）')
    return true
  }

  // 等待用户发送 js 文件的上下文回调
  async getJsFile() {
    const e = this.e
    if (/^#?取消(安装)?$/.test(e.msg || '')) {
      this.finish('getJsFile', e.isGroup)
      await e.reply('已取消安装')
      return true
    }
    if (!e.file) {
      await e.reply('没有检测到文件，请发送 js 文件，或发送「取消」结束')
      return false
    }
    this.finish('getJsFile', e.isGroup)
    return this.installJsFromFile(e)
  }

  // 安装 QQ 发送过来的 js 文件
  async installJsFromFile(e) {
    const fileName = e.file?.name || e.file?.file || ''
    if (!fileName.endsWith('.js')) {
      await e.reply('这不是 js 文件，已取消本次安装')
      return true
    }
    let fileUrl
    try {
      fileUrl = await this.resolveFileUrl(e)
    } catch (err) {
      await e.reply(`获取文件下载地址失败：${err?.message || err}`)
      return true
    }
    if (!fileUrl) {
      await e.reply('未能获取文件下载地址，可能是适配器不支持，请改用「#阿晴安装插件 链接」方式')
      return true
    }
    return this.saveJs(e, fileUrl, fileName)
  }

  // 兼容多适配器获取文件下载地址：群用 fs.download，私聊用 getFileUrl，部分适配器消息里已带 url
  async resolveFileUrl(e) {
    const f = e.file || {}
    // 适配器已直接给出 http(s) 下载地址
    if (typeof f.url === 'string' && /^https?:\/\//i.test(f.url)) return f.url

    // OneBotv11 群文件上传(group_upload)标准字段为 id；其它适配器可能用 fid/file_id/file
    const fid = f.id ?? f.fid ?? f.file_id ?? f.file
    const pick = e.isGroup ? e.group : e.friend

    // 私聊（OneBotv11 等）：pickFriend().getFileUrl → url 字符串
    if (typeof pick?.getFileUrl === 'function') {
      const ret = await pick.getFileUrl(fid)
      return typeof ret === 'string' ? ret : (ret?.url || ret?.data?.url)
    }
    // 群聊（OneBotv11 等）：pickGroup().fs.download → { url }
    if (typeof pick?.fs?.download === 'function') {
      const ret = await pick.fs.download(fid, f.busid)
      return typeof ret === 'string' ? ret : (ret?.url || ret?.data?.url)
    }
    return ''
  }

  // 从链接安装单 js
  async installJsFromUrl(e, url) {
    let name = 'plugin.js'
    try {
      name = path.basename(new URL(url).pathname) || name
    } catch {
      await e.reply('链接格式不正确')
      return true
    }
    await e.reply(`开始下载 js 插件：${name}`)
    return this.saveJs(e, url, name, /github\.com|githubusercontent\.com/i.test(url))
  }

  // 下载并落地单 js（accel 仅对 github 链接生效）
  async saveJs(e, url, name, isGithub = false) {
    if (!fs.existsSync(JS_DIR)) fs.mkdirSync(JS_DIR, { recursive: true })
    const savePath = path.join(JS_DIR, name)

    if (fs.existsSync(savePath)) {
      await e.reply(`已存在同名 js 插件：${name}，将进行覆盖安装`)
    }

    const candidates = isGithub ? this.buildUrlCandidates(url) : [url]
    let ok = false
    for (const u of candidates) {
      if (await common.downFile(u, savePath)) {
        ok = true
        if (u !== url) logger.mark(`[AQ插件安装] 经加速镜像下载成功：${u}`)
        break
      }
    }

    if (!ok) {
      await e.reply('js 插件下载失败，请检查链接或网络')
      return true
    }
    await e.reply(`js 插件「${name}」已安装到 plugins/example，云崽将自动热加载~`)
    return true
  }

  /* ───────────── 完整插件（git） ───────────── */
  async cloneGitPlugin(e, url) {
    if (uping) {
      await e.reply('已有安装任务进行中，请稍候')
      return true
    }
    if (!(await this.checkGit(e))) return true

    // 规范化为 .git 结尾
    let repo = url.replace(/\/$/, '')
    if (!repo.endsWith('.git')) repo += '.git'

    let name
    try {
      name = path.basename(new URL(repo).pathname).replace(/\.git$/, '')
    } catch {
      await e.reply('链接格式不正确，请发送 github / gitee 仓库地址')
      return true
    }

    const dest = path.join('./plugins', name)
    if (fs.existsSync(dest)) {
      await e.reply(`已安装该插件：${name}，如需重装请先「#阿晴删除插件 ${name}」`)
      return true
    }

    await e.reply(`开始安装插件：${name}，正在尝试可用线路…`)

    const candidates = this.buildUrlCandidates(repo)
    uping = true
    let success = false
    let lastErr = ''
    for (let i = 0; i < candidates.length; i++) {
      const u = candidates[i]
      const tag = u === repo ? '原始线路' : `加速线路${i + 1}`
      const ret = await this.execSync(`git clone --depth=1 ${u} "${dest}"`)
      if (!ret.error) {
        success = true
        await e.reply(`[${tag}] 克隆成功`)
        break
      }
      lastErr = (ret.stderr || ret.error?.message || '').toString()
      // 清理失败残留，避免影响下一条线路
      if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true })
      logger.warn(`[AQ插件安装] ${tag} 失败：${u}`)
    }
    uping = false

    if (!success) {
      await e.reply(`所有线路均安装失败 T_T\n${lastErr.slice(0, 200)}`)
      return true
    }

    // 安装依赖
    if (fs.existsSync(path.join(dest, 'package.json'))) {
      await e.reply('正在安装插件依赖，请稍候…')
      const res = await this.addPak(dest)
      await e.reply(res.error ? `依赖安装失败：${(res.stderr || res.error).toString().slice(0, 200)}` : '依赖安装完成')
    }

    await e.reply(`插件「${name}」安装成功，即将重启生效~`)
    setTimeout(() => new Restart(e).restart(), 2000)
    return true
  }

  /* ───────────── 删除 ───────────── */
  async remove(e) {
    if (!this.isMaster(e)) return true
    let name = (e.msg.match(/^#?阿晴删除插件\s*(\S+)?$/)?.[1] || '').trim()
    if (!name) {
      await e.reply('请带上要删除的插件名，例如：#阿晴删除插件 example2')
      return true
    }

    // 1) 完整插件目录
    const dir = path.join('./plugins', name)
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      if (name === 'AQing-plugin' || name === 'system' || name === 'example') {
        await e.reply(`「${name}」是核心/系统目录，禁止删除`)
        return true
      }
      fs.rmSync(dir, { recursive: true, force: true })
      await e.reply(`已删除插件：${name}，即将重启生效~`)
      setTimeout(() => new Restart(e).restart(), 2000)
      return true
    }

    // 2) 单 js 插件（plugins/example 下）
    const jsName = name.endsWith('.js') ? name : `${name}.js`
    const jsPath = path.join(JS_DIR, jsName)
    if (fs.existsSync(jsPath)) {
      fs.rmSync(jsPath, { force: true })
      await e.reply(`已删除 js 插件：${jsName}，云崽将自动卸载~`)
      return true
    }

    await e.reply(`未找到名为「${name}」的插件（已在 plugins 与 plugins/example 内查找）`)
    return true
  }

  /* ───────────── 列表（plugins/example 下的单 js） ───────────── */
  async list(e) {
    if (!this.isMaster(e)) return true
    if (!fs.existsSync(JS_DIR)) {
      await e.reply('plugins/example 目录不存在')
      return true
    }
    const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'))
    if (!files.length) {
      await e.reply('plugins/example 下暂无单 js 插件')
      return true
    }
    await e.reply(`已安装的 js 插件（共 ${files.length} 个）：\n` + files.map(f => `· ${f}`).join('\n'))
    return true
  }

  /* ───────────── 工具方法 ───────────── */

  // 构建候选链接：github 走加速镜像，最后退回原链接；其它（如 gitee）直接用原链接
  buildUrlCandidates(url) {
    if (!/github\.com|raw\.githubusercontent\.com/i.test(url)) return [url]
    const list = GH_MIRRORS.map(m => m + url)
    list.push(url) // 原链接兜底
    return list
  }

  async addPak(cwd) {
    let npm = 'npm'
    if (fs.existsSync('node_modules/.pnpm')) npm = 'pnpm'
    else if (fs.existsSync('node_modules/.yarn-integrity')) npm = 'yarn'
    return this.execSync(`${npm} install --omit=dev`, { cwd })
  }

  async checkGit(e) {
    const ret = await this.execSync('git --version')
    if (ret.error || !/git version/.test(ret.stdout || '')) {
      await e.reply('未检测到 git，请先安装 git')
      return false
    }
    return true
  }

  // 执行命令，统一返回 {error, stdout, stderr}
  execSync(cmd, options = {}) {
    return new Promise(resolve => {
      exec(cmd, { windowsHide: true, timeout: 120000, ...options }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr })
      })
    })
  }
}
