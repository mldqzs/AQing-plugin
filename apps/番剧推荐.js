import plugin from '../../../lib/plugins/plugin.js'
import { segment } from "oicq";
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
        let url= `https://api.lolimi.cn/API/B_Update/?num=10`
        let res = await fetch(url).catch((err) => logger.error(err));
        if (!res) {
            logger.error('查询接口请求失败');
            return await this.reply('查询接口请求失败');
        }
        res = await res.json();
        logger.info(`请求结果：${res.text}`);
        if(res.text=="获取成功"){
            e.reply("呐呐呐来啦!(数据来源于bilibili，问就是没找到其他接口）");
            let MsgList = [];
            let msg=[]
            let j = res.data.length
            for (let i = 0 ;i<j;i++){
                MsgList.push({
                    type: "text",
                    message: ["标题:",res.data[i].Name,"\n国家:",res.data[i].Country,"\n集数:",res.data[i].Count,"\n直达链接:",res.data[i].Url,],
                    nickname: e.nickname,
                    user_id: e.user_id
                });
            }
            let forwardMsg
            if(!e.isGroup){
                forwardMsg = await e.friend.makeForwardMsg(MsgList);
            }
            else{
                forwardMsg = await e.group.makeForwardMsg(MsgList);
            }
            if(typeof forwardMsg.data!='string'){forwardMsg.data = JSON.stringify(forwardMsg.data)}
            forwardMsg.data = forwardMsg.data
                .replace(/\n/g, '')
                .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
                .replace(/___+/, `<title color="#777777" size="26">呐呐呐～</title>`)
            await e.reply(forwardMsg)
        }
    }
}