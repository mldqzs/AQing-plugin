import plugin from '../../../lib/plugins/plugin.js'
import fetch from 'node-fetch'
import lodash from 'lodash'

const Textreply = '堂主giegie快来!';
//图片回复(填写图片链接或路径)
const imgreply = 'https://gchat.qpic.cn/gchatpic_new/0/0-0-1B4B129B83E9FBDFC7CF1ED40514F86C/0';
let ciku = ['就凭你也敢打扰堂主giegie？']
let muteMax = 300;//禁言分钟数上限
let muteMin = 1;//禁言分钟数下限
export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: 'AQ:召唤堂主',
            /** 功能描述 */
            dsc: '简单开发示例',
            /** https://oicqjs.github.io/oicq/#events */
            event: 'message',
            /** 优先级，数字越小等级越高 */
            priority: 5000,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: '^召唤堂主$',
                    /** 执行方法 */
                    fnc: 'zh'
                }
            ]
        })
    }

    async zh(e) {
        let who = e.user_id;
        let randomtime = Math.round(Math.random() * (muteMax - muteMin)) + muteMin;
        if (e.isMaster) {
            let msg = [
                Textreply ? Textreply : "",
                imgreply ? segment.image(imgreply) : "",
                segment.at(3239831427),
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