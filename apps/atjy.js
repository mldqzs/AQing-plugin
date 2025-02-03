import fs from 'node:fs';
import yaml from 'yaml';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 获取当前文件的目录路径
const currentFileURL = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFileURL);

// 获取配置文件路径
const configPath = join(currentDirectory, '../config/config/config.yaml');

// 从 config.yaml 中读取初始配置
let config = {};
try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  config = yaml.parse(configContent);
} catch (err) {
  console.error('读取配置文件失败:', err);
}
let jy = false;

// 确保 config.yaml 中包含 muteTime 和 jyGroupList
config.muteTime = config.muteTime || 5; // 默认禁言时间 5 分钟
config.jyGroupList = config.jyGroupList || []; // 默认为空数组

let muteTime = config.muteTime;
let jyGroupList = config.jyGroupList;

function saveConfig() {
  try {
    const configContent = yaml.stringify(config);
    fs.writeFileSync(configPath, configContent, 'utf8');
  } catch (err) {
    console.error('保存配置文件失败:', err);
  }
}

async function addJyGroup(groupId) {
  if (!jyGroupList.includes(groupId)) {
    jyGroupList.push(groupId);
    config.jyGroupList = jyGroupList;
    saveConfig();
  }
}

async function deleteJyGroup(groupId) {
  const index = jyGroupList.indexOf(groupId);
  if (index > -1) {
    jyGroupList.splice(index, 1);
    config.jyGroupList = jyGroupList;
    saveConfig();
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
        await e.group.muteMember(e.user_id, muteTime * 60);
        e.reply([segment.at(e.user_id), ` ${replayMsg}`]);
        await e.group.recallMsg(e.message_id);
        return true;
    }
  }

  async jytime(e) {
    let newnum = e.msg.replace(/^#设置被艾特禁言时间/g, '').trim();
    const newREG = new RegExp('^\\d+$');
    if (!newREG.test(newnum) || newnum < 0 || newnum > 30) {
      e.reply(`参数不符合要求！(0<x<30)`);
      return true;
    }
    config.muteTime = Number(newnum);
    muteTime = config.muteTime;
    saveConfig();
    e.reply('被艾特禁言时间已设置为: ' + newnum + '分钟');
    return true;
  }

  async openjy(e) {
    if (this.e.isMaster) {
      jy = true;
      await addJyGroup(e.group_id);
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
      await deleteJyGroup(e.group_id);
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