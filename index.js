import fs from 'node:fs'
import { execSync } from 'node:child_process'

if (!global.segment) {
  global.segment = (await import("oicq")).segment
}

if (!global.core) {
  try {
    global.core = (await import("oicq")).core
  } catch (err) {}
}

// 一次性迁移：老版本曾把用户配置 config/config 提交进仓库，导致 #更新/#强制更新
// 覆盖甚至删除用户配置。这里检测到它仍被 git 跟踪时，自动解除跟踪（git rm --cached，
// 不删除本地文件）。处理后无论 #更新 还是 #强制更新 都不会再动用户配置。幂等，已迁移则跳过。
function migrateConfigTracking() {
  const root = './plugins/AQing-plugin'
  try {
    if (!fs.existsSync(`${root}/.git`)) return
    const tracked = execSync(`git -C ${root} ls-files config/config`, { encoding: 'utf8' }).trim()
    if (!tracked) return // 已不在版本控制，无需迁移
    execSync(`git -C ${root} rm -r --cached config/config`, { stdio: 'ignore' })
    logger.mark('[阿晴插件] 已将 config/config 移出版本控制，今后更新不会再覆盖你的配置')
  } catch (err) {
    logger.warn(`[阿晴插件] 配置迁移跳过：${err?.message || err}`)
  }
}
migrateConfigTracking()

const files = fs.readdirSync('./plugins/AQing-plugin/apps').filter(file => file.endsWith('.js'))

let ret = []
logger.info(`🌴―――――――――――――――――――――――――――🌴`)
logger.info(` 阿晴插件载入成功,感谢您的使用!!!`)
logger.info(` 阿晴最可爱！`)
logger.info(` 阿晴专用插件~~~~`)
logger.info(`🌴――――――――――――――――――――――――――――🌴`)

files.forEach((file) => {
    ret.push(import(`./apps/${file}`))
  })
  
  ret = await Promise.allSettled(ret)
  
  let apps = {}
  for (let i in files) {
    let name = files[i].replace('.js', '')
  
    if (ret[i].status != 'fulfilled') {
      logger.error(`载入插件错误：${logger.red(name)}`)
      logger.error(ret[i].reason)
      continue
    }
    apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
  }
  export { apps }