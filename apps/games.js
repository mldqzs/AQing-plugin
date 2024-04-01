import plugin from '../../../lib/plugins/plugin.js';
let dati = ""
let daan = ""

export class example extends plugin {
  constructor() {
      super({
          /** 功能名称 */
          name: 'AQ：游戏类',
          /** 功能描述 */
          dsc: '小游戏',
          /** https://oicqjs.github.io/oicq/#events */
          event: 'message',
          /** 优先级，数字越小等级越高 */
          priority: 4888,
          rule: [
              {
                  /** 命令正则匹配 */
                  reg: '^看图猜成语$',
                  /** 执行方法 */
                  fnc: 'kantu'
              },
              {
                  /** 命令正则匹配 */
                  reg: '^猜成语(.*)$',
                  /** 执行方法 */
                  fnc: 'wocai'
              },
              {
                /** 命令正则匹配 */
                reg: '^提示$',
                /** 执行方法 */
                fnc: 'tishi'
            },
            ]
          })
      }

    async kantu(e) {
        logger.info('[AQ：猜成语]', e.msg);
        let url= `https://xiaoapi.cn/API/game_ktccy.php?msg=开始游戏&id=${e.group_id}`
        let res = await fetch(url).catch((err) => logger.error(err));
        if (!res) {
            logger.error('接口请求失败');
            return await this.reply('接口请求失败');
        }
        if(e.msg == '看图猜成语'){
        res = await res.json();
        logger.info(`请求结果：${res.data.pic}`);
        let a = `${res.data.pic}`
        let msg = [`${res.data.msg}`, segment.image(a)]
        e.reply(msg)
        }
        dati = setTimeout(() => {
            e.reply(['很可惜没有人答对呢'])
            daan = res.data.answer
            e.reply(['正确答案是' + daan])
            console.log(daan)
            console.log()
          }
            , 60000);
        return true;
        }

       async tishi(e) {
        logger.info('[AQ：猜成语]', e.msg);
        let url= `https://xiaoapi.cn/API/game_ktccy.php?msg=提示&id=${e.group_id}`
        let res = await fetch(url).catch((err) => logger.error(err));
        if (!res) {
            logger.error('接口请求失败');
            return await this.reply('接口请求失败');
        }
        res = await res.json();
        e.reply(`${res.data.msg}`)
        return true;
        } 
        async wocai(e) {
        logger.info('[AQ：猜成语]', e.msg);
        let m = e.msg.replace("猜成语","").trim()
        m = m.split(" ")
        let url= `https://xiaoapi.cn/API/game_ktccy.php?msg=我猜${m}&id=${e.group_id}`
        let res = await fetch(url).catch((err) => logger.error(err));
        res = await res.json();
        if (res.data.msg === `不对呢，再来！`) {
            return await this.reply('猜错了哦，要不要试试提示？');
        }
        let msg = [`猜对了，这是给你的奖励哦`, segment.image(`https://api.lolimi.cn/API/tup/xjj.php`)]
        e.reply(msg)
        clearTimeout(dati)
        return true;
        }
    }