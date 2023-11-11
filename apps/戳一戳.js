import plugin from '../../../lib/plugins/plugin.js';
import cfg from '../../../lib/config/config.js'
import Yaml from '../Yaml/Yaml.js'
import moment from 'moment'
const _path = process.cwd();
let path = './plugins/AQing-plugin/config/config/config.yaml'
let cy = await Yaml.getread(path)
let botname = cy.botname
let reply_text = cy.text //文字概率
let reply_img = cy.img //图片概率
let reply_voice = cy.voice //语音概率
let mutepick = cy.mu //禁言概率
let example = cy.ex //表情概率
let GroupList = cy.戳一戳群
let cyc = cy.戳一戳
let 主人 = './config/config/other.yaml';
let data=await Yaml.getread(主人)
let masterQQ = data.masterQQ

//戳主人
let img_1 = `https://gchat.qpic.cn/gchatpic_new/0/0-0-3342AA8F1C10BE780788320262EB20DF/0`
let img_2 = `https://gchat.qpic.cn/gchatpic_new/0/0-0-228D9236822AE031774CB1B6F335A64C/0`
let img_3 = `https://gchat.qpic.cn/gchatpic_new/0/0-0-49F4EB19B8DA489EAC52B41FD7C47FA9/0`
let img_4 = `https://gchat.qpic.cn/gchatpic_new/0/0-0-ED42AEB4E0EAF7931B2DA661150EA347/0`
let img_5 = `https://gchat.qpic.cn/gchatpic_new/0/0-0-BC03789032045BC27B6364862A334B1C/0`
let img_6 = `https://gchat.qpic.cn/gchatpic_new/0/0-0-35E814BF9147BE0B1DF6783EE5680A9D/0`
let img_7 = `https://gchat.qpic.cn/gchatpic_new/0/0-0-9C93DC7BFADC359932C53284C443BD0B/0`
let img_8 = `https://gchat.qpic.cn/gchatpic_new/0/0-0-E88AA9A513AC5D92A107CC4444182AD2/0`
let img_9 = `https://gchat.qpic.cn/gchatpic_new/0/0-0-D2F28C6F2ECDE91CE5562983347687AC/0`
let img_10 = `https://gchat.qpic.cn/gchatpic_new/0/0-0-EC43223C4AD8BF0DA65D9B2637387C12/0`
let img_11 = `https://gchat.qpic.cn/gchatpic_new/0/0-0-E52FB13D638DB1AC8136F9EA56328DB0/0`

//戳人🐔
let word_list = ['你干嘛~',
'别戳我了，去戳主人吧',
'主人有坏淫欺负我',
'呜呜呜你欺负我',
'请，请轻一点，我会痛的......',
'请不要戳我啦~',
'你、你不要这么用力嘛！戳疼我了呜呜呜~~~',
'变态萝莉控！',
'要戳坏掉了>_<',
'不可以戳戳>_<',
'不要戳了，再戳就坏掉啦>_<',
'连个可爱小萝莉都要戳的肥宅真恶心啊',
'你只需看着别人精彩，老天对你另有安排',
'舰长补给全保底.舰长副本零掉落.\n舰长深渊要掉级.舰长战场没暴击.\n舰长补给抽不起.舰长副本打不过.\n舰长深渊打不过.舰长战场没积分.\n舰长委托没体力.舰长补给没水晶.\n舰长身材像符华.舰长智商琪亚娜.\n舰长身高德丽莎.舰长童年似板鸭.\n舰长爱情像奥托.帽子长戴不用脱',
'不准戳',
'你行不行啊细狗',
'可以不要戳了吗你好烦啊变态~变态',
'戳一次抽卡吃满保底一次嘻嘻',
'再戳给你抓到往生堂当rbq😡',
'你这个变态，大变态，超级变态！不要在碰我了！',
'时间在走，很多事都在慢慢接受\n生活总会遇见惊喜的，慢慢期待',
'你会一直记得我吗',
'囊哒哟~',
'我怕疼...轻一点哦~',
'全都看见喽~',
'唉？怎么了吗',
'不要再欺负我辣！',
'你这个人傻fufu的。',
'呜呜呜，那里，好热...',
'不要戳戳，肚肚要大大了，呜呜呜',
'不可以戳戳>_<',
'不可以，要怀上了～',
'唔，这触感有种被兰那罗拿胡萝卜指着的感觉≥﹏≤',
'再戳头上要长出蘑菇啦~',
'你怎么可以这样，那里真的不可以啦，会坏掉的……',
'你要是再戳我！！！我就打你咯~',
'不要一天天的只知道戳我啊！！',
'喵喵喵，戳我干嘛~',
'可恶，要把你怎么样才不会戳我啊',
'不要戳我啦，呜呜呜～',
'我懂了你想对我发情是吧',
'坏蛋呜呜呜～',
'你怎么又戳我，气气！',
'坏...坏掉了...',
'请...请不要戳那里...',
'再戳我就要坏掉了啊~',
'气气！',
'再戳我你就是笨比<( ￣^￣)',
'你老是欺负我，我要告诉主人去！',
'你是不是喜欢我？',
'呜呜呜要被戳坏了...',
'呜啊我真的要被你气死了！',
'你轻一点哦，老是欺负我，我告诉主人去',
'达咩呦，你把我弄疼了~',
'好..好吧，可以是可以，但是要轻一点。',
'再戳我要跟主人告状的！哼~',
'啊，好痛啊...',
'要被戳坏惹QAQ',
'要坏掉惹呜呜呜',
'啊...温柔一点...把我戳疼辣..',
'啊，你好讨厌。',
'被戳晕了……轻一点啦！',
'消灭主c暴政，世界属于种门！',
'要，，，要坏掉了',
'主人，他欺负我呜呜呜',
'旅行者抽卡没石头，旅行者深渊打不过，旅行者副本掉最少',
'一边去，别戳我。',
'别再戳我啦！疼~',
'好疼请不要戳我~>_<~',
'请不要戳我~>_<~',
'啊～嗯～好痛啊……',
'好疼',
'不许再欺负我辣！！！',
'可不可以不要再戳我了',
'你就只会戳我嘛',
'不要再戳了！我很生气！！！',
'我世界宇宙无敌第一可爱！！！！',
'QAQ这个人欺负我',
'你轻一点哦~',
'嗷呜~~≧▽≦',
'要干嘛？',
'那里...不可以...',
'我要开始爆粗口了！！！',
'我跟主人告状去了，呜呜呜...',
'呜啊，我要给你起个难听的绰号！',
'呜啊，我要给你起个难听的绰号！叫什么呢，就叫大保底人吧！',
'你喜欢我吗？呜啊，人家那么可爱，不喜欢嘛，呜呜呜...',
'你喜欢我吗，嗯哼！我给你卖个萌(›´ω`‹ )',
'好吧，就限这一次，不能再戳啦！>_<',
'我要生气啦',
'我真的要生气啦',
'你个大坏蛋就知道欺负我',
'这里有个坏蛋就知道欺负我！！',
'不可以，不可以，不可以！戳疼了！',
'这里有个坏蛋就知道欺负我！！',
'要戳坏掉了>_<，呜呜呜',
'是不是要我揍你一顿才开心啊！！！',
'这可是很失礼的',
'哼！这个仇，我记下了！',
'不可以！会怀上的！',
'ヾ(≧へ≦)〃',
'都怪你呜呜呜怀上了',
'“我们刚刚拯救了世界树对吗，可是为什么，我好像在哭呢...”',
'“紫红色的帕蒂莎兰盛开在空空的王座上，仿佛女主人永恒的笑容…”',
'变态那里不可以的了',
'你是千万星辰中的一颗，对我而言却是整个世界。',
'嘿嘿，还是很开心你愿意陪我玩，毕竟绝云顶空旷又无人',
'哼，就知道戳~',
'啧啧',
'阿巴阿巴',
'我生气啦',
'你个变态！大变态不要再戳我了',
'不许碰我了！',
')你走开，那种事情不可以的啦',
'你个变态，大变态，超级变态！不要再碰我啦!',
'啊……你戳疼我了Ծ‸Ծ',
'你戳谁呢！你戳谁呢！！o(´^｀)o',
'变态！达咩哟',
'你要是在戳我！！我~我就打你哼',
'变态！不可以戳那里的！',
'你怎么又戳我，气气！',
'达咩！',
'气气，哼！',
'别戳了可以嘛',
'为什么戳我o(´^｀)o',
'说了不要戳了！',
'就知道戳我有没有意思啊！',
'还戳？',
'是不是要让最可爱的我揍你一顿才开心啊！！！',
'滚啊ヾ(≧へ≦)〃',
'别戳啦！！！',
'你好烦，不要戳我啦',
'把嘴张开（抬起脚）...想p呢！',
'是不是要让我揍你一顿才开心啊！！！',
'嗷呜~~~~~',
'要我给你暖被窝吗~哎嘿~想屁吃 ',
'今天想吃枣椰蜜糖！给我买嘛~',
'你带来新的故事吗？我用亲手做的枣椰蜜糖与你交换',
'呜哇！主人救命！',
'再喜欢我也不能这样戳啦，真的会坏掉的笨蛋!'];

//语音
let voice_list = ["https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/4d9feb71760c5e8eb5f6c700df12fa0c_6824265537002152805.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/c9e517b38d68161fb74cfa0b4349cc65_4347861218592112317.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/c3c7e9debabb94e3727336c4ce96afeb_224389990055717799.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/8a3db4b5fbdc4b20213a6f7339782015_4928929162694702539.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/991bdd5a3cbc3d4c6f3d9fb6e7b820cd_5388252366411848285.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/207cb052df963f3dcf54fc020d19e419_4430928199053665394.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/7832e76193d1097de2ff80337b6f5e66_3236404328533189135.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/a7400070efbfddd3e3b0e51ab5bd416e_2613139511899834526.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/ab080a46b594bbea4b8b6b102b57ca52_4873007682934420446.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/fc230f074229f92b1dc53f0e2912c1ef_1475816756907451157.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/d3536f987165303f9cec049968aee8e8_448052117450978550.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/f8dd1a21bd89bfb2fbeafc41a6e6105b_2464061296080033511.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/045279c37eabf825a3ead02cd7f63201_2864513860075272994.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/301a47bae0994cdb3c760ef12e89e8dd_5268233442388273437.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/edcfe93b22d3740491bb9faae1af4fa4_7131208721654597216.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/9945b7d5018f0f9ec85a795404d71578_6482272657391702471.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/9e95f2369323fdd2b3f1263c2c166c6f_1762500052641269578.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/cefd8ce810abfd78c6138bb4a5495a4f_3406507472490730277.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/7177d5d7c9e6bceea17dfa19246a8311_947270987568402613.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/3dc9d80439bf04c025d6b2fc3ef65690_8740168104152480190.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/705ad5d58037b7ede9c375b79e136db5_5484548306134050243.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/a03d821bfe14fe67be85a63f2e4b2ea8_8723240068787191136.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/cf45c3b44b9b0ef5f4a7b25376895f1e_3211550444048016001.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/33367d47ecae0d6ad4cf5d08ce310749_5860058669268042217.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/9f3f251b63bc4ecbae0c459c86728645_6727447996337295219.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/6914a5800526fc5d1fe280c4e7da2ba6_4711627706989616356.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/6bcb97d5c63275be4df00507d1a5e738_7884988217586192652.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/cf144a233e0971ef0176a0794ee45ecb_8925036841630699252.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/118487fde490b4eb60fbf1b061eabf60_7337639419392007909.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/cd7c3d1a69ab87ca2339e6d2d947073a_4052119550327167358.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/b4301d67ff0b9b8ed5f20f8677548490_7133441774208169621.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/38413f05cc7dc3fcd4f9940565701921_1980759413293826277.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/99540436483aacba2d3ce1930554b79a_3245245943114192654.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/c070cfee21a5b2155d35c78c714c62a0_6654082250841516882.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/a5a1b0b56ee4ce1f2a8fd8f0da780477_5778202358371881056.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/a92b16367b39d6533e15d5be368877fa_609355584691653441.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/42cfc993aedbd34011dfb507d98ebc06_1021613602285924429.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/b7f9bd671e5f663e2468fae6d70e8fc7_4321126464476483388.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/b48a9ca50c160247f092d1c94e895779_5468104429965887517.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/0af43c60e3618ab87754455ae898aa5f_7139785141669538993.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/8ae62e175ce0bce2fd154e1b97b6fa63_7159626485468514250.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/1c2429b34597c975d0463798b632e507_2104120770632135635.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/6472b7b374d3f1b2c853bae4ff9d8b26_6402755683915596310.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/6ea026eb2691f06e5c972320178ae537_6325311739293565017.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/67a95b896924cc53b283fc06cd2de52c_6914840829824874357.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/29b267cc6748c7a0d4d465d5e333dea5_3065502828430227261.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/3514888ba1f2d3f06bbc226451ec129d_221575416949828224.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/30b19865c6d20be04366ac742e8a67b9_3786598944525696408.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/ccb495a319c34444adbcef7aa155cb1f_2757660068721522026.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/349d2de21774da45c1e97745b365ee1f_4992449842647632459.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/830ee05eba1aacc607dff41e51516f5e_4807239196801935478.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/06a6fda8919bfef6bfff5199c437d032_2713778252536393556.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/d1919304f637ea8dc455dc92afe2ff6e_1431902895779023323.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/1f7eaf7451f9cfcbd3e8cd844b28b17e_6176061356688600031.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/df32f2eab30a7f5879c4606dc09a0502_3078148866148088063.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/e61ce14dd018af855e212944c3a86e07_6946138339125005920.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/6c346a693c656f3f116d3d428b8b3438_3072149138534909048.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/11c664bd848770184eca5dfd66e89c51_5444646554291536369.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/cccd5f5057045c12d8fdde98d4b4116a_7845851735624884706.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/1ee24a163e78f8885ed81a0b47b8cae7_6346729070751566019.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/1943b45de93aa4ecf3c2bc50e2c37072_5570205242708460822.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/af2ad8de369553cbd7b1c1ecf78b241c_4350686237074109248.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/228f1ae88824bbbdc4f0e96b02b93df2_3172196917569681075.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/8931896ce03ab4d2724ff861a5eb14fe_59418760023336306.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/fbc208b80518b91634964ba0783b0f9c_7720219259750270894.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/d02246a2fff6395411f7a1077191725c_3194055208944981775.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/24ad23ef5fde4fead48b52e4492562a8_8054702825063625720.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/f876c09d556b23b9231e9df8d39be246_4572440346090611863.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/b84885f5b6a2ebd7bc377984b641ea80_1270250062214132580.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/d9f3e353f1b71d3c601cfa28f15e8ed5_1074679710559344807.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/803a65c8cb872ec0e0038ff35db35cc4_2447311778799308880.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/f5b6ddb7454cbb750e6c02d258c3e03d_8129408147390523371.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/ddf937ea4aac1282901270ba491ece88_986083904906531255.mp3",
    "https://uploadstatic.mihoyo.com/ys-obc/2022/11/02/16576950/f514abfbe4a9358e96038850d6d64742_5784748521077424357.mp3"]
    
    
//反🐔
let fanji=['你刚刚戳我了是不是，我要超回去！',
'反击！戳戳你这个大坏蛋！',
'反击！戳戳你这个小笨蛋！',
'反击~',
'你要是再戳我！！！我就打你咯~',
'你戳谁呢！你戳谁呢！！o(´^｀)o',
'你怎么又戳我，气气！',
'不要再欺负我了，我要戳回去！',
'你个大坏蛋就知道欺负我，哼',
'喵？喵！喵喵！！！≧▽≦',
'呜啊，你把我戳痛了！我要戳回去！',
'戳戳你这个大坏蛋～～',
'送你回礼，嘿嘿~',
'等下你会有点痛哦~',
'嘿~！',
'ヾ(≧へ≦)〃',
'盲猜你刚刚戳我了是不是！',
'你就只会戳我嘛，哼',
'就你会戳！≧▽≦≧▽≦',
'快说快说我可爱嘛我可爱嘛！>_<',
'你刚刚是不是戳我了，你是坏蛋！我要戳回去，哼！！！',
'我生气啦',
'休息一下吧，比如..痛痛快快去上个厕所什么的',
'诶，这是什么，点一下',
'诶，这个功能有意思，点一下',
'淫趴重点照顾你！',
'在打胶吗，我给你送纸来了',
'戳戳你这个小笨蛋～～～'];


//禁言
let jinyan=['我生气啦！',
'哼，就知道戳~',
'啧啧',
'诶，这是什么，点一下',
'诶，这个功能有意思，点一下',
'阿巴阿巴',
'我生气啦',
'休息一下吧',
'我也是有脾气的！',
'应该戳累了吧',
'你个变态！大变态不要再戳我了',
'不许碰我了！',
')你走开，那种事情不可以的啦',
'你戳谁呢！你戳谁呢！！！',
'你个变态，大变态，超级变态！不要在碰我啦!',
'啊……你戳疼我了Ծ‸Ծ',
'你戳谁呢！你戳谁呢！！o(´^｀)o',
'变态！达咩哟',
'变态！不可以戳那里的！',
'你怎么又戳我，气气！',
'我生气了！砸挖撸多！木大！木大木大！',
'气气，哼！',
'别戳了可以嘛',
'为什么戳我o(´^｀)o',
'说了不要戳了！',
'就知道戳我有没有意思啊！',
'还戳？',
'是不是要让最可爱的我揍你一顿才开心啊！！！',
'是不是要爷揍你一顿才开心啊！！！',
'ヾ(≧へ≦)〃',
'别戳啦！！！',
'你好烦，不要戳我啦',
'别以为我不会反抗的~',
'不！！准！！戳！！',
'我可不是好欺负的！',
'诶嘿~',
'喵喵？喵！',
'我什么都不知道哦~',
'戳我？进小黑屋吧(/≧▽≦)/~┴┴',
'是不是要让我揍你一顿才开心啊！！！'];

export class chuo extends plugin {
    constructor() {
        super({
            name: 'AQ:戳一戳',
            dsc: '戳一戳',
            event: 'notice.group.poke',
            priority: -1145,
            rule: [
                {  
                    reg: '.*',                                      
                    fnc: 'chuoyichuo'
                                       
                }
            ]
        }
        )
    }

            
        async chuoyichuo(e) {
          if (cyc !== true|| !GroupList.includes(e.group_id)){
            return false;
           } else{
        if (e.target_id == cfg.qq) {
        let random_type = Math.random()
            if (random_type < reply_text) {            
                let text_number = Math.ceil(Math.random() * word_list['length'])
                await e.reply(word_list[text_number - 1])  
                 return true         
        }
          //图片
            else if (random_type < (reply_text + reply_img)) {
                let mutetype = Math.ceil(Math.random() * 6)
                if (mutetype == 1) {
                let url = ` http://api.yujn.cn/api/ys.php?`;
                let res = await fetch(url).catch((err) => logger.error(err));
                let msg = [segment.image(res.url)];
                await e.reply('你戳的我有点开心奖励你哦')
                await common.sleep(100)
                await e.reply(msg);
                return true
            }
           else if (mutetype == 2) {
                let url = `https://sex.nyan.xyz/api/v2/img?&num=1`;
                let res = await fetch(url).catch((err) => logger.error(err));
                let msg = [segment.image(res.url)];
                await e.reply('别戳了，我给你一张涩图，但是不可以对着屏幕做奇怪的事哦')
                await common.sleep(100)
                await e.reply(msg);
                return true
           }
           else if (mutetype == 3) {
                let url = `https://moe.anosu.top/img`;
                let res = await fetch(url).catch((err) => logger.error(err));
                let msg = [segment.image(res.url)];
                await e.reply('给你一张图片别戳了')
                await common.sleep(100)
                await e.reply(msg);
                return true
           }
            else if (mutetype == 4) {
                let url = `https://t.mwm.moe/ycy`;
                let res = await fetch(url).catch((err) => logger.error(err));
                let msg = [segment.image(res.url)];
                await e.reply('给你一张图片别戳了')
                await common.sleep(100)
                await e.reply(msg);
                return true
           }
           else if (mutetype == 5) {
                let url = `https://moe.jitsu.top/img/?sort=furry`;
                let res = await fetch(url).catch((err) => logger.error(err));
                let msg = [segment.image(res.url)];
                await e.reply('芝士，与你分享(˃ ⌑ ˂ഃ )')
                await common.sleep(100)
                await e.reply(msg);
                return true
           }           
           else if (mutetype == 6) {
                let url = `https://api.lolimi.cn/API/yuan/?type=image`;
                let res = await fetch(url).catch((err) => logger.error(err));
                let msg = [segment.image(res.url)];
                await e.reply('你戳的我有点开心奖励你哦')
                await common.sleep(100)
                await e.reply(msg);
                return true
           }
           else if (mutetype == 7) {
                let url = `https://moe.jitsu.top/img/?sort=silver`;
                let res = await fetch(url).catch((err) => logger.error(err));
                let msg = [segment.image(res.url)];
                await e.reply('芝士，与你分享(˃ ⌑ ˂ഃ )')
                await common.sleep(100)
                await e.reply(msg);
                return true
           }
    }
           //语音
            else if (random_type < (reply_text + reply_img + reply_voice)) {
                let voice_number = Math.ceil(Math.random() * word_list['length'])
                let url = voice_list[voice_number - 1]
                await e.reply(segment.record(url))
            }
           /*  
            //本地语音
            else if(random_type < (reply_text + reply_img + reply_voice)){
            
            let voice_number = Math.ceil(Math.random() * (wav_number))
            
            if(voice_number<=wav_number){
                e.reply(segment.record(chuo_path + voice_number + '.wav'))
        }
   }
        */
           //禁言
            else if (random_type < (reply_text + reply_img + reply_voice + mutepick)) {
                let usrinfo = await Bot.getGroupMemberInfo(e.group_id, e.operator_id)
                let botinfo = await Bot.getGroupMemberInfo(e.group_id, Bot.uin)
                let role = ['owner', 'admin']
                if (!cfg.masterQQ.includes(e.operator_id)) {
                    if((role.includes(botinfo.role) && !role.includes(usrinfo.role)) || (botinfo.role == 'owner' && usrinfo.role == 'admin')){
                        let mutetype = Math.ceil(Math.random() * 7)
                        if (mutetype == 1) {
                            await e.reply('是不是要我揍你一顿才开心啊！！！')
                            await common.sleep(100)
                            await e.group.muteMember(e.operator_id, 300);
                            await common.sleep(100)
                            await e.reply('哼！')
                        }
                        else if (mutetype == 2) {
                            await e.reply('不！！')
                            await common.sleep(10);
                            await e.reply('准！！')
                            await common.sleep(10);
                            await e.reply('戳！！');
                            await common.sleep(10);
                            await e.group.muteMember(e.operator_id, 120)
                            await common.sleep(50)
                            await e.reply('让你面壁思过2分钟，哼╯^╰')
                        }
                        else if (mutetype == 3) {
                            await e.reply('要怎么样才能让你不戳我啊!')
                            await common.sleep(100)
                            await e.group.muteMember(e.operator_id, 600);
                            await common.sleep(100)
                            await e.reply('大变态！')
                        }
                        else if (mutetype == 4) {
                            await e.reply('干嘛戳我，我要惩罚你！')
                            await common.sleep(100)
                            await e.group.muteMember(e.operator_id, 120);
                        }
                        else if (mutetype == 5) {
                            await e.reply('发配到往生堂当rbq😡')
                            await common.sleep(100)
                            await e.group.muteMember(e.operator_id, 1800);
                        }
                        else if (mutetype == 6) {
                            await e.reply('戳我？进小黑屋吧(/≧▽≦)/~┴┴')
                            await common.sleep(100)
                            await e.group.muteMember(e.operator_id, 300);
                        }
                        else if (mutetype == 7) {
                            await e.reply('我也是有脾气的！')
                            await common.sleep(100)
                            await e.group.muteMember(e.operator_id, 120);
                        }
                        
                        else if (role.includes(usrinfo.role)) {
                        let mutetype = Math.ceil(Math.random() * 3)
                        if (mutetype == 1) {
                            e.reply('呜呜呜你欺负我')
                        }
                        else if (mutetype == 2) {
                            e.reply('主人有坏淫欺负我')
                        }
                        else if (mutetype == 3) {
                            e.reply('气死我了不要戳了！')
                        }
                    }                       
                }   
            }
         }
         /*  
           //禁言2
           else if(random_type < (reply_text + reply_img + reply_voice + mutepick)){
            let text_number = Math.ceil(Math.random() * jinyan['length'])
            await e.reply(jinyan[text_number-1])
            await common.sleep(1000);
            await e.group.muteMember(e.operator_id,120)
        }
         */
         /*
        //本地表情
        else if(random_type < (reply_text + reply_img + reply_voice + mutepick + example)){        
            let photo_number = Math.ceil(Math.random() * (jpg_number + gif_number))            
            if(photo_number<=jpg_number){
                e.reply(segment.image(chuo_path + photo_number + '.jpg'))
            }
            else{
                photo_number = photo_number - jpg_number
                e.reply(segment.image(chuo_path + photo_number + '.gif'))
            }
        }
        */
        //接口表情
        else if(random_type < (reply_text + reply_img + reply_voice + mutepick + example)){
        let mutetype = Math.ceil(Math.random() * 6)
        if (mutetype == 1) {
        e.reply(segment.image('https://mahiro.tianyi.one'))//小真寻
        return true 
       }
       if (mutetype == 2) {
       e.reply(segment.image('https://api.lolimi.cn/API/chaiq/c.php'))//柴郡
       return true 
       }
       if (mutetype == 3) {
       e.reply(segment.image('http://api.yujn.cn/api/cxk.php'))//🐔
       return true 
       }
       if (mutetype == 4) {
       e.reply(segment.image('https://t.mwm.moe/lai'))//七濑胡桃
       return true 
       }
       if (mutetype == 5) {
       e.reply(segment.image('https://t.mwm.moe/xhl'))//小狐狸
       return true 
       }
       if (mutetype == 6) {
       e.reply(segment.image('http://shanhe.kim/api/tu/miao.php'))//猫羽雫
       return true 
       }
    }

              //主人戳
                else if (cfg.masterQQ.includes(e.operator_id)) {
                    let mutetype = Math.ceil(Math.random() * 6)
                    if (mutetype == 1) {
                        e.reply('主人连你也欺负我，呜呜呜~')
                    }
                    else if (mutetype == 2) {
                        e.reply('主人有什么事吗？喵~')
                    }
                    else if (mutetype == 3) {
                        e.reply('主人不要戳我了..会长不高的(⋟﹏⋞)')
                    }
                    else if (mutetype == 4) {
                        e.reply('我，我才不会这样子！真正的我从来不是傲娇！傲，傲娇什么的，都，都是别人杜摆~嗯，一点，一点也没有呢！')
                    }
                    else if (mutetype == 5) {
                        e.reply('主人主人，是你吗(˵¯͒〰¯͒˵)')
                    }
                    else if (mutetype == 6) {
                        e.reply('主……主人♡，这……这是我今天发……发……发的有趣的文字，请您有空……，啊别打我……别打我喵呜~，我会努力打更多文字的……别打我……')
                    }
                    else if (mutetype == 7) {
                        e.reply('我……我……才不是傲娇呢 哼╯^╰')
                    }
                    else if (mutetype == 8) {
                        e.reply('好像因为太舒服昏过去了~')
                    }
                    else if (mutetype == 9) {
                        e.reply('我在哦！是有什么事情吗？')
                    }
                    else if (mutetype == 10) {
                        e.reply('我不但可爱而且可爱你啦')
                    }
                    else if (mutetype == 11) {
                        e.reply('快带我去玩！（打滚）')
                    }

                }
    
       //反🐔
        else {
            let text_number = Math.ceil(Math.random() * fanji['length'])
            await e.reply(fanji[text_number-1])
            await common.sleep(1000)
            await e.group.pokeMember(e.operator_id)
        } 
     } 
    //戳主人  
    let examine
    if(Array.isArray(masterQQ))
    examine = masterQQ.includes(e.target_id)
    else
    examine = e.target_id == masterQQ
    if (examine) {
      /*触发黑名单*/
      let blackList = [`${e.runtime.cfg.qq}`]
      if (blackList.includes(e.target_id) || e.operator_id == e.runtime.cfg.qq)
      return false
      let choose = Math.round(Math.random() * 11)    
        if (choose == 1) {
        e.reply([
          segment.at(e.operator_id),
          ` 坏人，你对主人干嘛呢!`,
          segment.image(img_1)
        ], true)
        } else if (choose == 2) {
        e.reply([
          segment.at(e.operator_id),
          ` 你太坏了，${botname}要为主人报仇!`,
          segment.image(img_2)
        ], true)
        } else if (choose == 3) {
        e.reply([
          segment.at(e.operator_id),
          ` 主人是${botname}的，你不可以这样对主人`,
          segment.image(img_3)
        ], true)
        } else if (choose == 4) {
        e.reply([
          segment.at(e.operator_id),
          ` 你很可爱哦~${botname}很喜欢你~`,
          segment.image(img_4)
        ], true)
        } else if (choose == 5) {
        e.reply([
          segment.at(e.operator_id),
          ` 坏人，${botname}记住你了!`,
          segment.image(img_5)
        ], true)
        } else if (choose == 6) {
        e.reply([
          segment.at(e.operator_id),
          ` ${botname}劝你去欺负那边那个男铜`,
          segment.image(img_6)
        ], true)
        } else if (choose == 7) {
        e.reply([
          segment.at(e.operator_id),
          ` ${botname}咬洗你！`,
          segment.image(img_7)
        ], true)
        } else if (choose == 8) {
        e.reply([
          segment.at(e.operator_id),
          ` ${botname}做了一个伟大的决定！`,
          segment.image(img_8)
        ], true)
        } else if (choose == 9) {
        e.reply([
          segment.at(e.operator_id),
          ` ${botname}生气了，你老欺负主人`,
          segment.image(img_9)
        ], true)
        } else if (choose == 10) {
        e.reply([
          segment.at(e.operator_id),
          ` 你个坏人！${botname}要喊人了！`,
          segment.image(img_10)
        ], true)
        } else {
        e.reply([
          segment.at(e.operator_id),
          ` 不！许！碰！${botname}的主人！`,
          segment.image(img_11)
        ], true)
        }
      }
    }
  }
}
    
    








