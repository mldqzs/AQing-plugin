import fs from 'node:fs'
import plugin from '../../../lib/plugins/plugin.js'
import helpUtil from '../model/help.js'
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import { getVersionInfo } from '../model/version.js'

const _path = process.cwd().replace(/\\/g, "/");
const DEFAULT_ICON = 16


export class help extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: 'AQ：帮助',
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
        // 渲染前确认图标文件存在，缺失的直接换成默认图标；
        // 不依赖模板里的 onerror 替换（截图时替换可能还没完成，图标就裂了）
        const iconDir = `${_path}/plugins/AQing-plugin/resources/html/help/img`
        const raw = helpUtil.getList()
        const helpList = {
            ...raw,
            list: (raw.list || []).map(item => ({
                ...item,
                icon: fs.existsSync(`${iconDir}/${item.icon}.png`) ? item.icon : DEFAULT_ICON
            }))
        }
        const { yunzaiVersion, pluginVersion } = getVersionInfo()
        let data = {
            tplFile: './plugins/AQing-plugin/resources/html/help/help.html',
            pluResPath: _path,
            helpList,
            yunzaiVersion,
            pluginVersion
        }
        let img = await puppeteer.screenshot("help", data);
        e.reply(img)
        return true
    }

}