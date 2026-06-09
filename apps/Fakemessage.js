import plugin from '../../../lib/plugins/plugin.js';
import cfg from '../../../lib/config/config.js'
const _path = process.cwd();
import Y from '../Yaml/y.js'

const BM_PATH = './plugins/AQing-plugin/config/config/bm.yaml'

const direction = "使用方法：\n一条消息的格式为【@一名群友+ta的发言内容】。可叠加多条消息，示例：\n" +
  "伪造消息@甲这是甲说的话@乙这是乙说的第一句话|这是乙说的第二句话@丙这是丙发送的图片\n" +
  "\n名单管理（仅主人）：\n" +
  "#伪造加白xx / #伪造删白xx —— 白名单：不可被伪造（主人自动保护）\n" +
  "#伪造加黑xx / #伪造删黑xx —— 黑名单：禁止使用伪造功能\n" +
  "#伪造白名单 / #伪造黑名单 —— 查看名单"



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
              reg: "^#?伪造加白.*$",
              fnc: 'addWhite'
             },{
              reg: "^#?伪造删白.*$",
              fnc: 'delWhite'
             },{
              reg: "^#?伪造加黑.*$",
              fnc: 'addBlack'
             },{
              reg: "^#?伪造删黑.*$",
              fnc: 'delBlack'
             },{
              reg: "^#?伪造白名单$",
              fnc: 'listWhite'
             },{
              reg: "^#?伪造黑名单$",
              fnc: 'listBlack'
        }
      ]
    })
  }
  async Fakemessage(e) {
    // 黑名单：禁止使用伪造功能（主人不受限）
    if (!e.isMaster && this.inList('黑名单', e.user_id)) {
      e.reply([segment.at(e.user_id), ' 你已被禁止使用伪造消息功能'])
      return true
    }

    let prompt = '';
    let brief = [];
    let title = '';
    let summary = '';
    let rawmsg = e.message;

    // 获取当前群配置（注意 TRSS 签名为 getGroup(bot_id, group_id)）
    let conf = cfg.getGroup(e.self_id, e.group_id);

    // 去掉开头的 @机器人 / 回复引用，定位到真正的指令文本段
    while (rawmsg.length && rawmsg[0].type !== 'text') {
      if (rawmsg[0].type === 'at' && String(rawmsg[0].qq) === String(e.self_id)) {
        rawmsg.shift();
      } else if (rawmsg[0].type === 'reply') {
        rawmsg.shift();
      } else {
        break;
      }
    }

    // 第一段不是文本则无法解析指令
    if (!rawmsg.length || rawmsg[0].type !== 'text' || typeof rawmsg[0].text !== 'string') {
      e.reply([direction]);
      return true;
    }

    // 剥离机器人别名前缀及“伪造消息”指令前缀
    for (let val of (conf.botAlias || [])) {
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
        name = (rawmsg[i].text || "").replace(/@/g, "");
        if (!name) name = await this.getname(qq, e);
        if (await this.checkProtected(e, qq)) {
          return true;
        }
        continue;
      } else if (rawmsg[i].type === "text") {
        // 去空格后为空则跳过：剥离"伪造消息"前缀或 @ 前后常残留纯空格段，
        // 若按 === "" 判断会漏过空格段，导致 qq 尚未赋值就误回提示
        if (rawmsg[i].text.trim() === "") continue;
  
        let txt = rawmsg[i].text.trim().split("|");
        for (let val of txt) {
          let resqq = val.match(regExpQQ);
          if (resqq) {
            qq = resqq[0].substring(1);
            name = await this.getname(qq, e);
            if (await this.checkProtected(e, qq)) {
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
  
    // 优先走 NapCat/OneBotv11 原生 forward API：每个节点显式带 user_id/nickname，
    // 否则 NapCat 取不到发送者，会把整条转发回退成机器人自己
    if (await this.sendByApi(e, data_msg, { prompt, brief, title, summary })) return true;

    // 回退：旧的 makeForwardMsg 方式（非 OneBotv11 适配器时）
    return this.legacyReply(e, data_msg, { prompt, brief, title, summary });
  }

  // NapCat 原生发送：复用适配器 makeMsg 生成 content（保留图片下载兼容），
  // 但节点显式补 user_id/nickname，避免发送者回退成机器人。失败返回 false 走回退。
  async sendByApi(e, data_msg, { prompt, brief, title, summary }) {
    const bot = (typeof Bot !== "undefined" && Bot[e.self_id]) || e.bot;
    const adapter = bot?.adapter;
    if (!bot?.sendApi || adapter?.name !== "OneBotv11" || typeof adapter.makeMsg !== "function") {
      return false;
    }

    const isGroup = e.isGroup ?? !!e.group_id;
    try {
      const messages = [];
      for (const i of data_msg) {
        const [content] = await adapter.makeMsg(i.message);
        if (!content?.length) continue;
        const uid = String(Number(i.user_id) || 80000000);
        const name = i.nickname || "匿名消息";
        messages.push({
          type: "node",
          data: {
            user_id: uid,   // NapCat 读这两个字段决定发送者
            nickname: name,
            uin: uid,       // 兼容 go-cqhttp 老格式
            name,
            content,
          },
        });
      }
      if (!messages.length) return false;

      const payload = isGroup
        ? { group_id: e.group_id, messages }
        : { user_id: e.user_id, messages };

      // 仅在用户用 ^p/^t/^s/^b 显式指定时才覆盖外显/标题/底部/预览，否则用 NapCat 自然默认
      if (prompt) payload.prompt = prompt;
      if (title) payload.source = title;
      if (summary) payload.summary = summary;
      if (Array.isArray(brief) && brief.some(t => t !== "")) {
        payload.news = brief.filter(t => t !== "").map(text => ({ text }));
      }

      const action = isGroup ? "send_group_forward_msg" : "send_private_forward_msg";
      await bot.sendApi(action, payload);
      return true;
    } catch (err) {
      logger?.error?.(`[伪造消息] NapCat 原生发送失败，回退默认方式：${err}`);
      return false;
    }
  }

  // 旧的发送方式：依赖 e.group/e.friend.makeForwardMsg，用于非 NapCat 适配器
  async legacyReply(e, data_msg, { prompt, brief, title, summary }) {
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
    return true;
  }

  // 检测目标是否受保护（主人或白名单），受保护则禁言伪造者
  async checkProtected(e, qq) {
    const wst = new Y(BM_PATH);
    const muteTime = wst.get('禁言时间') || 5;

    const isMaster = cfg.masterQQ.map(String).includes(String(qq));
    const inWhite = wst.value('白名单', Number(qq)) || wst.value('白名单', String(qq));

    if (isMaster || inWhite) {
      e.reply([segment.at(e.user_id), isMaster ? ' 不可以伪造主人哦！' : ' 不可以这样！']);
      if (e.group?.muteMember) e.group.muteMember(e.user_id, muteTime * 60);
      return true;
    }
    return false;
  }

  // 判断 user_id 是否在指定名单（兼容数字/字符串）
  inList(listName, user_id) {
    const wst = new Y(BM_PATH);
    return !!(wst.value(listName, Number(user_id)) || wst.value(listName, String(user_id)));
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
  // 从指令中解析目标 user_id（优先 @，其次正则去除指令前缀）
  parseUserId(e, prefixReg) {
    let user_id = e.at || e.msg.replace(prefixReg, '').trim()
    return Number(user_id) || (user_id ? String(user_id) : null)
  }

  async addWhite(e) {
    if (!e.isMaster) { await e.reply('你也配？'); return false }
    const user_id = this.parseUserId(e, /#|伪造加白/g)
    if (!user_id) return e.reply('哎呀，你这样我不知道是谁了啦')
    const wst = new Y(BM_PATH)
    if (wst.value('白名单', user_id)) return e.reply('该用户已在白名单中')
    wst.addVal('白名单', user_id)
    return e.reply('已将该用户加入伪造消息白名单（不可被伪造）')
  }

  async delWhite(e) {
    if (!e.isMaster) { await e.reply('无权限'); return false }
    const user_id = this.parseUserId(e, /#|伪造删白/g)
    if (!user_id) return e.reply('哎呀，你这样我不知道是谁了啦')
    const wst = new Y(BM_PATH)
    if (!wst.value('白名单', user_id)) return e.reply('该用户不在白名单中')
    wst.delVal('白名单', user_id)
    return e.reply('已将该用户从伪造白名单中移除')
  }

  async addBlack(e) {
    if (!e.isMaster) { await e.reply('你也配？'); return false }
    const user_id = this.parseUserId(e, /#|伪造加黑/g)
    if (!user_id) return e.reply('哎呀，你这样我不知道是谁了啦')
    const wst = new Y(BM_PATH)
    if (wst.value('黑名单', user_id)) return e.reply('该用户已在黑名单中')
    wst.addVal('黑名单', user_id)
    return e.reply('已将该用户加入伪造消息黑名单（禁止使用伪造功能）')
  }

  async delBlack(e) {
    if (!e.isMaster) { await e.reply('无权限'); return false }
    const user_id = this.parseUserId(e, /#|伪造删黑/g)
    if (!user_id) return e.reply('哎呀，你这样我不知道是谁了啦')
    const wst = new Y(BM_PATH)
    if (!wst.value('黑名单', user_id)) return e.reply('该用户不在黑名单中')
    wst.delVal('黑名单', user_id)
    return e.reply('已将该用户从伪造黑名单中移除')
  }

  async listWhite(e) {
    if (!e.isMaster) { await e.reply('无权限'); return false }
    const list = new Y(BM_PATH).get('白名单') || []
    return e.reply(list.length ? `伪造白名单（不可被伪造）：\n${list.join('\n')}` : '白名单为空')
  }

  async listBlack(e) {
    if (!e.isMaster) { await e.reply('无权限'); return false }
    const list = new Y(BM_PATH).get('黑名单') || []
    return e.reply(list.length ? `伪造黑名单（禁止使用）：\n${list.join('\n')}` : '黑名单为空')
  }
}