export default class laopo extends plugin {
  constructor() {
    super({
      name: 'AQ: 每日老婆',
      dsc: '每日随机老婆并支持抢夺',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^今日老婆$',
          fnc: 'todayWife',
        },
        {
          reg: '^抢老婆(@\\d+)?$',
          fnc: 'grabWife',
        },
      ],
    });
  }

  // 获取格式化日期
  #getDate() {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }

  // 显示老婆信息
  async #showWife(e, uid) {
    const memberMap = await e.group.getMemberMap(); // 获取群成员 Map
    const member = memberMap.get(uid); // 使用 Map 的 get 方法
    if (!member) return false;

    const msg = [
      segment.at(e.user_id),
      "\n今日你的老婆是：",
      segment.image(`https://q1.qlogo.cn/g?b=qq&s=0&nk=${uid}`),
      `【${member.nickname}】(${uid})`,
      "\n要保护好TA哦！"
    ];
    e.reply(msg);
    return true;
  }

  // 今日老婆
  async todayWife(e) {
    const date = this.#getDate();
    const key = `Yunzai:jrlp:${e.user_id}`;

    // 尝试获取已存老婆
    let wifeData = await redis.get(key);
    if (wifeData) {
      wifeData = JSON.parse(wifeData);
      if (wifeData.date === date) {
        if (await this.#showWife(e, wifeData.wife)) return;
        // 老婆不在群则重新选择
      }
    }

    // 随机选择新老婆
    const memberMap = await e.group.getMemberMap(); // 获取群成员 Map
    const members = Array.from(memberMap.values()); // 转换为数组
    const filteredMembers = members.filter(m => m.user_id !== e.user_id); // 排除自己

    if (filteredMembers.length === 0) {
      return e.reply("你群都没人！");
    }

    const wife = filteredMembers[Math.floor(Math.random() * filteredMembers.length)]; // 随机选择一个成员
    await redis.set(key, JSON.stringify({
      date: date,
      wife: wife.user_id,
    }));

    this.#showWife(e, wife.user_id);
  }

  // 抢老婆
  async grabWife(e) {
  
    const date = this.#getDate();
    const key = `Yunzai:jrlp:${e.user_id}`;
    
    // 解析目标用户
    const target = e.message.filter(m => m.type === "at").find(m => m.qq);
    if (!target) return e.reply("抢空气？");
    const targetId = target.qq;
  
    if (targetId === e.user_id) {
      return e.reply("我勒个豆！自己ntr自己？", true);
    }
    
    // 检查是否已有老婆
    let myData = await redis.get(key);
    if (myData) {
      myData = JSON.parse(myData);
      if (myData.date === date) {
        return e.reply("你今天已经有老婆了，不能贪心哦！");
      }
    }
  
    // 获取目标的老婆
    const targetKey = `Yunzai:jrlp:${targetId}`;
    let targetData = await redis.get(targetKey);
    if (!targetData) {
      return e.reply("对方今天还没有老婆哦！");
    }
    targetData = JSON.parse(targetData);
  
    if (targetData.date !== date) {
      return e.reply("对方的老婆已经过期了");
    }
  
    // 检查老婆是否在群
    const memberMap = await e.group.getMemberMap(); // 获取群成员 Map
    const wifeMember = memberMap.get(targetData.wife); // 使用 Map 的 get 方法
    if (!wifeMember) {
      return e.reply("对方的老婆已经退群了");
    }
  
    // 抢夺成功率50%
    if (Math.random() < 0.3) {
      // 抢夺成功
      await redis.set(key, JSON.stringify({
        date: date,
        wife: targetData.wife,
      }));
      await redis.del(targetKey); // 原主人失去老婆
  
      e.reply([
        segment.at(e.user_id),
        ` 成功抢走了 `,
        segment.at(targetId),
        ` 的老婆！\n`,
        segment.image(`https://q1.qlogo.cn/g?b=qq&s=0&nk=${targetData.wife}`),
        `【${wifeMember.nickname}】现在属于你了！`,
      ]);
    } else {
      e.reply([
        segment.at(e.user_id),
        ` 抢夺失败，你被 `,
        segment.at(targetId),
        ` 反杀了！🤡👈`,
      ]);
    }
  }
}