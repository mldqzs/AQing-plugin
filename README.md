<div align="center">

# 🌌 AQing-plugin · 阿晴插件

**基于 [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai) 的自用娱乐插件，功能杂、偏练手，欢迎尝鲜**

[![version](https://img.shields.io/badge/version-1.10.1-9b8cff?style=flat-square)](./CHANGELOG.md)
[![Yunzai](https://img.shields.io/badge/TRSS--Yunzai-V3-66ccff?style=flat-square)](https://github.com/TimeRainStarSky/Yunzai)
[![Gitee](https://img.shields.io/badge/Gitee-aayhg-c71d23?style=flat-square&logo=gitee)](https://gitee.com/aayhg/AQing-plugin)
[![GitHub](https://img.shields.io/badge/GitHub-mldqzs-181717?style=flat-square&logo=github)](https://github.com/mldqzs/AQing-plugin)
[![QQ群](https://img.shields.io/badge/QQ%E7%BE%A4-%E5%A4%A7%E6%99%B4%E7%8E%8B%E6%9C%9D%20912363090-12b7f5?style=flat-square&logo=tencentqq)](https://qun.qq.com/universal-share/share?ac=1&authKey=vaayVDiP9soOVbKeG0YpOEy%2FXXOynz%2Bv%2BH8%2F2FTHKgT6prWnzNJObfjLa3z5I73T&busi_data=eyJncm91cENvZGUiOiI5MTIzNjMwOTAiLCJ0b2tlbiI6ImdlSFFhMnlydkFEZWV5M3FIVnhWNFRSSGVwWndySnNkTmRXdUhaRXcxaFMvUk9mWWpOeUMxR0o3VEtpcXZ3bGUiLCJ1aW4iOiIzMTcxNDE5NzA2In0%3D&data=2bE0k_euv8SPtnSWv8Ph6ZWuC8uU4R_YxH4b0ojn5uUSejkqPKbgBnLDxjcQExxlsRdh3Uc0EnuGp701zD0Gmw&svctype=4&tempid=h5_group_info)

</div>

## 📖 介绍

阿晴插件是一个基于云崽（Yunzai-Bot V3）的自用插件，集合了群管理、娱乐互动等一些小功能。作者是小白，部分功能参考/借鉴了各位大佬的实现，欢迎提 issue 或 PR。

> 有问题、想反馈或一起玩？欢迎加交流群 **大晴王朝（912363090）** 🎈

## ✨ 功能简介

| 分类 | 功能 | 说明 |
| --- | --- | --- |
| 群管理 | 复读 | `复读开启/关闭` 总开关（仅主人，默认关）；开启后重复内容叠加复读，如 `11→111`、`1212→121212` |
| 群管理 | 复读禁言 | 复读达阈值先警告，继续复读则阶梯禁言（锅巴可配总开关 / 初始禁言时间） |
| 群管理 | 被艾特禁言 | 艾特机器人自动禁言，支持按群开关与时长设置 |
| 娱乐 | 伪造消息 | 伪造一条消息，支持黑白名单与主人保护 |
| 娱乐 | QQ 注册时间 | `#QQ注册时间` 查询 QQ 注册时间等信息，图片卡片展示 |
| 娱乐 | 涩图打分 | 引用或发图给图片打分，百度 / Sightengine 双接口可切换（Sightengine 对二次元更准） |
| 娱乐 | 短视频解析 | 发抖音 / 快手 / B站链接自动解析为视频（图文则发图片）；全程原生轻量解析、免 cookie，可选用 ffmpeg 抽背景音乐 |
| 娱乐 | 音乐解析 | 发网易云音乐 / QQ音乐 / 酷狗 / 酷我链接或卡片，自动解析歌曲信息、完整歌词（聊天记录折叠）和账号有权限播放的音频；Cookie 可在锅巴配置 |
| 娱乐 | 图文解析 | 发小红书 / 小黑盒链接自动解析，图文用「聊天记录」折叠卡片发送，视频笔记发本体 |
| 娱乐 | 扫雷小游戏 | 群里发 `扫雷` 开局，`挖 B3` 翻格、`旗 B3` 插旗（支持 `挖 A1 B2` 连发），通关按出力攒积分，`扫雷排名` 看榜 |
| 娱乐 | 五子棋 | `五子棋人机`（加 `地狱` 更难）和 AI 对战、`五子棋对战 @某人` 邀人对战（对方发 `接受`），`落 H8` 落子；AI 可在锅巴自配接口/Key/模型，未配置用内置 AI，`五子棋排名` 看榜 |
| 娱乐 | 小番茄图片混淆 | `小番茄混图` 混淆图片、`小番茄解图` 解混淆还原；支持发图、引用图、图片链接，结果直接返回临时图片链接 |
| 娱乐 | 塔罗牌 / 随机咖啵 | 每日塔罗牌、随机咖啵表情 |
| 状态 | 可爱状态 | `#状态` 出猫爪果冻风状态图（自带随机背景图），带开关，开启后替换云崽本体状态；`#开启/关闭可爱状态` 或锅巴切换 |
| 娱乐 | 禁漫天堂 | `#jm 漫画ID`（如 `#jm 350234`）下载整本为加密 PDF 发到群文件/私聊，需配置账号 AVS |
| 调试 | 消息解剖台 | 引用一条消息后发 `取` / `解剖`，输出其消息段结构与元信息（仅主人，支持 NapCat 等 OneBot 适配器） |
| 管理 | 插件安装 / 删除 | `#阿晴安装/删除插件`，支持单 js 与完整插件，GitHub 链接自动加速、失败退回原链接（仅主人） |
| 管理 | 主人管理 | 增删主人、绝对主人、主人列表 |
| 管理 | 机器人名字 / 上下班 | 修改机器人名字、群内上/下班开关 |
| 其它 | 帮助 / 版本 / 更新 | `#阿晴帮助`、`#阿晴版本`、`#阿晴更新` |

> 大部分配置均支持锅巴面板可视化修改与热加载。

## 📦 安装方式

进入云崽根目录，任选 Gitee 或 GitHub 其一克隆：

```bash
# Gitee（国内推荐）
git clone --depth=1 https://gitee.com/aayhg/AQing-plugin ./plugins/AQing-plugin

# GitHub
git clone --depth=1 https://github.com/mldqzs/AQing-plugin ./plugins/AQing-plugin
```

安装完成后，在**云崽根目录**安装依赖（禁漫天堂功能需要），随后重启云崽即可：

```bash
pnpm install
```

> 依赖（`axios`、`cheerio`、`https-proxy-agent`、`@cantoo/pdf-lib`、`sharp`、`p-limit`）已写入本插件 `package.json`，
> 云崽为 pnpm workspace（`plugins/**`），在根目录执行一次 `pnpm install` 即会一并装好；
> 若个别包构建报错，可在命令末尾加 `-w` 重试。

## 📚 使用说明

发送 `#阿晴帮助` 查看全部功能；发送 `#阿晴更新` 更新插件，`#阿晴版本` 查看版本信息。

### 禁漫天堂

1. 在云崽根目录执行 `pnpm install` 安装依赖（见上）。
2. 配置账号 AVS（任选其一，均热生效、无需重启）：
   - **锅巴**：锅巴管理面板 → AQing-plugin → 禁漫天堂，填入 AVS 等配置；
   - **手动**：编辑 `config/config/jm.yaml`。
   - AVS 获取：浏览器打开 `18comic-mygo.vip` 并登录 → F12 →「应用程序」→ Cookie 中名为 `AVS` 的值。
3. 发送 `#jm 漫画ID`（如 `#jm 350234`），机器人会把整本下载为加密 PDF 上传到群文件/私聊（PDF 默认密码见 `jm.yaml` 的 `PASSWORD`）。
4. 如遇部分服务器/IP 下载时报 `403`（可能被 CF/站点风控拦截），可在锅巴「禁漫天堂」里填写 **JM 专用代理**（如 `http://127.0.0.1:7890` 或 `http://user:pass@host:port`）。该代理只作用于禁漫天堂下载，不会修改全局 axios，也不会影响其它功能。

### 涩图打分

发图或**引用一张图片**后发送「有多涩 / 涩不涩」即可打分，支持两个接口（均热生效、无需重启）：

- **百度图片审核**（默认）：真人照片较准，二次元偏差较大。在百度智能云开通「内容审核-图像」后，填 `APP_ID / API_KEY / SECRET_KEY`。
- **Sightengine**（推荐二次元）：区分插画与真人并分级。注册 [sightengine.com](https://sightengine.com) 后在 Dashboard 取 `API user / API secret`（免费 2000 次/月、500 次/天）；复制 secret 时注意别把网页上的「REVEAL」按钮文字一起带进去。

在锅巴「AQing-plugin → 涩涩配置」里选「打分接口」并填对应 key；Sightengine 还可在「涩度权重」逐档微调评分曲线（如嫌泳装判得太涩，调低 `mildly_suggestive` 即可）。

### 短视频解析

群里或私聊直接发分享链接（纯文本链接、复制带文案、QQ 卡片分享均可）即自动解析，无需指令。三家**全部走原生轻量解析、免 cookie、低配服务器也扛得住**：

- **B站**：`b23.tv` 短链、`bilibili.com/video/BV…`、裸 `BV…` 号均可，走官方 API。
- **抖音**：`v.douyin.com` 短链或作品链接，走移动分享页自解析，视频自动去水印，图文笔记则发图片。
- **快手**：`v.kuaishou.com` 短链或作品链接，走移动分享页自解析，图集则发图片。

解析结果为「标题 + 封面 + 视频」；当视频超过时长/体积上限（或下载失败、QQ 拒收大视频）时，**自动改发可点的视频直链**，不占机器人流量。相关开关、上限、CD 均可在锅巴「AQing-plugin → 短视频解析」或 `config/config/video.yaml` 调整，热生效。

**背景音乐**（可选，默认关）：开启「提取背景音乐」后，机器人会用 ffmpeg 从视频抽出音轨，发一条语音条（点开就听）+ 一个 mp3 文件。需要系统装有 `ffmpeg`（多数云崽环境已自带；`ffmpeg -version` 可验证）。注意抽的是视频音轨——纯音乐视频即 BGM，带人声的视频会是「人声 + BGM」的混音。

### 音乐解析

群里或私聊发送**网易云音乐、QQ音乐、酷狗、酷我**歌曲链接或分享卡片即可自动解析，无需指令：

- 发送歌曲名称、歌手、专辑、时长和封面；
- 完整歌词用「聊天记录」（合并转发）折叠发送，歌词不限制行数，过长时自动拆成多个节点；
- QQ音乐、酷狗音乐需在锅巴「AQing-plugin → 音乐解析」手动填写已登录网页的完整 Cookie；酷狗也可只填写核心 `KugooID` 和 Token；
- 歌词与音源权限分开解析，即使 VIP 音频没有权限也会尽量返回完整歌词；
- 账号有权限且平台返回直链时下载并发送音频，非 MP3 音源自动用 ffmpeg 转为 MP3；
- 没有权限、Cookie 失效、地区/版权限制时仍会返回歌曲信息和歌词，并明确提示未获取到音频；
- 音频上传超时或体积过大时自动改发临时下载链接，可配置公网域名、有效期和访问次数。

音频获取能力以用户账号本身的播放权限和平台接口返回为准。

### 图文解析

群里或私聊直接发**小红书 / 小黑盒**链接（纯文本、复制带文案、QQ 卡片分享均可）即自动解析，无需指令：

- **图文 / 多图笔记** → 用「聊天记录」（合并转发）折叠卡片发送，标题、作者、正文、多图一条收纳；
- **视频笔记** → 标题 + 封面 + 视频本体（沿用短视频的体积/时长上限与直链兜底）。

小红书公开笔记一般免 cookie（分享链接里带 `xsec_token` 即可）；遇到登录态内容或小黑盒风控，可在锅巴「AQing-plugin → 图文解析」或 `config/config/tw.yaml` 填登录 cookie 提升成功率，热生效。

### 扫雷小游戏

群里发 `扫雷` 开一局（默认中等，也可 `扫雷简单 / 中等 / 困难`），**整群共用一局、人人都能挖**：

- 翻格：`挖 B3`（列字母 A-L + 行数字），一条消息连挖多格发 `挖 A1 B2 C3`；
- 插旗 / 拔旗：`旗 B3`（再发一次取消），也可 `旗 A1 B2` 连标；
- 认输：`扫雷认输` 结束本局。

通关后奖励池（简单 10 / 中等 25 / 困难 60）**按各人挖开的格子数分配**，挖得多分得多、抢尾刀拿不到分；`扫雷排名` 看本群积分榜，`我的扫雷` 查个人战绩，`扫雷帮助` 看玩法。对局与积分按群隔离、存 redis，无操作 2 小时自动失效。

### 五子棋

15×15 木纹棋盘，两种玩法：

- **人机对战**：发 `五子棋人机`（默认你执黑先手，`五子棋人机后手` 改执白）；
- **地狱模式**：发 `五子棋人机地狱`（或 `地狱五子棋`），AI 换成带前瞻搜索（α-β 剪枝、看 4 层）的强引擎，会算棋、识破「双活三/四三」逼杀这类先手必赢套路，很难赢；不走外部接口，棋力稳定且低配也扛得住；
- **群友对战**：发 `五子棋对战 @某人` 发起邀请，对方发 `接受` 才开局（发 `拒绝` 回绝）；发起方执黑先手、对方执白；
- **落子**：`落 H8`（列字母 A-O + 行数字 1-15，也可 `落子 H8 / 下 H8`）；
- **认输**：`五子棋认输` 结束本局；`五子棋排名` 看本群胜场榜，`五子棋帮助` 看玩法。

AI 对手默认用**内置启发式 AI**，开箱即玩；在锅巴「AQing-plugin → 五子棋」填好 **接口地址 / API Key / 模型**（任何 OpenAI 兼容接口均可，如 OpenAI、DeepSeek 等）后，人机对手会换成你配置的大模型来下，接口异常时自动退回内置 AI 兜底。一个群同时只进行一局，按群隔离存 redis，无操作 2 小时自动失效。

### 小番茄图片混淆

复刻 [小番茄图片混淆](https://singularpoint.cn/hideImg1.html) 的本地算法：

- **混淆图片**：发图/引用图/图片链接后发送 `小番茄混图`，或先发 `小番茄混图` 再补图；
- **解混淆**：发图/引用图/图片链接后发送 `小番茄解图`，或先发 `小番茄解图` 再补图；
- 算法走 Gilbert 空间填充曲线 + 黄金比例偏移重排像素；
- 输出会直接返回一个 `http...` 临时图片链接，不再把结果作为 QQ 图片消息发出去，避免 QQ 图片风控拦截；
- 如果选择「本地图链」，可在锅巴填写「本地图链公网地址」（如 `http://1.2.3.4:2536` 或自己的域名），插件会把云崽默认的 `localhost` 链接替换成可访问的公网地址；
- 本地图链默认**不限访问次数**，只按有效期过期，避免 QQ/浏览器预览点一次就把次数扣光；
- 输出格式默认 `PNG`，尽量减少 QQ 使用场景里因 JPG 有损压缩导致的解图模糊。

图片大小限制 12MB，超大图会拒绝处理，避免低配服务器炸内存。

## 💬 交流群

欢迎加群一起玩、提需求、反馈 bug：

<div align="center">

**大晴王朝 · QQ 群 912363090**

[![加入QQ群](https://img.shields.io/badge/点击加入-大晴王朝%20912363090-12b7f5?style=for-the-badge&logo=tencentqq)](https://qun.qq.com/universal-share/share?ac=1&authKey=vaayVDiP9soOVbKeG0YpOEy%2FXXOynz%2Bv%2BH8%2F2FTHKgT6prWnzNJObfjLa3z5I73T&busi_data=eyJncm91cENvZGUiOiI5MTIzNjMwOTAiLCJ0b2tlbiI6ImdlSFFhMnlydkFEZWV5M3FIVnhWNFRSSGVwWndySnNkTmRXdUhaRXcxaFMvUk9mWWpOeUMxR0o3VEtpcXZ3bGUiLCJ1aW4iOiIzMTcxNDE5NzA2In0%3D&data=2bE0k_euv8SPtnSWv8Ph6ZWuC8uU4R_YxH4b0ojn5uUSejkqPKbgBnLDxjcQExxlsRdh3Uc0EnuGp701zD0Gmw&svctype=4&tempid=h5_group_info)

</div>

## 🔗 友情链接

- [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai) · [Gitee 镜像](https://gitee.com/TimeRainStarSky/Yunzai) —— 本插件所依赖的机器人框架
- [戏天插件 xitian-plugin](https://github.com/XiTianGame/xitian-plugin) —— Yunzai 插件管理器，本插件的「安装 / 删除插件」功能参考了它的实现
- [siliconflow-plugin](https://github.com/AIGC-Yunzai/siliconflow-plugin) —— SiliconFlow AI 插件，本插件的「短视频解析」参考了它的抖音 / 快手 / B站原生解析实现

## 📑 声明

- 本插件仅供学习与个人娱乐使用，请勿用于任何商业或违规用途。
- 插件部分内容（如随机图、QQ 信息查询等）来源于网络第三方接口，其数据准确性与可用性由对应来源决定，本插件不对其内容负责。
- 使用本插件所产生的一切后果由使用者自行承担。
