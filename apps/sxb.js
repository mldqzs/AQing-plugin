import plugin from '../../../lib/plugins/plugin.js'
import YAML from "yaml"
import fs from "node:fs"
import sycfg from '../config/config.js'

const starttip = await sycfg.get_cfg('bot.yaml', 'start_tip')
const closetip = await sycfg.get_cfg('bot.yaml', 'close_tip')
const startorder = await sycfg.get_cfg('bot.yaml', 'start_order')
const closeorder = await sycfg.get_cfg('bot.yaml', 'close_order')

export class jinyong extends plugin {
    constructor() {
        super({
            name: "AQ:上下班",
            dsc: "上下班",
            event: "message",
            priority: -10,
            rule: [{
                reg: `^${closeorder}$`,
                fnc: "jinyong",
                permission: 'master',
            },
            {
                reg: `^${startorder}$`,
                fnc: "kaiqi",
                permission: 'master',
            },
            ],
        });
    }

    // 关机
    async jinyong(e) {
        if (e.isGroup) {
            this.file = './config/config/group.yaml'
            let data = YAML.parse(fs.readFileSync(this.file, 'utf8'))
            console.log(data)
            data[e.group_id] = { enable: ["AQ:机器人群开关",] }
            let yaml = YAML.stringify(data)
            fs.writeFileSync(this.file, yaml, "utf8")
            e.reply(closetip)
        } else {
            e.reply('请在群聊中使用')
        }
    }

    /** 开机 */
    async kaiqi(e) {
        if (e.isGroup) {
            this.file = './config/config/group.yaml'
            let data = YAML.parse(fs.readFileSync(this.file, 'utf8'))
            data[e.group_id] = { enable: null }
            let yaml = YAML.stringify(data)
            fs.writeFileSync(this.file, yaml, "utf8")
            e.reply(starttip)
        } else {
            e.reply('请在群聊中使用')
        }
    }
}