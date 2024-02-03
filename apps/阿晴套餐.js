import Yaml from '../Yaml/Yaml.js'
import lodash from "lodash"
import fs from "fs";
import plugin from '../../../lib/plugins/plugin.js';
//项目路径
let path = './plugins/AQing-plugin/config/config/config.yaml'
let cy = await Yaml.getread(path)
let botname = cy.botname
const _path = process.cwd();
let tx = {};
let kaiguan = {};

let muteMax = 43200;//禁言分钟数上限
let muteMin = 1;//禁言分钟数下限

//是否启用谁发谁禁言，否为0是为1
let tututu = 1;

export class kelitaocan extends plugin {
  constructor() {
    super({
      name: "阿晴套餐",
      dsc: "阿晴套餐",
      event: "message",
      priority: 600,
      rule: [
        {
          reg: `^来(套|个|份)^${botname}陪睡套餐$`,
          fnc: 'kelitaocan'
        }
      ],
    })
  }


  async kelitaocan(e) {
    if (e.isMaster) {
     e.reply(`好的，${botname}今晚回来找你睡觉。`);
    return;
    }
    if (!e.isGroup) {
      return true;
    }

    if (tx[e.group_id]) {
      Bot.pickGroup(e.group_id).muteMember(tx[e.group_id].user_id, 0);
    }

    let mmap = await e.group.getMemberMap();

    let arrMember = Array.from(mmap.values());

    let randomGay = arrMember[Math.round(Math.random() * (arrMember.length - 1))];
    let randomtime = Math.round(Math.random() * (muteMax - muteMin)) + muteMin;//改了这
    let name = randomGay.card;
    if (name.length == 0) {
      name = randomGay.nickname;
    }
    let who = randomGay.user_id;

    if (tututu) {
      who = e.user_id;
      name = e.sender.card;
      if (name.length == 0) {
        name = e.sender.nickname;
      }
    }
    e.group.muteMember(who, randomtime * 60);

    tx[e.group_id] = { user_id: who };

    e.reply(`嘿，你这小孩！ \n【${name}】 (${who})  \n恭喜你喜提${randomtime}分钟劳改套餐！`);
    return true; //返回true 阻挡消息不再往下
  }
}
