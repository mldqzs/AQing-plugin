
import plugin from '../../../lib/plugins/plugin.js'//导包部分
import { segment } from "oicq";
import fetch from "node-fetch";
const xhz_path = 'plugins/AQing-plugin/resources/ys/'
export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: 'AQ：小功能',
            /** 功能描述 */
            dsc: '小功能',
            /** https://oicqjs.github.io/oicq/#events */
            event: 'message',
            /** 优先级，数字越小等级越高 */
            priority: 4888,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: '^(.*)原神(.*)$',
                    /** 执行方法 */
                    fnc: 'ys'
                },{
                    /** 命令正则匹配 */
                    reg: '^((.*)丁真(.*)|(.*)雪豹（.*))$',
                    /** 执行方法 */
                    fnc: 'dj'
                }, {
                    /** 命令正则匹配 */
                    reg: '^((.*)鸡你太美(.*)|(.*)坤坤(.*)|(.*)小黑子(.*)|(.*)鲲鲲(.*)|(.*)鸽鸽(.*)|(.*)唱跳(.*)$',
                    /** 执行方法 */
                    fnc: 'kk'
                },
            ]
        })
    }
    async ys(e) {
        let file = fs.readdirSync(xhz_path)
        let imgnum = Math.round(Math.random() * (file.length - 1))
        let msg = [segment.at(e.user_id), segment.image('file://' + xhz_path + file[imgnum])]
        await e.reply(msg);
        return true
    }
    async dj(e) {
        let url = `https://api.fengye.ink/api/dzimg`
        let msg = [segment.at(e.user_id), segment.image(url)]
        await e.reply(msg);
        return true
    }
    async kk(e) {
        let kun = `https://www.duxianmen.com/api/ikun`
        let msg = [segment.at(e.user_id), segment.image(kun)]
        await e.reply(msg);
        return true
    }
}
 
 