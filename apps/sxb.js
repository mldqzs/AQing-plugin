import plugin from '../../../lib/plugins/plugin.js'
import YAML from "yaml"
import fs from "node:fs"
import Y from '../Yaml/y.js'
const mst = new Y('../config/config/config.yaml')
const botname = mst.get('config.botname');
const closetip = mst.get('close_tip');
const starttip  = mst.get('start_tip');

export class jinyong extends plugin {
    constructor() {
        super({
            name: "AQ:机器人群开关",
            dsc: "上下班",
            event: "message",
            priority: -10,
            rule: [{
                reg: `^${botname}下班$`,
                fnc: "jinyong",
                permission: 'master',
            },
            {
                reg: `^${botname}上班$`,
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
            const data = YAML.parse(fs.readFileSync(this.file, 'utf8'))
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