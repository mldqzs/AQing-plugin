import fs from 'node:fs';
import yaml from 'yaml';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFileURL = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFileURL);

const configPath = join(currentDirectory, '../config/config/config.yaml');

// 带 mtime 的缓存：文件未变动时复用缓存，被锅巴/外部改写后自动重读，实现热加载
let _cache = null;
let _mtime = 0;

function getConfig() {
  try {
    const stat = fs.statSync(configPath);
    if (!_cache || stat.mtimeMs !== _mtime) {
      _cache = yaml.parse(fs.readFileSync(configPath, 'utf8')) || {};
      _mtime = stat.mtimeMs;
    }
  } catch (err) {
    console.error('读取配置文件失败:', err);
    _cache = _cache || {};
  }
  _cache.muteTime = _cache.muteTime ?? 5;
  _cache.jyGroupList = _cache.jyGroupList || [];
  return _cache;
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, yaml.stringify(config), 'utf8');
    _cache = config;
    _mtime = fs.statSync(configPath).mtimeMs;
  } catch (err) {
    console.error('保存配置文件失败:', err);
  }
}

function addJyGroup(groupId) {
  const config = getConfig();
  if (!config.jyGroupList.includes(groupId)) {
    config.jyGroupList.push(groupId);
    saveConfig(config);
  }
}

function deleteJyGroup(groupId) {
  const config = getConfig();
  const index = config.jyGroupList.indexOf(groupId);
  if (index > -1) {
    config.jyGroupList.splice(index, 1);
    saveConfig(config);
  } else {
    console.log('没有找到要删除的群号');
  }
}

export default class example extends plugin {
  constructor() {
    super({
      name: "AQ：艾特机器人禁言",
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
    const { muteTime, jyGroupList } = getConfig();
    // 按群判断，不再依赖全局标志
    if (!e.atBot || !jyGroupList.includes(e.group_id) || e.isMaster ||
        (!e.group.is_owner && !e.group.is_admin) ||
        e.member.is_owner || e.member.is_admin) {
      return false;
    }
    await e.group.muteMember(e.user_id, muteTime * 60);
    e.reply([segment.at(e.user_id), ' 不许艾特我哦！']);
    await e.group.recallMsg(e.message_id);
    return true;
  }

  async jytime(e) {
    let newnum = e.msg.replace(/^#设置被艾特禁言时间/g, '').trim();
    const newREG = new RegExp('^\\d+$');
    if (!newREG.test(newnum) || Number(newnum) <= 0 || Number(newnum) > 30) {
      e.reply('参数不符合要求！(0<x≤30)');
      return true;
    }
    const config = getConfig();
    config.muteTime = Number(newnum);
    saveConfig(config);
    e.reply('被艾特禁言时间已设置为: ' + newnum + '分钟');
    return true;
  }

  async openjy(e) {
    if (e.isMaster) {
      await addJyGroup(e.group_id);
      e.reply("已开启本群被艾特禁言功能，不许艾特我哦!");
      return true;
    } else {
      e.reply("你没有权限开启被艾特禁言功能");
      return false;
    }
  }

  async closejy(e) {
    if (e.isMaster) {
      await deleteJyGroup(e.group_id);
      e.reply("已关闭本群被艾特禁言功能");
      return true;
    } else {
      e.reply("你没有权限关闭被艾特禁言功能");
      return false;
    }
  }

  async checkjy(e) {
    if (e.isMaster) {
      const { jyGroupList } = getConfig();
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
