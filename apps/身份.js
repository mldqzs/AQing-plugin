import plugin from '../../../lib/plugins/plugin.js';
import Yaml from '../Yaml/Yaml.js'
const _path = process.cwd();
let path = './plugins/AQing-plugin/config/config/config.yaml'
let cy = await Yaml.getread(path)
let botname = cy.botname
let 主人 = './config/config/other.yaml';
let m = await Yaml.getread(主人)
let mst = path
let u = await Yaml.getread(mst)

export class example extends plugin {
  constructor() {
      super({
          name: 'AQ:查身份',
          dsc: '查身份',
          event: 'message',
          priority: 5,
          rule: [
              {
                  /** 命令正则匹配 */
                  reg: '^#?(他|我)是谁.*\s*$',
                  /** 执行方法 */
                  fnc: 'cksf'
              }
          ]
      })
  }

  async cksf(e) {
    if (e.atBot) {
      let msg =[`滚出去！连我都不认识!`,segment.image(`https://api.lolimi.cn/API/si/?QQ=${e.user_id}`)]
      e.reply(msg)
      return false
   }
  else if (e.msg == '我是谁'){
    if (u.绝对主人?.includes(e.user_id)) {
   let msg = [`绝对主人！${botname}可是不会忘记的哦！嘿嘿~`,segment.image(`https://gchat.qpic.cn/gchatpic_new/0/0-0-01D0F147B25D3748DA55C82635FE52A4/0`)]
  e.reply(msg)
  return true
  }
  if (e.isMaster){
    let msg = [`你是${botname}的主人，要帮主人保护好${botname}哦！`,segment.image(`https://api.lolimi.cn/API/chaiq/c.php`)]
  await e.reply(msg)
  return true
}
  if (this.e.member.is_admin){
    e.reply(`你是这个群的管理员，不过${botname}有麻麻保护，不怕你！`)
    return trueid
  }
  if (this.e.member.is_owner){
    e.reply(`你是群主大大。${botname}要和你告状，刚刚有人欺负${botname}!`)
    return true
  }
  else {
    let msg = [`你就是个小卡拉米`,segment.image(`http://gchat.qpic.cn/gchatpic_new/0/0-0-69B7103C54C2C5CA445C5C214EC11AB2/0?term=2`)]
    e.reply(msg)
    return true
  }
}
  else { 
  let id = e.at
  let groupId = e.group_id
  const memberInfo = await Bot.getGroupMemberInfo(groupId, id);
  if (u.绝对主人?.includes(id)) {
    let msg = [`这是绝对主人，你不许欺负她哦！${botname}会盯着你哒！`,segment.image(`https://gchat.qpic.cn/gchatpic_new/0/0-0-3342AA8F1C10BE780788320262EB20DF/0`)]
    e.reply(msg)
    return true
  }
  if (m.masterQQ?.includes(id)){
    let msg = [`这是${botname}的主人捏`,segment.image(`https://api.lolimi.cn/API/face_worship/?QQ=${id}`)]
    await e.reply(msg)
    return true
  }
  if (memberInfo.role === 'admin'){
    e.reply(`他是这个群的管理员，不要惹他哦~`)
    return true
  }
  if (memberInfo.role === 'owner'){
    e.reply(`这是群主大大，很厉害的！不过在${botname}看来，麻麻更厉害！`)
    return true
  }else {
    let msg = [`这人就是个小卡拉米`,segment.image(`http://gchat.qpic.cn/gchatpic_new/0/0-0-69B7103C54C2C5CA445C5C214EC11AB2/0?term=2`)]
      e.reply(msg)
      return true
  }
   }
  }
}