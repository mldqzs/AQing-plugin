import plugin from '../../../lib/plugins/plugin.js'
import fetch from 'node-fetch'
import lodash from 'lodash'
import Y from '../Yaml/y.js'
const mst = new Y('./plugins/AQing-plugin/config/config/config.yaml')
const botname = mst.get('botname');
const Textreply = '如果......是主人的话.....';
//图片回复(填写图片链接或路径)
const imgreply = 'https://gchat.qpic.cn/gchatpic_new/0/0-0-BF870802BD8B09E2968F9F7634FA6513/0';
let ciku = ['牙签拿什么日？', '没感觉。。。细狗', '行不行阿。。细狗']
let muteMax = 60;//禁言分钟数上限
let muteMin = 1;//禁言分钟数下限
export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: '一言',
            /** 功能描述 */
            dsc: '简单开发示例',
            /** https://oicqjs.github.io/oicq/#events */
            event: 'message',
            /** 优先级，数字越小等级越高 */
            priority: 50,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: `^${botname}日日$`,
                    /** 执行方法 */
                    fnc: 'raq'
                }
            ]
        })
    }

    async raq(e) {
        let who = e.user_id;
        let randomtime = Math.round(Math.random() * (muteMax - muteMin)) + muteMin;
        if (e.isMaster) {
            let msg = [
                Textreply ? Textreply : "",
                imgreply ? segment.image(imgreply) : "",
            ]
            e.reply(msg)
            return;
        }
       
        else {
            this.reply(lodash.sample(ciku))
            await e.group.muteMember(who, randomtime * 60);
        }
        return true
    }
}
