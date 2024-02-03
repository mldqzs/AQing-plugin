import plugin from '../../../lib/plugins/plugin.js'
import { segment } from "oicq";
import set from '../utils/setting.js';
import fs from 'node:fs';

let replayMsg = "阿晴已开启艾特禁言！";
let jy = false;

var muteTime = set.getConfig('config')?.muteTime;

let jyGroupList = [];

function addJyGroup(groupId) {
  jyGroupList.push(groupId);
}

function deleteJyGroup(groupId) {
  let index = jyGroupList.indexOf(groupId);
  if (index > -1) {
    jyGroupList.splice(index, 1);
  } else {
    console.log('没有找到要删除的群号');
  }
}

export default class example extends plugin {
    constructor() {
        super({
            name: "[阿晴插件]艾特机器人禁言",
            dsc: "艾特机器人禁言",
            event: "message",
            priority: -114514,
            rule: [
                {
                    reg: "",
                    fnc: "atjy",
                },
                {
                    reg: "^#设置被艾特禁言时间\\d+$",
                    fnc: "jytime",
                },
                {
                    reg: "#开启被艾特禁言",
                    fnc: "openjy",
                },
                {
                    reg: "#关闭被艾特禁言",
                    fnc: "closejy",
                },
                {
                    reg: "#查看艾特禁言群聊", 
                    fnc: "checkjy", 
                },
            ],
        });
    }
  async atjy(e) {
    if (!e.atBot || !jy || this.e.isMaster || !e.group.is_owner && !e.group.is_admin || e.member.is_owner || e.member.is_admin || !jyGroupList.includes(e.group_id)){
        return false;
    } else {
        await e.group.muteMember(e.user_id, muteTime*60);
        e.reply([segment.at(e.user_id), ` ${replayMsg}`]);
        await e.group.recallMsg(e.message_id);
        return true;
    }
  }

  async jytime(e) {
  let newnum = e.msg.replace(/^#设置被艾特禁言时间/g, '');
  let newREG = new RegExp('设置被艾特禁言时间\\d+$', 'g');
  if (newnum < 0 || newnum > 30) {
    e.reply(`参数不符合要求！(0<x<30)`);
    return true;
    }
    let setting = './plugins/AQing-plugin/config/config/config.yaml'
    let config = fs.readFileSync(setting, 'utf8')
    newREG = new RegExp('muteTime: \\d+','g')
    config = config.replace(newREG,'muteTime: ' + newnum)
    fs.writeFileSync(setting, config, 'utf8')
    muteTime = newnum;
  e.reply('被艾特禁言时间已设置为: ' + newnum + '分钟')
  return true;
}

  async openjy(e) {
    if (this.e.isMaster) {
      jy = true;
      addJyGroup(e.group_id);
      e.reply("已开启本群被艾特禁言功能，不许艾特我哦!");
      return true;
    } else {
      e.reply("你没有权限开启被艾特禁言功能");
      return false;
    }
  }

  async closejy(e) {
    if (this.e.isMaster) {
      jy = false;
      deleteJyGroup(e.group_id);
      e.reply("已关闭本群被艾特禁言功能");
      return true;
    } else {
      e.reply("你没有权限关闭被艾特禁言功能");
      return false;
    }
  }

  async checkjy(e) { 
    if (this.e.isMaster) { 
      if (jyGroupList.length > 0) { 
        let msg = "已经开启被艾特禁言的群聊有：\n"; 
        for (let group of jyGroupList) { 
          msg += `${group}\n`; 
        }
        e.reply(msg); 
        return true; 
      } else { 
        e.reply("没有开启被艾特禁言的群聊"); 
        return false;
      }
    } else { 
      e.reply("你没有权限查看被艾特禁言的群聊"); 
      return false;
    }
  }
}