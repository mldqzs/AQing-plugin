/**
 * QQ 信息查询
 * 数据均来源于网络，内容可能不太准确
 */
import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import { getVersionInfo } from '../model/version.js'

const _path = process.cwd().replace(/\\/g, '/')

export default class QQInfoQuery extends plugin {
    constructor() {
        super({
            name: 'AQ：QQ信息查询',
            dsc: 'QQ查询',
            event: 'message',
            priority: 500,
            rule: [
                {
                    reg: '^#QQ注册时间\\s*(\\d*)$',
                    fnc: 'queryQQInfo'
                }
            ]
        })
    }

    async queryQQInfo(e) {
        const atQQs = e.message.filter(item => item.type === 'at').map(item => item.qq)
        const qq = atQQs[0] || e.msg.match(/\d+/)?.[0] || e.user_id

        if (!qq) {
            await e.reply('未指定查询目标')
            return true
        }

        const apiUrl = 'https://api.s01s.cn/API/zcsj/'
        const params = { qq, key: 'CD3265E5962F85A3DB0C850F9D137D58' }

        try {
            const res = await fetch(`${apiUrl}?${new URLSearchParams(params)}`)
            const rawData = await res.text()

            if (!rawData.includes('注册时间')) {
                await e.reply('查询失败，请检查账号有效性或API状态')
                return true
            }

            const view = this.buildViewData(rawData)

            // 头像内嵌 base64，确保截图时一定能渲染（远程图直连常来不及加载）
            const avatar = await this.fetchBase64(`https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=640`)

            const now = new Date().toLocaleString('zh-CN', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            })

            const { pluginVersion } = getVersionInfo()

            const data = {
                tplFile: './plugins/AQing-plugin/resources/html/qqinfo/qqinfo.html',
                pluResPath: _path,
                saveId: 'qqinfo',
                imgType: 'jpeg',
                quality: 100,
                qq: String(qq),
                avatar,
                ...view,
                now,
                pluginVersion
            }

            const img = await puppeteer.screenshot('qqinfo', data)
            if (img) {
                await e.reply(img)
            } else {
                // 截图失败降级纯文字
                await e.reply(this.buildTextMessage(rawData, qq))
            }

        } catch (err) {
            logger.error('[QQInfoQuery] 查询异常:', err)
            await e.reply('服务暂不可用，请稍后重试')
        }
        return true
    }

    /* ── 远程图片 → base64 data URI ── */
    async fetchBase64(url) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
            if (!res.ok) return ''
            const buf = await res.arrayBuffer()
            const mime = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
            return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
        } catch {
            return ''
        }
    }

    /* ── API 返回文本 → [{key, value}] ── */
    parseData(rawData) {
        const result = []

        // API 返回格式举例：
        //   注册时间：2014-01-01 10：44      （全角冒号作字段分隔，时间也用全角冒号）
        //   注册时间：2014-01-01 10:44:00    （全角冒号作字段分隔，时间用英文冒号）
        //   注册时间:2014-01-01 10:44        （英文冒号作字段分隔，时间也用英文冒号）
        //
        // 策略：逐行先用正则找"字段名" = 开头到第一个分隔冒号之前的非数字串
        // 字段名不含数字，时间里的 10：44 这种"数字：数字"不会被当成字段名
        for (const line of rawData.split('\n')) {
            if (!line.trim()) continue

            // 匹配：开头的字段名（不含数字）+ 紧跟的全角或半角冒号
            // 字段名示例：注册时间、查询账号、普通会员、开通业务……
            const m = line.match(/^([^：:0-9][^：:]*)[：:](.+)$/)
            if (!m) continue

            const key = m[1].trim()
            const value = m[2].trim()
            if (key && value) result.push({ key, value })
        }
        return result
    }

    /* ── 解析结果 → 模板分组数据 ── */
    buildViewData(rawData) {
        const map = new Map()
        for (const { key, value } of this.parseData(rawData)) {
            // 去掉“查询”前缀与结尾多余的标点（如“0天.”）
            const k = key.replace(/^查询/, '')
            const v = value
                .replace(/[.。]+$/, '')
                .replace(/(\d)：(\d)/g, '$1:$2') // 时间里的全角冒号统一为半角
            if (!map.has(k)) map.set(k, v)
        }
        const used = new Set()
        const take = k => { used.add(k); return map.get(k) || '' }
        const isUnset = v => !v || /^(未设置|未开通|没有|无$|暂无)/.test(v)

        const profile = {
            nickname: take('昵称'),
            level: take('等级'),
            icons: take('图标'),
            signature: take('签名'),
            qid: take('QID'),
            card: take('名片'),
            age: take('年龄')
        }
        take('账号')
        const tags = []
        if (!isUnset(profile.qid)) tags.push({ label: 'QID', value: profile.qid })
        if (!isUnset(profile.card)) tags.push({ label: '名片', value: profile.card })
        if (!isUnset(profile.age)) tags.push({ label: '年龄', value: profile.age })

        // 注册天数：“10186天(≈27.9年)” → 主值 + 副值
        const regDaysRaw = take('注册天数')
        const regDaysM = regDaysRaw.match(/^(\d+)\s*天\s*[(（]?\s*([^)）]*)[)）]?/)
        const register = {
            time: take('注册时间'),
            days: regDaysM ? regDaysM[1] : regDaysRaw,
            years: regDaysM ? regDaysM[2] : ''
        }

        const stats = [
            ['活跃天数', '活跃天数'],
            ['达人天数', '达人天数'],
            ['头像修改', '头像修改']
        ].filter(([k]) => map.has(k)).map(([k, label]) => ({ label, value: take(k) }))

        const vipStats = [
            ['会员等级', '会员等级'],
            ['会员经验', '会员经验'],
            ['会员成长', '成长速度']
        ].filter(([k]) => map.has(k)).map(([k, label]) => ({ label, value: take(k) }))

        const vipRows = ['超级会员', '年费会员', '普通会员', '年大会员', '月大会员']
            .filter(k => map.has(k))
            .map(k => {
                const value = take(k)
                return { label: k, value, off: isUnset(value), date: /\d{4}-\d{1,2}-\d{1,2}/.test(value) }
            })

        // 开通业务：“超级会员9;SVIP+QQ音乐1;…” → [{name, lv}]
        const services = take('开通业务')
            .split(/[;；,，]/)
            .map(s => s.trim())
            .filter(s => s && !isUnset(s))
            .map(s => {
                const m = s.match(/^(.*?)(\d+)$/)
                return m ? { name: m[1], lv: m[2] } : { name: s, lv: '' }
            })

        const others = [...map]
            .filter(([k, v]) => !used.has(k) && v)
            .map(([label, value]) => ({ label, value }))

        return { profile, tags, register, stats, vipStats, vipRows, services, others }
    }

    /* ── 截图失败降级纯文字 ── */
    buildTextMessage(rawData, qq) {
        const lines = rawData.split('\n').filter(l => l.trim())
        let msg = `📌 QQ信息查询结果\n════════════════\n目标QQ：${qq}\n`
        for (const line of lines) {
            const sep = line.includes(':') ? ':' : '：'
            const [key, ...rest] = line.split(sep)
            const value = rest.join(sep).trim()
            if (key?.trim() && value) msg += `▸ ${key.trim()}${sep} ${value}\n`
        }
        msg += `════════════════\n查询时间：${new Date().toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        })}`
        return msg
    }
}
