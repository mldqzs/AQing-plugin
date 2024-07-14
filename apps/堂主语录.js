import { exec } from 'child_process'
import fs from 'fs'
import plugin from '../../../lib/plugins/plugin.js'
import fetch from 'node-fetch'
import cfg from'../../../lib/config/config.js'
import common from '../../../lib/common/common.js'

const _path = process.cwd()
const resPath = `${_path}/AQing-plugin/resources`
const xhz_path = 'AQing-plugin/resources/tangzhu/tangzhu/'

export class tangzhu extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: '堂主语录',
            /** 功能描述 */
            dsc: '随机堂主',
            /** https://oicqjs.github.io/oicq/#events */
            event: 'message',
            /** 优先级，数字越小等级越高 */
            priority: 5000,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: '^堂主$',
                    /** 执行方法 */
                    fnc: 'tz'
                },
                {
                    /** 命令正则匹配 */
                    reg: '^#(强制)?更新堂主语录',
                    /** 执行方法 */
                    fnc: 'gx'
                },
            ]
        })
    }

    async tz(e) {
        logger.info('[用户命令]', e.msg)
        try{
        let file = fs.readdirSync(xhz_path)
        let imgnum = Math.round(Math.random() * (file.length - 1))
        let msg = [segment.at(e.user_id), segment.image('file://' + xhz_path + file[imgnum])]
        await e.reply(msg);
        }
        catch(err) {
            e.reply('出问题了，可能是资源未安装，请先使用#更新堂主语录来安装资源');
        }
        return true
    }


    async gx(e) {
        let isForce = e.msg.includes('强制')
        let command = ''
        if (fs.existsSync(`${resPath}/tangzhu/`)) {
            e.reply('开始尝试更新，请耐心等待~')
            command = 'git pull'
            if (isForce) {
                command = 'git  checkout . && git  pull'
            }
            exec(command, { cwd: `${resPath}/tangzhu/` }, function (error, stdout, stderr) {
                console.log(stdout)
                if (/(Already up[ -]to[ -]date|已经是最新的)/.test(stdout)) {
                    e.reply('目前所有图片都已经是最新了~')
                    return true
                }
                let numRet = /(\d*) files changed,/.exec(stdout)
                if (numRet && numRet[1]) {
                    e.reply(`更新成功，此次更新了${numRet[1]}个逆天语录~`)
                    return true
                }
                if (error) {
                    e.reply('更新失败！\nError code: ' + error.code + '\n' + error.stack + '\n 请稍后重试。')
                } else {
                    e.reply('逆天语录更新成功~')
                }
            })
        } else {
            command = `git clone https://gitee.com/aayhg/tangzhuyulu.git "${resPath}/tangzhu/" --depth=1`
            e.reply('开始尝试安装，可能会需要一段时间，请耐心等待~')
            exec(command, function (error, stdout, stderr) {
                if (error) {
                    e.reply('安装失败！\nError code: ' + error.code + '\n' + error.stack + '\n 请稍后重试。')
                } else {
                    e.reply('逆天语录安装成功！')
                }
            })
        }
        return true
    }
}
