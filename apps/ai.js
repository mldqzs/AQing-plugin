import plugin from '../../../lib/plugins/plugin.js'
import fs from 'node:fs';
import Y from '../Yaml/y.js'
const mst = new Y('./plugins/AQing-plugin/config/config/config.yaml')
const aiValue = mst.get('ai');


export default class example extends plugin {
  constructor() {
      super({
          name: "[阿晴插件]ai",
          dsc: "ai",
          event: "message",
          priority: -114514151,
          rule: [
              {
                  reg: "",
                  fnc: "ai",
              },
              {
                reg: "^#阿晴开启ai$",
                fnc: "kqai",
              },
              {
                reg: "^#阿晴关闭ai",
                 fnc: "gbai",
               },
              ]})
          }

          async ai(e){
            if (!e.atBot || !aiValue == true){
              return false;
            }
            else {
            let url= `https://api.mhimg.cn/api/gpt_aimaoniang/?prompt=${e.msg}`
            let res = await fetch(url).catch((err) => logger.error(err));
            if (!res) {
                logger.error('查询接口请求失败');
                return await this.reply('查询接口请求失败');
            }
            res = await res.text();
            logger.info(`请求结果：${res}`);
            await e.reply(`${res}`);
            }
          }
          async kqai(e) {
            if (this.e.isMaster) {
              mst.set('ai', true);
              e.reply("开启咯~要记得艾特阿晴哦");
              return true;
            } else {
              e.reply("你谁啊？");
              return false;
            }
          }
          async gbai(e) {
            if (this.e.isMaster) {
              mst.set('ai', false);
              e.reply("关闭啦QAQ");
              return true;
            } else {
              e.reply("你谁啊？");
              return false;
            }
          }
        }

