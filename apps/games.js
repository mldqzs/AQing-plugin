import plugin from '../../../lib/plugins/plugin.js';

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
            {
                /** 命令正则匹配 */
                reg: '^公布答案$',
                /** 执行方法 */
                fnc: 'kantu'
            },
            ]
          })
      }

    async kantu(e) {
        logger.info('[AQ：猜成语]', e.msg);
        let url= `https://xiaoapi.cn/API/game_ktccy.php?msg=开始游戏&id=3171419706`
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
         else if(e.msg == '公布答案'){
            logger.info('[AQ：猜成语]', e.msg);
            res = await res.json();
            e.reply(`${res.data.answer}`)
         }
        return true;
        }

       async tishi(e) {
        logger.info('[AQ：猜成语]', e.msg);
        let url= `https://xiaoapi.cn/API/game_ktccy.php?msg=提示&id=3171419706`
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
        let url= `https://xiaoapi.cn/API/game_ktccy.php?msg=我猜${m}&id=3171419706`
        let res = await fetch(url).catch((err) => logger.error(err));
        res = await res.json();
        if (res.data.msg === `不对呢，再来！`) {
            return await this.reply('猜错了哦，要不要试试提示？');
        }
        let a = `${res.data.pic}`
        let msg = [`你也太厉害了吧！${res.data.msg}`, segment.image(a)]
        e.reply(msg)
        return true;
        }
    }