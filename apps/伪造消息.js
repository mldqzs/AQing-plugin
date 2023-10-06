import plugin from '../../../lib/plugins/plugin.js';
import cfg from '../../../lib/config/config.js'
import Yaml from '../Yaml/Yaml.js'
const _path = process.cwd();
let path = './plugins/AQing-plugin/config/config/bm.yaml'
const direction = "使用方法：\n一条消息的格式为【@一名群友+ta的发言内容】。可叠加多条消息，示例：\n" +
  "伪造消息@甲这是甲说的话@乙这是乙说的第一句话|这是乙说的第二句话@丙这是丙发送的图片\n" +
  "另外，@群友，可用|^qq号|代替\n可以在“伪造消息”命令后带可选参数：\n" +
  "^t大标题|、^s底部小字|、^p转发消息外显|、^b消息摘要1,消息摘要2或者^b消息摘要1\n消息摘要的逗号必须是英文输入(消息摘要最多显示4条消息),底部小字和摘要和外显修改仅在手q生效";


const dontRumorMaster = true;  //是true否false禁止造谣机器人主人。若禁止，试图造谣主人时会被警告


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
        }
      ]
    })
  }
    async Fakemessage(e) {
    let prompt = ''
    let brief = ''
    let title = ''
    let summary = ''
    let rawmsg = e.message;
    // 获取当前群配置
    let conf = cfg.getGroup(this.group_id);
    if (conf.onlyReplyAt && rawmsg[0].type == "at" && rawmsg[0].qq == cfg.qq) {
      rawmsg.splice(0, 1);
    }
    // 处理消息
    for (let val of conf.botAlias) {
      var regBotName = new RegExp(val + "#*＃*伪造消息");
      // rawmsg[0].text = rawmsg[0].text.replace(/#|＃|伪造消息/g, "");
      rawmsg[0].text = rawmsg[0].text.replace(regBotName, "");
    }
    rawmsg[0].text = rawmsg[0].text.replace(/#*＃*伪造消息/, "");
    console.log(rawmsg[0].text)

    let regExpQQ = /(\^|＾)\d{5,10}/g
    let regBrief = /(\^|＾)b.+/g
    let regPrompt = /(\^|＾)p.+/g
    let regTitle = /(\^|＾)t.+/g
    let regSummary = /(\^|＾)s.+/g

    // let resqq = regExpQQ.exec(rawmsg[0].text);
    let isqq = regExpQQ.test(rawmsg[0].text);
    console.log("isqq", isqq);

    if (!e.at && !isqq) {
      e.reply([segment.text(direction)]);//没有@则提示
      return true;
    }

    // 提取title.brief,summary
    for (let val of rawmsg[0].text.split("|")) {
      let smry
      let titl
      let brf
      let prom
      brf = val.match(regBrief)
      smry = val.match(regSummary)
      titl = val.match(regTitle)
      prom = val.match(regPrompt)
      if (brf) {
        brief = brf[0].substring(2)
        rawmsg[0].text = rawmsg[0].text.replace(`${brf}|`, "")
        let regex = /\[|\]/g  // 正则表达式模式，匹配 [ 或 ]
        brief = brief?.replace(regex, '')
        brief = brief.split(',').map(element => element.trim())
      }
      if (prom) {
        prompt = prom[0].substring(2)
        rawmsg[0].text = rawmsg[0].text.replace(`${prom}|`, "")
      }
      if (titl) {
        title = titl[0].substring(2)
        rawmsg[0].text = rawmsg[0].text.replace(`${titl}|`, "")
      }
      if (smry) {
        summary = smry[0].substring(2)
        rawmsg[0].text = rawmsg[0].text.replace(`${smry}|`, "")
      }
    }

    console.log("brf:", brief)
    console.log("prom:", prompt)
    console.log("smry:", summary)
    console.log("tit:", title)
    console.log(rawmsg)

    let qq = null
    let name = ""
    var data_msg = []//存放消息

    // 对e.message中的成员逐个处理：
    for (let i = 0; i < rawmsg.length; i++) {
      // console.log("qq:", qq)
      // 如果是at类型，就把其中的qq号和昵称取出来
      if (rawmsg[i].type == "at") {
        qq = rawmsg[i].qq;
        name = rawmsg[i].text.replace(/@/g, "");
        // 对qq做是否白名单、是否主人QQ的判定
        if (await this.checkMaster(e, qq)) {
          return true;
        }
        continue;
      }
      // 如果是text类型
      else if (rawmsg[i].type == "text") {
        if (rawmsg[i].text == "") {
          continue;
        }
        // 将其中的text用split分割成数组，逐一push进data_msg
        let txt = (rawmsg[i].text).trim().split("|");
        for (let val of txt) {
          let resqq = val.match(regExpQQ);
          if (resqq) {
            qq = resqq[0].substring(1) * 1;
            name = await this.getname(qq, e);
            // 对qq做是否白名单、是否主人QQ的判定
            if (await this.checkMaster(e, qq)) {
              return true;
            }
            continue;
          }
          if (!qq) {
            e.reply(direction);
            return true;
          }
          if (val != "") {
            data_msg.push({
              message: val,
              nickname: name,
              user_id: qq,
            });
          }
        }
      }
      // 如果是image类型，取其中的url，push进data_msg
      else if (rawmsg[i].type == "image") {
        data_msg.push({
          message: segment.image(rawmsg[i].url),
          nickname: name,
          user_id: qq
        });
      }
      else {
        console.log("【伪造消息】出现了预设之外的类型：", rawmsg[i].type);
      }
    }

    console.log("【data_msg】:", data_msg);

    if (data_msg == []) {
      e.reply([segment.text(direction)]);
      return true;
    }

    // 制作成合并消息
    let ForwardMsg;
    /** 制作转发内容 */
    if (this.e?.group?.makeForwardMsg) {
      ForwardMsg = await e.group.makeForwardMsg(data_msg);
    } else if (this.e?.friend?.makeForwardMsg) {
      ForwardMsg = await e.group.makeForwardMsg(data_msg);
    } else {
      return msg.join('\n')
    }
    /** 处理描述 */
    if (typeof (ForwardMsg.data) === 'object') {
      let detail = ForwardMsg.data?.meta?.detail
      if (detail) {
        detail.news = []
        if (Array.isArray(brief)) {
          brief.forEach(text => {
            detail.news.push({ text })
          })
        } else {
          detail.news = [{ text: brief !== '' ? brief : "聊天记录" }]
        }
        detail.source = title !== '' ? title : detail.source
        detail.summary = summary !== '' ? summary : detail.summary
      }
      if (ForwardMsg.data?.prompt) {
        ForwardMsg.data.prompt = `[${prompt !== '' ? prompt : "聊天记录"}]`
      }
      console.log(ForwardMsg.data.meta.detail.news)
    } else {
      // 置换合并转发中的特定文本
      let regExp = /<summary color=\"#808080\" size=\"26\">查看(\d+)条转发消息<\/summary>/g
      let res = regExp.exec(ForwardMsg.data)
      console.log(res)
      let pcs = res[1]

      let briefTitles = []

      if (Array.isArray(brief)) {
        brief.forEach((element) => {
          const title = `<title color="#777777" size="26">${element !== '' ? element : '聊天记录'}</title>`
          briefTitles.push(title)
        })
      } else {
        briefTitles = [`<title color="#777777" size="26">${brief !== '' ? brief : '聊天记录'}</title>`]
      }
      ForwardMsg.data = ForwardMsg.data.replace(/<msg brief="\[聊天记录\]"/g, `<msg brief=\"[${prompt !== '' ? prompt : "聊天记录"}]\"`)
        .replace(/<title color=\"#000000\" size=\"34\">转发的聊天记录<\/title>/g, `<title color="#000000" size="34">${title !== '' ? title : "群聊的聊天记录"}</title>`)
        .replace(/<summary color=\"#808080\" size=\"26\">查看(\d+)条转发消息<\/summary>/g, `<summary color="#808080" size="26">${summary !== '' ? summary : `查看${pcs}条转发消息`}</summary>`)
        .replace(/\n/g, '')
        .replace(/<title color="#777777" size="26">.*?<\/title>/g, '___')
        .replace(/___+/, briefTitles.join(''))
    }

    e.reply(ForwardMsg)//回复消息
    return true //返回true 阻挡消息不再往下
  }

  // 检测是否为主人或白名单qq 
    async checkMaster(e, qq) {
    let wst = await Yaml.getread(path)
    let muteTime = wst.禁言时间;
    let wlist = wst.白名单;//对wlist中的qq造谣时会收到警告
    if (
      !e.isMaster &&
      (wlist.includes(qq) || (dontRumorMaster && cfg.masterQQ.includes(qq)))
    ) {
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


    let G = e.message[0].text.replace(/#|伪造加白/g, "").trim()
    if(e.message[1]){
    let atItem = e.message.filter((item) => item.type === "at");
    G = atItem[0].qq;
    }else{ G = G.match(/[1-9]\d*/g) }
    if (!G) return e.reply(`请输入正确的QQ号！`)
    G = parseInt(G);
    let TA = G;

    let bm = await Yaml.getread(path)
    bm.白名单.push(TA);
    await Yaml.getwrite(path, bm);
    let msg = [segment.at(e.user_id), `已加入伪造消息白名单！`];
    await e.reply(msg)
    return true;
    }
} 