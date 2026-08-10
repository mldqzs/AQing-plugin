# 🌌 AQing-plugin · 阿晴插件

这里是一个基于 [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai) 的综合娱乐小插件~ 
虽然最初只是自用练手，但不知不觉也攒下了不少好玩的功能。如果能给你和群友带来快乐，那就最好不过啦！欢迎尝鲜哦 ฅ^•ﻌ•^ฅ

[![version](https://img.shields.io/badge/version-1.10.4-9b8cff?style=flat-square)](./CHANGELOG.md)
[![Yunzai](https://img.shields.io/badge/TRSS--Yunzai-V3-66ccff?style=flat-square)](https://github.com/TimeRainStarSky/Yunzai)
[![Gitee](https://img.shields.io/badge/Gitee-aayhg-c71d23?style=flat-square&logo=gitee)](https://gitee.com/aayhg/AQing-plugin)
[![GitHub](https://img.shields.io/badge/GitHub-mldqzs-181717?style=flat-square&logo=github)](https://github.com/mldqzs/AQing-plugin)
[![QQ群](https://img.shields.io/badge/QQ%E7%BE%A4-%E5%A4%A7%E6%99%B4%E7%8E%8B%E6%9C%9D%20912363090-12b7f5?style=flat-square&logo=tencentqq)](https://qun.qq.com/universal-share/share?ac=1&authKey=vaayVDiP9soOVbKeG0YpOEy%2FXXOynz%2Bv%2BH8%2F2FTHKgT6prWnzNJObfjLa3z5I73T&busi_data=eyJncm91cENvZGUiOiI5MTIzNjMwOTAiLCJ0b2tlbiI6ImdlSFFhMnlydkFEZWV5M3FIVnhWNFRSSGVwWndySnNkTmRXdUhaRXcxaFMvUk9mWWpOeUMxR0o3VEtpcXZ3bGUiLCJ1aW4iOiIzMTcxNDE5NzA2In0%3D&data=2bE0k_euv8SPtnSWv8Ph6ZWuC8uU4R_YxH4b0ojn5uUSejkqPKbgBnLDxjcQExxlsRdh3Uc0EnuGp701zD0Gmw&svctype=4&tempid=h5_group_info)

## 🌸 写在前面

阿晴插件集合了群管小帮手、娱乐互动、资源解析等许多小功能。作者是小白，部分功能参考了各位大佬的优秀实现。
如果你在使用中遇到了问题，或者有新奇的想法，都非常欢迎提 issue 或是提交 PR 呀~

> 想一起摸鱼聊天？欢迎加入交流群 **大晴王朝（912363090）** 🎈

## ✨ 阿晴都会些什么呀？

大部分功能和开关，都可以在**锅巴面板**里直接点点点来修改，即时生效哦！

| 分类 | 阿晴的技能 | 用法小抄 |
| :--- | :--- | :--- |
| 🛡️ 群管 | 复读机 | `复读开启/关闭`，开启后大家刷屏的重复内容，阿晴也会跟着一起复读（如 `11→111`） |
| 🛡️ 群管 | 复读禁言 | 复读刷屏太狠了？达到阈值阿晴会先警告，不听话就会被阶梯禁言（锅巴里可以精细调控哦） |
| 🛡️ 群管 | 被艾特禁言 | 艾特机器人自动送上禁言套餐，支持按群开关和自定义时长 |
| 🎨 状态 | 可爱状态 | 发送 `#状态` 召唤猫爪果冻风状态图（随机背景），接管云崽本体状态，超好看！ |
| 🎲 娱乐 | 扫雷小游戏 | 发 `扫雷` 开局，`挖 B3` 翻开格子、`旗 B3` 插旗。大家一起通关攒积分，还能看 `扫雷排名` |
| 🎲 娱乐 | 五子棋 | 发 `五子棋人机` 挑战AI（更有 `地狱` 难度），发 `五子棋对战 @某人` 约战群友，`落 H8` 来下棋 |
| 🎵 解析 | 音乐解析 | 发送网易云 / QQ音乐 / 酷狗 / 酷我链接或卡片，阿晴会自动发带歌词的折叠消息和音频 |
| 🎬 解析 | 视频/图文 | 直接发 抖音 / 快手 / B站 / 小红书 / 小黑盒 链接，无感自动解析出视频、图文和文案 |
| 📰 日常 | 每日日报 | `#每日日报` 聚合资讯、摸鱼日历和新番；**还支持在锅巴配置定时发送到指定群** |
| 📸 日常 | 涩图打分 | 发图或引用图片问 `有多涩`，阿晴来帮你鉴赏（推荐在锅巴里切换到二次元更准的 Sightengine 接口） |
| 🍅 实用 | 番茄图片混淆 | 发图时带上 `小番茄混图` 生成混淆图防河蟹，遇到混淆图发 `小番茄解图` 还原真相 |
| 📖 实用 | 禁漫天堂 | `#jm 漫画ID` 直接把整本漫画打包成加密 PDF 发给你，老司机的随身神器（需简单配置账号） |
| 🎭 其他 | 更多小玩具 | `伪造消息`、`#QQ注册时间` 查询、每日 `塔罗牌` 占卜、随机 `咖啵` 表情... |
| 🛠️ 管理 | 主人与插件管理 | 增删主人，修改机器人名字，群内上下班，甚至可以在线 `#阿晴安装/删除插件` |

---

## 📦 食用指南

在云崽的根目录打开终端，选一个你喜欢的源把阿晴抱回家吧：

```bash
# Gitee（国内推荐，速度快）
git clone --depth=1 https://gitee.com/aayhg/AQing-plugin ./plugins/AQing-plugin

# GitHub
git clone --depth=1 https://github.com/mldqzs/AQing-plugin ./plugins/AQing-plugin
```

拉取完成后，因为禁漫天堂等功能需要一点额外的依赖，请在**云崽根目录**执行一下安装命令，然后再重启云崽就好啦：

```bash
pnpm install
```
> 💡 **小贴士**：依赖项已经写在阿晴的 `package.json` 里了，云崽在根目录 `pnpm install` 会自动识别并安装好。如果有个别报错，可以在命令末尾加上 `-w` 试试。

---

## 🎈 玩法与小提示

刚装好不知道怎么玩？发送 `#阿晴帮助` 就能看到精美的指令全览图啦！想要更新的话发送 `#阿晴更新` 即可。

这里挑几个热门功能给你详细说说：

### 🎵 & 🎬 全能解析（短视频/图文/音乐）
**不用发指令！** 直接往群里扔分享链接或卡片（纯文本也行），阿晴就会乖乖帮你解析：
- **视频类**（抖音/快手/B站）：自动发出标题、封面和视频本体。如果是图集，就会乖乖发图片。视频太大还会贴心地转成直链，不吃你的服务器流量。（在锅巴里还能开启抽取 BGM 语音的功能哦！）
- **图文类**（小红书/小黑盒）：自动把长篇笔记和多张图片打包成折叠聊天记录，清爽又好看。
- **音乐类**（网易/QQ/酷狗/酷我）：自动带上完整的折叠歌词、歌曲信息和 MP3 音乐。
> 📌 **进阶玩法**：想解锁 VIP 音乐或小黑盒高风控内容？去锅巴的对应分类里填上你的网页端 Cookie 就可以啦。

### 📖 禁漫天堂 (JMComic)
想看本子又嫌网页慢？阿晴帮你打包成加密 PDF！
1. 去浏览器登录 `18comic-mygo.vip`。
2. 按 F12 打开开发者工具，在「应用程序 (Application)」- Cookie 里找到 `AVS` 字段的值。
3. 把值填进**锅巴**的「禁漫天堂」配置里（或者改 `config/config/jm.yaml`）。
4. 发送 `#jm 350234`，稍等片刻，加密好的 PDF 就会送到你手上啦！
> 遇到下载 `403`？锅巴里贴心地准备了「JM 专用代理」设置，填上代理地址，只有下载漫画会走代理，丝毫不影响其它功能。

### 🎲 大家一起玩游戏
- **💣 扫雷**：群内发 `扫雷` 就能开局。不仅能 `挖 B3`，还能一口气 `挖 A1 B2 C3` 连挖！大家一起通力合作，赢了还能分积分上榜。
- **♟️ 五子棋**：支持艾特群友约战，更内置了强大的 AI 兜底。如果你有 ChatGPT、DeepSeek 等大模型的 API，填到锅巴里，就能让大模型陪你们下棋啦！敢不敢试试发送 `五子棋人机地狱`？

### 📸 涩图打分
不知道群友发的图安不安全？引用那张图，问一句 `有多涩` 或者 `涩不涩`。
> 强烈建议在锅巴里把打分接口换成 **Sightengine**！注册即可获取免费额度，它对二次元插画的判断比百度准确得多，甚至能让你自由微调对「轻微暗示」和「露骨」的敏感度。

---

## 💌 交流与反馈

如果你觉得阿晴还不错，或者遇到了一些小麻烦，非常欢迎来交流群找我们玩：
**大晴王朝 · QQ 群 912363090**

[![加入QQ群](https://img.shields.io/badge/点击加入-大晴王朝%20912363090-12b7f5?style=for-the-badge&logo=tencentqq)](https://qun.qq.com/universal-share/share?ac=1&authKey=vaayVDiP9soOVbKeG0YpOEy%2FXXOynz%2Bv%2BH8%2F2FTHKgT6prWnzNJObfjLa3z5I73T&busi_data=eyJncm91cENvZGUiOiI5MTIzNjMwOTAiLCJ0b2tlbiI6ImdlSFFhMnlydkFEZWV5M3FIVnhWNFRSSGVwWndySnNkTmRXdUhaRXcxaFMvUk9mWWpOeUMxR0o3VEtpcXZ3bGUiLCJ1aW4iOiIzMTcxNDE5NzA2In0%3D&data=2bE0k_euv8SPtnSWv8Ph6ZWuC8uU4R_YxH4b0ojn5uUSejkqPKbgBnLDxjcQExxlsRdh3Uc0EnuGp701zD0Gmw&svctype=4&tempid=h5_group_info)

**友情链接**：
- [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai) —— 阿晴依赖的优秀机器人框架
- [戏天插件 xitian-plugin](https://github.com/XiTianGame/xitian-plugin) / [siliconflow-plugin](https://github.com/AIGC-Yunzai/siliconflow-plugin) —— 给予了阿晴诸多灵感的大佬项目

*声明：本插件仅供学习与个人娱乐使用，请勿用于任何商业或违规用途。数据准确性受限于第三方接口，请大家合理使用哦~*
