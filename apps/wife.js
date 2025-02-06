let map = await e.group.getMemberMap();
let arrMember = Array.from(map.values());
let randomWife = arrMember[Math.round(Math.random() * (arrMember.length - 1))];
let number = Math.ceil(Math.random() * 2);

export default class laopo extends plugin {
  constructor() {
    super({
      name: 'AQ: 随机老婆',
      dsc: '随机老婆',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^今日老婆$',
          fnc: 'todayWife',
        },
      ],
    });
  }

  async todayWife(e) {
    
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    const date_time = `${year}-${month}-${day}`;

    // 修复 Redis 数据获取部分
    let date_time2 = await redis.get(`Yunzai:jrlp:${e.user_id}_daka`);
    date_time2 = date_time2 ? JSON.parse(date_time2) : null;
    let date_time3 = await redis.get(`Yunzai:mylp:${e.user_id}_daka`);
    date_time3 = date_time3 ? JSON.parse(date_time3) : null;

    if (e.isMaster) {
      let msg = [
        segment.at(e.user_id),
        "\n主人主人！你的老婆在这哦:",
        segment.image(`https://q1.qlogo.cn/g?b=qq&s=0&nk=${randomWife.user_id}`),
        `【${randomWife.nickname}】 (${randomWife.user_id}) 嘻嘻~`
      ]
  
      e.reply(msg);
  
      return true;
    }

    if (date_time === date_time2) {
        let msg = [
            segment.at(e.user_id),
            `\n你还要几个老婆啊！你这个花心大萝卜！`
        ];
        e.reply(msg);
        return;
      } else if (date_time === date_time3) {
        let msg = [
            segment.at(e.user_id),
            `\n一天一次哦！明天再来吧！`
        ];
        e.reply(msg);
        return;
    }
    if (number > 1) {
      let msg = [
        segment.at(e.user_id),
        "\n今天你的老婆是",
        segment.image(`https://q1.qlogo.cn/g?b=qq&s=0&nk=${randomWife.user_id}`),
        `【${randomWife.nickname}】 (${randomWife.user_id}) \n要保护好TA哦！`
      ];

      e.reply(msg);
      // 修复 Redis 设置部分
      redis.set(`Yunzai:jrlp:${e.user_id}_daka`, JSON.stringify(date_time));
    } else {
      e.reply(`很遗憾，你没有老婆哦！`);
      // 修复 Redis 设置部分
      redis.set(`Yunzai:mylp:${e.user_id}_daka`, JSON.stringify(date_time));
    }
  }
}