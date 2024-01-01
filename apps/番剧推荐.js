import plugin from '../../../lib/plugins/plugin.js'
import fetch from 'node-fetch'
import lodash from "lodash";
export class slander extends plugin {
    constructor() {
        super({
            name: 'AQ：番剧推荐',
            dsc: '番剧推荐',
            /** https://oicqjs.github.io/oicq/#events */
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: '^#今日番剧推荐$',
                    fnc: 'fanju'
                }
            ]
        })
    }
    async fanju(e){
        logger.info('[AQ：fanju]', e.msg);
        let url= `https://api.lolimi.cn/API/B_Update/?num=1`
        let res = await fetch(url).catch((err) => logger.error(err));
        if (!res) {
            logger.error('查询接口请求失败');
            return await this.reply('查询接口请求失败');
        }
        res = await res.json();
        logger.info(`请求结果：${res.text}`);
        if(res.text=="获取成功"){
            e.reply("呐呐呐来啦!(数据来源于bilibili，问就是没找到其他接口）");
            let msg=[`标题:${res.data.Name}\n预览图:`,segment.image(`${res.data.Picture}`) ,`\n最近更新:${res.data.Update},\n直达链接:${res.data.Url}`]
             e.reply(msg)
        }
    }
}