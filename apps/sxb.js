import plugin from '../../../lib/plugins/plugin.js'
import YAML from "yaml"
import fs from "node:fs"
import Y from '../Yaml/y.js'

const CFG_PATH = './plugins/AQing-plugin/config/config/config.yaml'
// botname、提示语均实时读取，锅巴/配置改动即时生效（无需重启）
const getCfg = (key) => new Y(CFG_PATH).get(key)

export class jinyong extends plugin {
    constructor() {
        super({
            name: "AQ：机器人群开关",
            dsc: "上下班",
            event: "message",
            priority: -10,
            // 触发词不写死 botname（写死会被加载时编进正则、改名需重启）；
            // 这里用通用正则，再在处理函数内与实时 botname 比对，实现热加载。
            rule: [
                { reg: '^(.+)下班$', fnc: 'jinyong' },
                { reg: '^(.+)上班$', fnc: 'kaiqi' },
            ],
        });
    }

    // 校验名字是否匹配当前 botname 且为主人；不匹配则放行给其它插件
    checkName(e, suffix) {
        const m = e.msg.match(new RegExp(`^(.+)${suffix}$`))
        if (!m || m[1] !== getCfg('botname')) return false
        if (!e.isMaster) return false
        return true
    }

    // 下班（关机）
    async jinyong(e) {
        if (!this.checkName(e, '下班')) return false
        if (!e.isGroup) { e.reply('请在群聊中使用'); return true }
        this.file = './config/config/group.yaml'
        const data = YAML.parse(fs.readFileSync(this.file, 'utf8'))
        data[e.group_id] = { enable: ["AQ:机器人群开关"] }
        fs.writeFileSync(this.file, YAML.stringify(data), "utf8")
        e.reply(getCfg('close_tip') || `${getCfg('botname') || '我'}下班啦，开溜~`)
        return true
    }

    // 上班（开机）
    async kaiqi(e) {
        if (!this.checkName(e, '上班')) return false
        if (!e.isGroup) { e.reply('请在群聊中使用'); return true }
        this.file = './config/config/group.yaml'
        const data = YAML.parse(fs.readFileSync(this.file, 'utf8'))
        data[e.group_id] = { enable: null }
        fs.writeFileSync(this.file, YAML.stringify(data), "utf8")
        e.reply(getCfg('start_tip') || `${getCfg('botname') || '我'}上班啦，今天也元气满满~`)
        return true
    }
}
