
import plugin from '../../../lib/plugins/plugin.js'//导包部分
import fs from 'node:fs';
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
                    reg: '^拿纸写字(.*)$',
                    /** 执行方法 */
                    fnc: 'dj'
                }, {
                    /** 命令正则匹配 */
                    reg: '^((.*)鸡你太美(.*)|(.*)坤坤(.*)|(.*)小黑子(.*)|(.*)鲲鲲(.*)|(.*)鸽鸽(.*)|(.*)唱跳(.*))$',
                    /** 执行方法 */
                    fnc: 'kk'
                },
                {
                    /** 命令正则匹配 */
                    reg: '^摸鱼人日历$',
                    /** 执行方法 */
                    fnc: 'moyu'
                },
                {
                    reg: '^查凶吉$',
                    fnc: 'xj'
                },
                {
                    reg: '^答案之书(.*)$',
                    fnc: 'da'
                },
                {
                    reg: '^龙一下$',
                    fnc: 'lt'
                },
                {
                    reg: '^取个昵称$',
                    fnc: 'nc'
                },
                {
                    reg: '^屁话生成(.*)$',
                    fnc: 'ph'
                },
                {
                    reg: '^加密(.*)$',
                    fnc: 'yn'
                }
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
    async yn(e) {
        let m = e.msg.replace("加密","").trim()
    m = m.split(" ")
        let url = `https://wanghun.top/api/yh/v2/luosi.php?jia=${m}`
        let res = await fetch(url).catch((err) => logger.error(err));
        res = await res.text();
        await e.reply(res);
        return true
    }
    async dj(e) {
        let m = e.msg.replace("拿纸写字","").trim()
    m = m.split(" ")
        let url = `https://api.cenguigui.cn/api/diy/?text=${m}`
        let msg = [segment.at(e.user_id), segment.image(url)]
        await e.reply(msg);
        return true
    }
    async lt(e) {
        let url = `https://api.lolimi.cn/API/longt/l.php`
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
    async moyu(e) {
        let kun = `https://api.vvhan.com/api/moyu`
        let msg = [segment.at(e.user_id), segment.image(kun)]
        await e.reply(msg);
        return true
    }
    async xj(e) {
        let qq = e.user_id
        if (e.at) qq = e.at
        if (e.atBot) qq = Bot.uin
        logger.info('[AQ：凶吉]', e.msg);
        let url= `https://api.lolimi.cn/API/xiongji/api.php?qq=${qq}`
        let res = await fetch(url).catch((err) => logger.error(err));
        if (!res) {
            logger.error('查询接口请求失败');
            return await this.reply('查询接口请求失败');
        }
        res = await res.json();
        logger.info(`请求结果：${res.text}`);
        e.reply(`qq：${res.data.uin}\n凶吉：${res.data.luck}\n评价：${res.data.evaluate}\n解读：${res.data.master}`)
        return true;
        }
    async da(e) {
        logger.info('[AQ：答案之书]', e.msg);
        let m = e.msg.replace("屁话生成","").trim()
        msg = msg.split(" ")
        let url= `https://api.lolimi.cn/API/daan/?type=json`
        let res = await fetch(url).catch((err) => logger.error(err));
        if (!res) {
            logger.error('查询接口请求失败');
            return await this.reply('查询接口请求失败');
        }
        res = await res.json();
        logger.info(`请求结果：${res.text}`);
        e.reply(`你的问题是：${m}\n答案为,${res.data.zh}\n${res.data.en}\n`)
        return true;
        }
    async nc(e) {
        logger.info('[AQ：昵称]', e.msg);
        let url= `https://api.lolimi.cn/API/naen/`
        let res = await fetch(url).catch((err) => logger.error(err));
        if (!res) {
            logger.error('查询接口请求失败');
            return await this.reply('查询接口请求失败');
        }
        res = await res.json();
        e.reply(`来咯，看看吧：\n${res.data.name}\n`)
        return true
        }
    async ph(e) {
            let msg = e.msg.replace("屁话生成","").trim()
    msg = msg.split(" ")
        logger.info('[AQ：屁话生成]', e.msg);
        let url= `https://oiapi.net/API/Bullshit/?title=${msg}&length=200`
        let res = await fetch(url).catch((err) => logger.error(err));
        if (!res) {
            logger.error('查询接口请求失败');
            return await this.reply('查询接口请求失败');
        }
        res = await res.json();
        e.reply(`${res.message}`)
        return true
        }
}
