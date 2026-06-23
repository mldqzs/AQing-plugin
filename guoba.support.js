import setting from './utils/setting.js'
import lodash from 'lodash'

const addGroupPromptProps = {
  content: '请输入群号：',
  placeholder: '请输入群号',
  okText: '添加',
  rules: [
    { required: true, message: '你写了个寂寞' },
    { pattern: '^\\d+$', message: '这玩意应该是纯数字的吧' },
    { min: 5, message: '你这细狗，太短了' },
    { max: 10, message: '太…长了…阿晴受不了捏' },
  ],
}

const add = {
  content: '请输入QQ号：',
  placeholder: '请输入QQ号',
  okText: '添加',
  rules: [
    { required: true, message: '你写了个寂寞' },
    { pattern: '^\\d+$', message: '这玩意应该是纯数字的吧' },
    { min: 5, message: '你这细狗，太短了' },
    { max: 11, message: '太…长了…阿晴受不了捏' },
  ],
}

// 支持锅巴
export function supportGuoba() {
  let allGroup = []
  Bot.gl.forEach((v, k) => { allGroup.push({ label: `${v.group_name}(${k})`, value: k }) })
  return {
    pluginInfo: {
      name: 'AQing-plugin',
      title: 'AQing-plugin',
      author: '明るい青紫色',
      authorLink: '',
      link: '',
      isV3: true,
      isV2: false,
      description: 'Yunzai-bot V3插件',
      icon: 'bi:box-seam',
      iconColor: '#7ed99e',
    },
    // 配置项信息
    configInfo: {
      schemas: [
        // ───────────────── 基础设置 ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '基础设置' },
        {
          field: 'config.绝对主人',
          label: '设置绝对主人',
          bottomHelpMessage: '绝对主人拥有最高权限，且无法被普通主人删除',
          component: 'GTags',
          componentProps: {
            placeholder: '请输入QQ',
            allowAdd: true,
            allowDel: true,
            showPrompt: true,
            promptProps: add,
            valueFormatter: ((value) => Number.parseInt(value)).toString(),
          },
        },
        {
          field: 'config.botname',
          label: '机器人名字',
          bottomHelpMessage: '作息提示语里使用的机器人名字',
          component: 'Input',
          componentProps: { placeholder: '请输入机器人名字' },
        },
        {
          field: 'config.start_tip',
          label: '上班提示语',
          bottomHelpMessage: '上班（上线）时的提示语',
          component: 'Input',
          componentProps: { placeholder: '请输入文字' },
        },
        {
          field: 'config.close_tip',
          label: '下班提示语',
          bottomHelpMessage: '下班（下线）时的提示语',
          component: 'Input',
          componentProps: { placeholder: '请输入文字' },
        },

        // ───────────────── 涩图打分 ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '涩图打分' },
        {
          field: 'spdf.PROVIDER',
          label: '打分接口',
          bottomHelpMessage: '选择使用哪个接口打分：百度对真人照片较准，Sightengine 对二次元/插画更准（推荐）。切换后只需填对应接口的 key',
          component: 'Select',
          componentProps: {
            placeholder: '请选择打分接口',
            options: [
              { label: '百度图片审核', value: 'baidu' },
              { label: 'Sightengine（二次元更准）', value: 'sightengine' },
            ],
          },
        },
        {
          field: 'spdf.APP_ID',
          label: '百度 · App ID',
          bottomHelpMessage: '百度「图片内容审核」应用的 App ID（PROVIDER 选 baidu 时使用）',
          component: 'Input',
          componentProps: { placeholder: '请输入 App ID' },
        },
        {
          field: 'spdf.API_KEY',
          label: '百度 · API Key',
          bottomHelpMessage: '百度「图片内容审核」应用的 API Key（PROVIDER 选 baidu 时使用）',
          component: 'Input',
          componentProps: { placeholder: '请输入 API Key' },
        },
        {
          field: 'spdf.SECRET_KEY',
          label: '百度 · Secret Key',
          bottomHelpMessage: '百度「图片内容审核」应用的 Secret Key（PROVIDER 选 baidu 时使用）',
          component: 'Input',
          componentProps: { placeholder: '请输入 Secret Key' },
        },
        {
          field: 'spdf.API_USER',
          label: 'Sightengine · API user',
          bottomHelpMessage: '注册 sightengine.com 后在 Dashboard 获取（免费额度 2000次/月、500次/天；PROVIDER 选 sightengine 时使用）',
          component: 'Input',
          componentProps: { placeholder: '请输入 API user' },
        },
        {
          field: 'spdf.API_SECRET',
          label: 'Sightengine · API secret',
          bottomHelpMessage: '注册 sightengine.com 后在 Dashboard 获取（PROVIDER 选 sightengine 时使用）',
          component: 'Input',
          componentProps: { placeholder: '请输入 API secret' },
        },
        { component: 'Divider', label: 'Sightengine 涩度权重（仅 sightengine 接口生效，0~1）' },
        {
          field: 'spdf.weights.mildly_suggestive',
          label: '轻微暗示（泳装/事业线/短裙）',
          bottomHelpMessage: '越大越「涩」。这是最常见的二次元 ecchi 档，默认很低（0.1），避免泳装就被判涩',
          component: 'InputNumber',
          componentProps: { min: 0, max: 1, step: 0.05, placeholder: '默认 0.1' },
        },
        {
          field: 'spdf.weights.suggestive',
          label: '一般暗示（艺术裸体/姿势示意）',
          bottomHelpMessage: '默认 0.25',
          component: 'InputNumber',
          componentProps: { min: 0, max: 1, step: 0.05, placeholder: '默认 0.25' },
        },
        {
          field: 'spdf.weights.very_suggestive',
          label: '强烈暗示（内衣/未露点的脱衣）',
          bottomHelpMessage: '默认 0.45',
          component: 'InputNumber',
          componentProps: { min: 0, max: 1, step: 0.05, placeholder: '默认 0.45' },
        },
        {
          field: 'spdf.weights.erotica',
          label: '色情（露胸/臀/私处）',
          bottomHelpMessage: '默认 0.75',
          component: 'InputNumber',
          componentProps: { min: 0, max: 1, step: 0.05, placeholder: '默认 0.75' },
        },
        {
          field: 'spdf.weights.sexual_display',
          label: '露骨（露性器）',
          bottomHelpMessage: '默认 0.9',
          component: 'InputNumber',
          componentProps: { min: 0, max: 1, step: 0.05, placeholder: '默认 0.9' },
        },
        {
          field: 'spdf.weights.sexual_activity',
          label: '性行为',
          bottomHelpMessage: '默认 1.0',
          component: 'InputNumber',
          componentProps: { min: 0, max: 1, step: 0.05, placeholder: '默认 1.0' },
        },
        {
          field: 'spdf.isCD',
          label: '涩图打分 CD 开关',
          bottomHelpMessage: '开启后非主人使用打分有冷却时间',
          component: 'Switch',
        },
        {
          field: 'spdf.CD',
          label: '涩图打分 CD 时长',
          bottomHelpMessage: 'CD 时长（分钟），最小为 1',
          component: 'InputNumber',
          componentProps: { min: 1, max: 1440, placeholder: '请输入整数（分钟）' },
        },

        // ───────────────── 短视频解析 ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '短视频解析（抖音/快手/B站）' },
        {
          field: 'video.enable',
          label: '短视频解析总开关',
          bottomHelpMessage: '群里/私聊发抖音、快手、B站链接，自动解析为标题+封面+视频（图文则发图片）。全程原生轻量解析，免 cookie',
          component: 'Switch',
        },
        {
          field: 'video.parseBili',
          label: 'B站解析',
          bottomHelpMessage: '官方 API 自解析',
          component: 'Switch',
        },
        {
          field: 'video.parseDouyin',
          label: '抖音解析',
          bottomHelpMessage: '分享页自解析，自动去水印',
          component: 'Switch',
        },
        {
          field: 'video.parseKuaishou',
          label: '快手解析',
          bottomHelpMessage: '移动分享页自解析',
          component: 'Switch',
        },
        {
          field: 'video.sendVideo',
          label: '发送视频本体',
          bottomHelpMessage: '关闭后只发「标题 + 封面 + 直链」，不下载视频，省流量',
          component: 'Switch',
        },
        {
          field: 'video.sendBgm',
          label: '提取背景音乐',
          bottomHelpMessage: '开启后额外用 ffmpeg 抽出视频音轨，发语音条 + mp3 文件；默认关。注：抽的是视频音轨，有人声的视频会是「人声+BGM」混音',
          component: 'Switch',
        },
        {
          field: 'video.maxDuration',
          label: '视频时长上限（秒）',
          bottomHelpMessage: '超过该时长则不下载、改发信息与直链，避免超长视频拖垮带宽',
          component: 'InputNumber',
          componentProps: { min: 0, placeholder: '默认 600（10 分钟）' },
        },
        {
          field: 'video.maxSize',
          label: '视频体积上限（MB）',
          bottomHelpMessage: '超过该体积则不下载、改发信息与直链',
          component: 'InputNumber',
          componentProps: { min: 0, placeholder: '默认 100' },
        },
        {
          field: 'video.isCD',
          label: '解析 CD 开关',
          bottomHelpMessage: '开启后同一群/私聊解析有冷却时间，防刷屏（主人不受限）',
          component: 'Switch',
        },
        {
          field: 'video.CD',
          label: '解析 CD 时长（秒）',
          bottomHelpMessage: 'CD 时长（秒），最小为 1',
          component: 'InputNumber',
          componentProps: { min: 1, placeholder: '默认 10' },
        },

        // ───────────────── 图文解析（小红书/小黑盒） ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '图文解析（小红书/小黑盒）' },
        {
          field: 'tw.enable',
          label: '图文解析总开关',
          bottomHelpMessage: '群里/私聊发小红书、小黑盒链接，自动解析。图文/多图用「聊天记录」折叠卡片发送',
          component: 'Switch',
        },
        {
          field: 'tw.xhsEnable',
          label: '小红书解析',
          bottomHelpMessage: '小红书图文/视频笔记解析。公开笔记一般免 cookie',
          component: 'Switch',
        },
        {
          field: 'tw.heyboxEnable',
          label: '小黑盒解析',
          bottomHelpMessage: '小黑盒图文/视频帖解析',
          component: 'Switch',
        },
        { component: 'Divider', label: '小红书' },
        {
          field: 'tw.xhsCookie',
          label: '小红书 cookie',
          bottomHelpMessage: '公开笔记一般免 cookie；遇到登录态内容/视频拉不到时，填整段 cookie',
          component: 'Input',
          componentProps: { placeholder: '一般留空即可' },
        },
        { component: 'Divider', label: '小黑盒' },
        {
          field: 'tw.heyboxCookie',
          label: '小黑盒 cookie（建议填登录态）',
          bottomHelpMessage: '小黑盒对服务器/云主机 IP 风控较严，匿名访问可能频繁触发验证码（届时只发标题+简介+封面+链接预览卡片）；填「已登录账号」整段 cookie 能显著提升拿到全文/多图的成功率',
          component: 'Input',
          componentProps: { placeholder: '强烈建议填已登录账号 cookie' },
        },
        { component: 'Divider', label: '通用' },
        {
          field: 'tw.maxImg',
          label: '多图最多发送张数',
          bottomHelpMessage: '一条图文最多发送多少张图，默认 18',
          component: 'InputNumber',
          componentProps: { min: 1, max: 50, placeholder: '默认 18' },
        },
        {
          field: 'tw.sendVideo',
          label: '发送视频本体',
          bottomHelpMessage: '视频笔记是否发送视频本体；关闭则只发封面+直链',
          component: 'Switch',
        },
        {
          field: 'tw.maxSize',
          label: '视频体积上限（MB）',
          bottomHelpMessage: '超过该体积则改发直链',
          component: 'InputNumber',
          componentProps: { min: 0, placeholder: '默认 100' },
        },
        {
          field: 'tw.maxDuration',
          label: '视频时长上限（秒）',
          bottomHelpMessage: '0 为不限，超限改发直链',
          component: 'InputNumber',
          componentProps: { min: 0, placeholder: '默认 0（不限）' },
        },
        {
          field: 'tw.isCD',
          label: '解析 CD 开关',
          bottomHelpMessage: '开启后同一群/私聊解析有冷却时间（主人不受限）',
          component: 'Switch',
        },
        {
          field: 'tw.CD',
          label: '解析 CD 时长（秒）',
          bottomHelpMessage: 'CD 时长（秒），最小为 1',
          component: 'InputNumber',
          componentProps: { min: 1, placeholder: '默认 10' },
        },

        // ───────────────── 禁漫天堂 ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '禁漫天堂（JMComic）' },
        {
          field: 'jm.AVS',
          label: '账号 AVS',
          bottomHelpMessage: '登录 18comic-mygo.vip 后 F12 →「应用程序」→ Cookie 里名为 AVS 的值（必填，否则无法下载）',
          component: 'Input',
          componentProps: { placeholder: '请输入 Cookie 中的 AVS 字段' },
        },
        {
          field: 'jm.CONCURRENCY',
          label: '下载并发数',
          bottomHelpMessage: '下载漫画图片时的并发请求数，太大易被风控；低配置服务器不建议设太大，内存/带宽吃紧容易崩溃，建议 2~3',
          component: 'InputNumber',
          componentProps: { min: 1, max: 10, placeholder: '请输入整数[1~10]' },
        },
        {
          field: 'jm.MAX_PAGES',
          label: '最大页数',
          bottomHelpMessage: '单本超过该页数则不处理，避免超大本子；低配置服务器不建议设太大，合成 PDF 时图片越多越占内存，容易崩溃',
          component: 'InputNumber',
          componentProps: { min: 1, max: 1000, placeholder: '请输入整数（页）' },
        },
        {
          field: 'jm.MAX_RETRIES',
          label: '失败重试次数',
          bottomHelpMessage: '单张图片下载失败时的重试次数',
          component: 'InputNumber',
          componentProps: { min: 0, max: 10, placeholder: '请输入整数[0~10]' },
        },
        {
          field: 'jm.PASSWORD',
          label: 'PDF 打开密码',
          bottomHelpMessage: '生成的加密 PDF 的通用打开密码',
          component: 'Input',
          componentProps: { placeholder: '请输入 PDF 密码' },
        },
        {
          field: 'jm.BASE_URL',
          label: '站点域名',
          bottomHelpMessage: '禁漫站点域名，失效时可在此更换',
          component: 'Input',
          componentProps: { placeholder: '如 18comic-mygo.vip' },
        },
        {
          field: 'jm.OUTPUT_DIR',
          label: 'PDF 临时目录',
          bottomHelpMessage: 'PDF 临时输出目录（相对云崽根目录，需已存在），默认 temp',
          component: 'Input',
          componentProps: { placeholder: '如 temp' },
        },
        {
          field: 'jm.DEBUG',
          label: '调试日志',
          bottomHelpMessage: '开启后输出禁漫下载的调试日志',
          component: 'Switch',
        },

        // ───────────────── 复读 & 群管 ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '复读 & 群管' },
        {
          field: 'config.fudu',
          label: '复读开关',
          bottomHelpMessage: '开启后，当消息由重复内容组成时机器人会再叠加一节复读（如 11→111、1212→121212），默认关闭',
          component: 'Switch',
        },
        {
          field: 'config.repeatBan',
          label: '复读禁言总开关',
          bottomHelpMessage: '开启后，群内连续复读达到阈值会先警告，继续复读则阶梯禁言',
          component: 'Switch',
        },
        {
          field: 'config.repeatBanTime',
          label: '复读初始禁言时间',
          bottomHelpMessage: '首次禁言时长（分钟），之后每次阶梯递增 1 分钟，零点归零',
          component: 'InputNumber',
          componentProps: { min: 1, max: 60, placeholder: '请输入整数（分钟）' },
        },
        {
          field: 'config.muteTime',
          label: '被艾特禁言时间',
          bottomHelpMessage: '设置被艾特禁言时间',
          component: 'InputNumber',
          required: true,
          componentProps: { min: 0, max: 30, placeholder: '请输入整数[0~30]' },
        },
        {
          field: 'config.jyGroupList',
          label: '开启艾特禁言的群聊',
          bottomHelpMessage: '要开启艾特禁言的群聊，可以多个',
          component: 'GTags',
          componentProps: {
            placeholder: '请输入群号',
            allowAdd: true,
            allowDel: true,
            showPrompt: true,
            promptProps: addGroupPromptProps,
            valueFormatter: ((value) => Number.parseInt(value)).toString(),
          },
        },

        // ───────────────── 伪造消息名单 ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '伪造消息名单' },
        {
          field: 'bm.白名单',
          label: '伪造白名单',
          bottomHelpMessage: '白名单内用户不可被伪造（主人自动保护）',
          component: 'GTags',
          componentProps: {
            placeholder: '请输入QQ',
            allowAdd: true,
            allowDel: true,
            showPrompt: true,
            promptProps: add,
            valueFormatter: ((value) => Number.parseInt(value)).toString(),
          },
        },
        {
          field: 'bm.黑名单',
          label: '伪造黑名单',
          bottomHelpMessage: '黑名单内用户禁止使用伪造功能（主人不受限）',
          component: 'GTags',
          componentProps: {
            placeholder: '请输入QQ',
            allowAdd: true,
            allowDel: true,
            showPrompt: true,
            promptProps: add,
            valueFormatter: ((value) => Number.parseInt(value)).toString(),
          },
        },
        {
          field: 'bm.禁言时间',
          label: '伪造主人/白名单的禁言时长',
          bottomHelpMessage: '伪造受保护用户时，伪造者被禁言的分钟数',
          component: 'InputNumber',
          componentProps: { min: 0, max: 30, placeholder: '请输入整数[0~30]' },
        },
      ],
      getConfigData() {
        return setting.merge()
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData(data, { Result }) {
        let config = {}
        for (let [keyPath, value] of Object.entries(data)) {
          lodash.set(config, keyPath, value)
        }
        config = lodash.merge({}, setting.merge(), config)
        setting.analysis(config)
        return Result.ok({}, '保存成功~')
      },
    },
  }
}
