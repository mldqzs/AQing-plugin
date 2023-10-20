import plugin from '../../../lib/plugins/plugin.js'
import helpUtil from '../model/help.js'
import puppeteer from "../../../lib/puppeteer/puppeteer.js";

const _path = process.cwd().replace(/\\/g, "/");


export class help extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: 'AQ帮助',
            /** 功能描述 */
            dsc: '阿晴插件帮助',
            /** https://oicqjs.github.io/oicq/#events */
            event: 'message',
            /** 优先级，数字越小等级越高 */
            priority: 999,
            rule: [
                {
                    reg: '^#?阿晴(插件)?帮助$',
                    fnc: 'help'
                }
            ]
        })
    }


    async help(e) {
        let helpList = helpUtil.getList()
        let data = {
            tplFile: './plugins/AQing-plugin/resources/html/help/help.html',
            pluResPath: _path,
            helpList
        }
        let img = await puppeteer.screenshot("help", data);
        e.reply(img)
        return true
    }

}