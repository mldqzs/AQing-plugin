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
        {
          field: 'config.dailyReportTime',
          label: '每日日报定时发送时间',
          bottomHelpMessage: '填写 HH:mm；到点后会自动向下方配置的群发送每日日报',
          component: 'Input',
          componentProps: { placeholder: '例如 08:00' },
        },
        {
          field: 'config.dailyReportGroupList',
          label: '每日日报推送群号',
          bottomHelpMessage: '填写要接收每日日报的群号，可以多个；留空则不自动推送',
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

        // ───────────────── 可爱状态 ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '可爱状态' },
        {
          field: 'config.kawaiiStatus',
          label: '可爱状态开关',
          bottomHelpMessage: '开启后，群里/私聊发「#状态」由阿晴出猫爪果冻风格的可爱状态图（自带随机背景图），并接管（替换）云崽本体的「状态统计」；关闭则交还给云崽本体。主人也可发「#开启可爱状态 / #关闭可爱状态」热切换',
          component: 'Switch',
        },

        // ───────────────── 五子棋 ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '五子棋' },
        {
          field: 'gomoku.enable',
          label: '五子棋总开关',
          bottomHelpMessage: '群里发「五子棋人机」和 AI 对战（发「五子棋人机地狱」开地狱模式，AI 会算棋、很难赢）、「五子棋对战 @某人」邀人对战（对方发「接受」才开局）；「落 H8」落子，「五子棋排名」看榜',
          component: 'Switch',
        },
        {
          field: 'gomoku.aiBaseUrl',
          label: 'AI 接口地址',
          bottomHelpMessage: 'OpenAI 兼容的接口地址（到 /v1 即可，如 https://api.openai.com/v1）。留空则人机用内置 AI，开箱即玩',
          component: 'Input',
          componentProps: { placeholder: '如 https://api.openai.com/v1' },
        },
        {
          field: 'gomoku.aiKey',
          label: 'AI · API Key',
          bottomHelpMessage: '接口的 API Key（作为 Bearer 令牌）。和接口地址一起填好后，人机对手换成你配置的大模型',
          component: 'Input',
          componentProps: { placeholder: '请输入 API Key' },
        },
        {
          field: 'gomoku.aiModel',
          label: 'AI · 模型名',
          bottomHelpMessage: '调用的模型名，如 gpt-4o-mini、deepseek-chat 等',
          component: 'Input',
          componentProps: { placeholder: '如 gpt-4o-mini' },
        },
        {
          field: 'gomoku.aiTimeout',
          label: 'AI 思考超时（秒）',
          bottomHelpMessage: '等待大模型返回的超时时间，超时或接口异常会自动退回内置 AI 兜底，默认 30',
          component: 'InputNumber',
          componentProps: { min: 5, max: 120, placeholder: '默认 30' },
        },

        // ───────────────── 小番茄图片混淆 ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '小番茄图片混淆' },
        {
          field: 'hideImg.enable',
          label: '小番茄总开关',
          bottomHelpMessage: '开启后支持「小番茄混图 / 小番茄解图」，可发图、引用图或图片链接；结果默认上传外部图床并返回纯文本链接',
          component: 'Switch',
        },
        {
          field: 'hideImg.linkMode',
          label: '结果链接模式',
          bottomHelpMessage: 'external=外部图床（默认，返回公网链接）；local=机器人本地图链（不出站，但公网访问取决于你的云崽 server.url 配置）',
          component: 'Select',
          componentProps: {
            placeholder: '请选择链接模式',
            options: [
              { label: '外部图床（默认）', value: 'external' },
              { label: '本地图链', value: 'local' },
            ],
          },
        },
        {
          field: 'hideImg.externalProvider',
          label: '外部图床',
          bottomHelpMessage: 'auto=自动兜底（Catbox → Litterbox）；Catbox 为长期图床，Litterbox 为约 1 小时临时图床',
          component: 'Select',
          componentProps: {
            placeholder: '请选择外部图床',
            options: [
              { label: '自动（Catbox → Litterbox）', value: 'auto' },
              { label: 'Catbox', value: 'catbox' },
              { label: 'Litterbox（临时）', value: 'litterbox' },
            ],
          },
        },
        {
          field: 'hideImg.maxMB',
          label: '输入图片上限（MB）',
          bottomHelpMessage: '图片越大越吃内存，默认 12MB；低配服务器不建议调太高',
          component: 'InputNumber',
          componentProps: { min: 1, max: 50, placeholder: '默认 12' },
        },
        {
          field: 'hideImg.outputFormat',
          label: '输出格式',
          bottomHelpMessage: 'png=全部 PNG（推荐，最适合 QQ 下载/转发后再解图）；auto=混图 JPG、解图 PNG；jpg=全部 JPG（文件小但更容易糊）',
          component: 'Select',
          componentProps: {
            placeholder: '请选择输出格式',
            options: [
              { label: '全部 PNG（推荐）', value: 'png' },
              { label: '自动：混图JPG / 解图PNG', value: 'auto' },
              { label: '全部 JPG', value: 'jpg' },
            ],
          },
        },
        {
          field: 'hideImg.qqSafeScale',
          label: 'QQ 抗压缩倍数',
          bottomHelpMessage: '混图前把像素放大成色块，别人下载/转发到 QQ 后再解图会更稳。1=原尺寸，2=推荐，3/4 更稳但文件更大',
          component: 'InputNumber',
          componentProps: { min: 1, max: 4, placeholder: '默认 2' },
        },
        {
          field: 'hideImg.maxSide',
          label: '混图最大边',
          bottomHelpMessage: '混图前先限制最大边，再做抗压缩放大，避免图片过大。默认 1600；填 0 表示不限制',
          component: 'InputNumber',
          componentProps: { min: 0, max: 4096, placeholder: '默认 1600' },
        },
        {
          field: 'hideImg.localExpireMin',
          label: '本地图链有效期（分钟）',
          bottomHelpMessage: '仅 linkMode=local 或外部图床失败兜底时使用，默认 10 分钟',
          component: 'InputNumber',
          componentProps: { min: 1, max: 1440, placeholder: '默认 10' },
        },
        {
          field: 'hideImg.localMaxViews',
          label: '本地图链访问次数',
          bottomHelpMessage: '仅 linkMode=local 或外部图床失败兜底时使用；填 0 表示不限次数，只按有效期过期。默认 0，避免点开一次/预览一次就失效',
          component: 'InputNumber',
          componentProps: { min: 0, max: 1000, placeholder: '默认 0（不限次数）' },
        },
        {
          field: 'hideImg.localPublicBaseUrl',
          label: '本地图链公网地址',
          bottomHelpMessage: '云崽 server.url 很多环境默认是 localhost，别人打不开；这里填你的公网地址，如 http://1.2.3.4:2536 或 https://你的域名。留空则使用云崽原始地址',
          component: 'Input',
          componentProps: { placeholder: '如 http://1.2.3.4:2536' },
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

        // ───────────────── 音乐解析 ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '音乐解析（网易云/QQ/酷狗/酷我）' },
        {
          field: 'music.enable',
          label: '音乐解析总开关',
          bottomHelpMessage: '群里/私聊发送网易云音乐、QQ音乐、酷狗、酷我链接或分享卡片，自动解析歌曲信息、完整歌词和账号有权限播放的音频',
          component: 'Switch',
        },
        { field: 'music.parseNetease', label: '网易云音乐解析', component: 'Switch' },
        { field: 'music.parseQQ', label: 'QQ音乐解析', component: 'Switch' },
        { field: 'music.parseKugou', label: '酷狗音乐解析', component: 'Switch' },
        { field: 'music.parseKuwo', label: '酷我音乐解析', component: 'Switch' },
        {
          field: 'music.neteaseCookie',
          label: '网易云 Cookie',
          bottomHelpMessage: '从已登录网易云音乐网页复制完整 Cookie。用于获取该账号有权播放的 VIP/会员音源；留空仍可解析部分公开信息和歌词',
          component: 'Input',
          componentProps: { placeholder: '请输入网易云完整 Cookie' },
        },
        {
          field: 'music.qqCookie',
          label: 'QQ音乐 Cookie',
          bottomHelpMessage: '从已登录 QQ 音乐网页复制完整 Cookie。用于获取该账号有权播放的 VIP/会员音源；留空仍可解析部分公开信息和歌词',
          component: 'Input',
          componentProps: { placeholder: '请输入QQ音乐完整 Cookie' },
        },
        {
          field: 'music.kugouCookie',
          label: '酷狗完整 Cookie（可选）',
          bottomHelpMessage: '从已登录酷狗音乐网页复制完整 Cookie；也可只填写下方 KugooID 和 Token',
          component: 'Input',
          componentProps: { placeholder: '可选：请输入酷狗完整 Cookie' },
        },
        {
          field: 'music.kugouUserId',
          label: '酷狗用户 ID',
          bottomHelpMessage: '手动配置时填写 Cookie 中的 KugooID',
          component: 'Input',
          componentProps: { placeholder: 'Cookie 中的 KugooID' },
        },
        {
          field: 'music.kugouToken',
          label: '酷狗登录 Token',
          bottomHelpMessage: '手动配置时填写 Cookie 中的 t',
          component: 'Input',
          componentProps: { placeholder: 'Cookie 中的 t' },
        },
        {
          field: 'music.kuwoCookie',
          label: '酷我 Cookie',
          bottomHelpMessage: '从已登录酷我音乐网页复制完整 Cookie。用于获取该账号有权限播放的音源',
          component: 'Input',
          componentProps: { placeholder: '请输入酷我完整 Cookie' },
        },
        { field: 'music.sendLyrics', label: '发送完整歌词', bottomHelpMessage: '歌词用「聊天记录」折叠发送，不限制歌词行数', component: 'Switch' },
        { field: 'music.sendMp3', label: '发送音频文件', component: 'Switch' },
        { field: 'music.sendVoice', label: '发送语音条', bottomHelpMessage: '下载到音频后额外发一条可点播的语音；与「发送音频文件」可同时开，默认都开', component: 'Switch' },
        { field: 'music.sendCover', label: '发送歌曲封面', component: 'Switch' },
        {
          field: 'music.maxSize',
          label: '音频下载上限（MB）',
          bottomHelpMessage: '超过该体积停止下载，避免占满内存/磁盘，默认 30MB',
          component: 'InputNumber',
          componentProps: { min: 1, max: 500, placeholder: '默认 30' },
        },
        {
          field: 'music.sendMode',
          label: '音频发送方式',
          bottomHelpMessage: 'auto=小文件上传、大文件发临时链接；upload=总是上传；link=总是发临时下载链接',
          component: 'Select',
          componentProps: { options: [
            { label: '自动（推荐）', value: 'auto' },
            { label: '总是上传文件', value: 'upload' },
            { label: '总是发链接', value: 'link' },
          ] },
        },
        { field: 'music.uploadLimitMB', label: '自动发链接阈值（MB）', component: 'InputNumber', componentProps: { min: 1, max: 500, placeholder: '默认 25' } },
        { field: 'music.linkExpireMin', label: '临时链接有效期（分钟）', component: 'InputNumber', componentProps: { min: 1, max: 1440, placeholder: '默认 60' } },
        { field: 'music.linkMaxViews', label: '临时链接访问次数', bottomHelpMessage: '0=不限次数，只按有效期过期', component: 'InputNumber', componentProps: { min: 0, max: 1000, placeholder: '默认 0' } },
        {
          field: 'music.filePublicBaseUrl',
          label: '临时链接公网地址',
          bottomHelpMessage: '云崽返回 localhost 时填写公网地址或域名，如 https://bot.example.com',
          component: 'Input',
          componentProps: { placeholder: '如 https://bot.example.com' },
        },
        { field: 'music.isCD', label: '解析 CD 开关', component: 'Switch' },
        { field: 'music.CD', label: '解析 CD（秒）', component: 'InputNumber', componentProps: { min: 1, placeholder: '默认 10' } },
        { field: 'music.timeout', label: '平台请求超时（秒）', component: 'InputNumber', componentProps: { min: 5, max: 120, placeholder: '默认 20' } },
        { field: 'music.loginTimeout', label: '扫码登录等待（秒）', bottomHelpMessage: '主人发送 #qq音乐扫码 / #酷狗音乐扫码 后等待确认登录的时间', component: 'InputNumber', componentProps: { min: 30, max: 300, placeholder: '默认 120' } },

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
          field: 'tw.maxLive',
          label: '实况图/动图最多条数',
          bottomHelpMessage: '小红书有的笔记整篇都是实况图，限量避免刷屏，默认 6',
          component: 'InputNumber',
          componentProps: { min: 0, max: 30, placeholder: '默认 6' },
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
          field: 'jm.PROXY_URL',
          label: 'JM 专用代理',
          bottomHelpMessage: '默认留空=不走代理。部分 IP 被 CF/站点 403 时可填代理，只作用于禁漫天堂下载，不污染全局 axios；例如 http://127.0.0.1:7890 或 http://user:pass@host:port',
          component: 'Input',
          componentProps: { placeholder: '留空直连，如 http://127.0.0.1:7890' },
        },
        {
          field: 'jm.SEND_MODE',
          label: 'PDF 发送方式',
          bottomHelpMessage: 'auto=小文件正常上传、大文件自动改发临时链接；upload=总是上传群文件；link=总是发临时下载链接，适合上传总超时的适配器',
          component: 'Select',
          componentProps: {
            placeholder: '请选择发送方式',
            options: [
              { label: '自动（大文件发链接）', value: 'auto' },
              { label: '总是上传群文件', value: 'upload' },
              { label: '总是发临时链接', value: 'link' },
            ],
          },
        },
        {
          field: 'jm.UPLOAD_LIMIT_MB',
          label: '自动发链接阈值（MB）',
          bottomHelpMessage: 'SEND_MODE=auto 时，PDF 超过该大小就不上传群文件，直接发临时链接，默认 80MB',
          component: 'InputNumber',
          componentProps: { min: 1, max: 2048, placeholder: '默认 80' },
        },
        {
          field: 'jm.LINK_EXPIRE_MIN',
          label: '临时链接有效期（分钟）',
          bottomHelpMessage: '发临时下载链接时使用，默认 60 分钟',
          component: 'InputNumber',
          componentProps: { min: 1, max: 1440, placeholder: '默认 60' },
        },
        {
          field: 'jm.LINK_MAX_VIEWS',
          label: '临时链接访问次数',
          bottomHelpMessage: '0 表示不限次数，只按有效期过期；大于 0 则限制访问次数',
          component: 'InputNumber',
          componentProps: { min: 0, max: 1000, placeholder: '默认 0（不限次数）' },
        },
        {
          field: 'jm.FILE_PUBLIC_BASE_URL',
          label: '临时链接公网地址',
          bottomHelpMessage: '云崽 server.url 若是 localhost，群友打不开；这里填公网地址，如 http://1.2.3.4:2536 或你的域名。留空则使用云崽原始地址',
          component: 'Input',
          componentProps: { placeholder: '如 http://1.2.3.4:2536' },
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
          bottomHelpMessage: '首次禁言时长（分钟），之后按「叠加时长」阶梯递增，零点归零',
          component: 'InputNumber',
          componentProps: { min: 1, max: 60, placeholder: '请输入整数（分钟）' },
        },
        {
          field: 'config.repeatBanStep',
          label: '复读禁言叠加时长',
          bottomHelpMessage: '每次阶梯禁言额外增加的分钟数（默认 1）。例如初始 1、叠加 5 → 1/6/11/16…',
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

        // ───────────────── 入群审核 ─────────────────
        { component: 'SOFT_GROUP_BEGIN', label: '入群审核' },
        {
          field: 'config.groupJoinCheck',
          label: '入群审核开关',
          bottomHelpMessage: '开启后，仅对下方群号列表生效；有人申请加群时机器人在群内播报申请人和验证消息，管理员/群主/主人回复「同意」或「拒绝」即可审批。主人也可在群内发「#开启入群审核 / #关闭入群审核」热切换当前群',
          component: 'Switch',
        },
        {
          field: 'config.groupJoinCheckGroups',
          label: '入群审核生效群号',
          bottomHelpMessage: '填写要开启入群审核的群号，可以多个；留空表示未开启任何群。也可以在目标群发送「#开启入群审核」自动加入当前群',
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
        {
          field: 'config.groupJoinCheckTime',
          label: '审批等待超时（分钟）',
          bottomHelpMessage: '申请播报后超过该时间无人审批，自动取消并在群内提示，默认 10',
          component: 'InputNumber',
          componentProps: { min: 1, max: 1440, placeholder: '默认 10' },
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
