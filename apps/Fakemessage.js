import plugin from '../../../lib/plugins/plugin.js';
import cfg from '../../../lib/config/config.js'
const _path = process.cwd();
import Y from '../Yaml/y.js'
const direction = "使用方法：\n一条消息的格式为【@一名群友+ta的发言内容】。可叠加多条消息，示例：\n" +
  "伪造消息@甲这是甲说的话@乙这是乙说的第一句话|这是乙说的第二句话@丙这是丙发送的图片\n#伪造加白xx 添加至白名单（不会被伪造）\n#伪造删白xx 删除白名单" 



//prompt //这个是在消息列表看到的消息摘要，可按需改动，例如改成“QQ红包”即可伪装成红包
//brief //转发消息未点开前的可以看到的几条消息
//title//【注意】经测试，此项必须以“的聊天记录”结尾，否则会有bug。这个是聊天窗口看到的合并转发消息的大标题，以及点开之后的顶部文本。
//summary //这个是聊天窗口看到的合并转发消息的底部描述，默认是“查看xx条”,置空则保持原内容不更改


export class Fakemessage extends plugin {
  constructor() {
      super({
          /** 功能名称 */
          name: 'AQ:伪造消息',
          /** 功能描述 */
          dsc: '伪造消息',
          /** https://oicqjs.github.io/oicq/#events */
          event: 'message',
          /** 优先级，数字越小等级越高 */
          priority: 5000,
          rule: [
              {
                  /** 命令正则匹配 */
                  // reg: "^#*伪造消息(.*)$", //匹配消息正则，命令正则
              reg: "^#*伪造消息([\\s\\S]*)$",  //匹配消息正则，命令正则
                  /** 执行方法 */
              fnc: 'Fakemessage'
              },{
            /** 命令正则匹配 */
              reg: "^#?伪造加白.*$",  //匹配消息正则，命令正则
            /** 执行方法 */
              fnc: 'jb'
             },{
            /** 命令正则匹配 */
              reg: "^#?伪造删白.*$",  //匹配消息正则，命令正则
            /** 执行方法 */
              fnc: 'sb'
        }
      ]
    })
  }
  async Fakemessage(e) {
    let prompt = '';
    let brief = [];
    let title = '';
    let summary = '';
    let rawmsg = e.message;
  
    // 获取当前群配置
    let conf = cfg.getGroup(this.group_id);
    if (conf.onlyReplyAt && rawmsg[0].type === 'at' && rawmsg[0].qq === cfg.qq) {
      rawmsg.splice(0, 1);
    }
  
    // 处理消息
    for (let val of conf.botAlias) {
      let regBotName = new RegExp(val + "#*＃*伪造消息");
      rawmsg[0].text = rawmsg[0].text.replace(regBotName, "");
    }
    rawmsg[0].text = rawmsg[0].text.replace(/#*＃*伪造消息/, "");
  
    console.log(rawmsg[0].text);
  
    let regExpQQ = /(\^|＾)\d{5,10}/g;
    let regBrief = /(\^|＾)b.+/g;
    let regPrompt = /(\^|＾)p.+/g;
    let regTitle = /(\^|＾)t.+/g;
    let regSummary = /(\^|＾)s.+/g;
  
    let isqq = regExpQQ.test(rawmsg[0].text);
    console.log("isqq", isqq);
  
    if (!e.at && !isqq) {
      e.reply([direction]); // 没有@则提示
      return true;
    }
  
    // 提取title.brief,summary
    for (let val of rawmsg[0].text.split("|")) {
      let smry, titl, brf, prom;
      brf = val.match(regBrief);
      smry = val.match(regSummary);
      titl = val.match(regTitle);
      prom = val.match(regPrompt);
  
      if (brf) {
        brief = brf[0].substring(2);
        brief = brief.replace(/\[|\]/g, '').split(',').map(element => element.trim()); // 提取[]内内容
        rawmsg[0].text = rawmsg[0].text.replace(`${brf[0]}|`, "");
      }
      if (prom) {
        prompt = prom[0].substring(2);
        rawmsg[0].text = rawmsg[0].text.replace(`${prom[0]}|`, "");
      }
      if (titl) {
        title = titl[0].substring(2);
        rawmsg[0].text = rawmsg[0].text.replace(`${titl[0]}|`, "");
      }
      if (smry) {
        summary = smry[0].substring(2);
        rawmsg[0].text = rawmsg[0].text.replace(`${smry[0]}|`, "");
      }
    }
  
    console.log("brf:", brief);
    console.log("prom:", prompt);
    console.log("smry:", summary);
    console.log("tit:", title);
    console.log(rawmsg);
  
    let qq = null;
    let name = "";
    let data_msg = []; // 存放消息
  
    // 对e.message中的成员逐个处理：
    for (let i = 0; i < rawmsg.length; i++) {
      if (rawmsg[i].type === "at") {
        qq = rawmsg[i].qq;
        name = rawmsg[i].text.replace(/@/g, "");
        if (await this.checkMaster(e, qq)) {
          return true;
        }
        continue;
      } else if (rawmsg[i].type === "text") {
        if (rawmsg[i].text === "") continue;
  
        let txt = rawmsg[i].text.trim().split("|");
        for (let val of txt) {
          let resqq = val.match(regExpQQ);
          if (resqq) {
            qq = resqq[0].substring(1);
            name = await this.getname(qq, e);
            if (await this.checkMaster(e, qq)) {
              return true;
            }
            continue;
          }
          if (!qq) {
            e.reply(direction);
            return true;
          }
          if (val !== "") {
            data_msg.push({
              message: val,
              nickname: name,
              user_id: qq,
            });
          }
        }
      } else if (rawmsg[i].type === "image") {
        data_msg.push({
          message: segment.image(rawmsg[i].url),
          nickname: name,
          user_id: qq,
        });
      } else {
        console.log("【伪造消息】出现了预设之外的类型：", rawmsg[i].type);
      }
    }
  
    console.log("【data_msg】:", data_msg);
  
    if (data_msg.length === 0) {
      e.reply([segment.text(direction)]);
      return true;
    }
  
    // 制作成合并消息
    let ForwardMsg;
    if (this.e.group && this.e.group.makeForwardMsg) {
      ForwardMsg = await this.e.group.makeForwardMsg(data_msg);
    } else if (this.e.friend && this.e.friend.makeForwardMsg) {
      ForwardMsg = await this.e.friend.makeForwardMsg(data_msg);
    } else {
      console.error("无法创建转发消息");
      e.reply("当前环境不支持伪造消息");
      return true;
    }
  
    // 处理描述
    if (typeof ForwardMsg.data === "object") {
      if (ForwardMsg.data.meta && ForwardMsg.data.meta.detail) {
        let detail = ForwardMsg.data.meta.detail;
        detail.news = [];
        if (Array.isArray(brief)) {
          brief.forEach((text) => {
            detail.news.push({ text });
          });
        } else {
          detail.news = [{ text: brief !== "" ? brief : "聊天记录" }];
        }
        detail.source = title !== "" ? title : detail.source;
        detail.summary = summary !== "" ? summary : detail.summary;
      }
      if (ForwardMsg.data.prompt) {
        ForwardMsg.data.prompt = `[${prompt !== "" ? prompt : "聊天记录"}]`;
      }
    } else {
      // 处理字符串类型的 ForwardMsg.data
      let regExp = /<summary color=\"#808080\" size=\"26\">查看(\d+)条转发消息<\/summary>/g;
      let res = regExp.exec(ForwardMsg.data);
      console.log(res);
  
      let pcs = res ? res[1] : 0;
  
      let briefTitles = [];
      if (Array.isArray(brief)) {
        brief.forEach((element) => {
          briefTitles.push(`<title color="#777777" size="26">${element !== "" ? element : "聊天记录"}</title>`);
        });
      } else {
        briefTitles = [`<title color="#777777" size="26">${brief !== "" ? brief : "聊天记录"}</title>`];
      }
  
      ForwardMsg.data = ForwardMsg.data.replace(/<msg brief="\[聊天记录\]"/g, `<msg brief=\"[${prompt !== "" ? prompt : "聊天记录"}]\"`)
        .replace(/<title color=\"#000000\" size=\"34\">转发的聊天记录<\/title>/g, `<title color="#000000" size="34">${title !== "" ? title : "群聊的聊天记录"}</title>`)
        .replace(/<summary color=\"#808080\" size=\"26\">查看(\d+)条转发消息<\/summary>/g, `<summary color="#808080" size="26">${summary !== "" ? summary : `查看${pcs}条转发消息`}</summary>`)
        .replace(/\n/g, '')
        .replace(/<title color="#777777" size="26">.*?<\/title>/g, '___')
        .replace(/___+/, briefTitles.join(''));
    }
  
    e.reply(ForwardMsg); // 回复消息
    return true; // 返回 true 阻挡消息不再往下
  }

  // 检测是否为主人或白名单qq 
  async checkMaster(e, qq) {
    const wst = new Y('./plugins/AQing-plugin/config/config/bm.yaml');
    const muteTime = wst.get('禁言时间');
  
    // 检查在白名单中
    if (wst.value('白名单', qq)) {
      e.reply([segment.at(e.user_id), "不可以这样！"]);
      e.group.muteMember(e.user_id, muteTime * 60);
      return true;
    }
    return false;
  }

  // 获取QQ的昵称
  async getname(qq, e) {
    // console.log("-----getname------")
    let name;
    if (e.isGroup) {
      try {
        let member = await Bot.getGroupMemberInfo(e.group_id, qq);
        // console.log("0000000", member)
        name = member.card ? member.card : member.nickname;
        // console.log("111111", name)
      } catch { }
      if (typeof (name) == 'undefined' || name == 'undefined' || name == '') {
        try {
          let response = await Bot.getStrangerInfo(qq)
          name = response.nickname
        } catch {
          name = qq;
        }
      }
    } else {
      try {
        let response = await Bot.getStrangerInfo(qq)
        name = response.nickname
      } catch {
        name = qq;
      }
    }
    return name;
  }
  async jb(e) {
      if (!e.isMaster) {
          await e.reply('你也配？')
        return false
    }


    let user_id = e.at || e.msg.replace(/#|伪造加白/g, '')
    user_id = Number(user_id) || String(user_id)

    if (!user_id) return await e.reply('哎呀，你这样我不知道是谁了啦')
    const cfg = new Y('./plugins/AQing-plugin/config/config/bm.yaml')
    if (!cfg.value('白名单', user_id))
    cfg.addVal('白名单', user_id)
    return await e.reply(['已将该用户加入伪造消息白名单'])
}
async sb(e) {
      if (!e.isMaster) {
          await e.reply('无权限')
        return false
    }

    let user_id = e.at || e.msg.replace(/#|伪造删白/g, '')
    user_id = Number(user_id) || String(user_id)

    if (!user_id) return await e.reply('哎呀，你这样我不知道是谁了啦')
    const cfg = new Y('./plugins/AQing-plugin/config/config/bm.yaml')
    if (!cfg.value('白名单', user_id)) 
    cfg.delVal('白名单', user_id)
    return await e.reply(['已将该用户从伪造白名单中移除'])
}
} 