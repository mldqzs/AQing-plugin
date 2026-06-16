# AQing-plugin

> 基于 [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai) 的自用娱乐插件，功能杂、偏练手，欢迎尝鲜。

## 介绍

阿晴插件是一个基于云崽（Yunzai-Bot V3）的自用插件，集合了群管理、娱乐互动等一些小功能。作者是小白，部分功能参考/借鉴了各位大佬的实现，欢迎提 issue 或 PR。

## 功能简介

| 分类 | 功能 | 说明 |
| --- | --- | --- |
| 群管理 | 复读 | `复读开启/关闭` 总开关（仅主人，默认关）；开启后重复内容叠加复读，如 `11→111`、`1212→121212` |
| 群管理 | 复读禁言 | 复读达阈值先警告，继续复读则阶梯禁言（锅巴可配总开关 / 初始禁言时间） |
| 群管理 | 被艾特禁言 | 艾特机器人自动禁言，支持按群开关与时长设置 |
| 娱乐 | 伪造消息 | 伪造一条消息，支持黑白名单与主人保护 |
| 娱乐 | QQ 注册时间 | `#QQ注册时间` 查询 QQ 注册时间等信息，图片卡片展示 |
| 娱乐 | 涩图打分 | 引用或发图给图片打分，百度 / Sightengine 双接口可切换（Sightengine 对二次元更准） |
| 娱乐 | 塔罗牌 / 随机咖啵 | 每日塔罗牌、随机咖啵表情 |
| 娱乐 | 禁漫天堂 | `#jm 漫画ID`（如 `#jm 350234`）下载整本为加密 PDF 发到群文件/私聊，需配置账号 AVS |
| 调试 | 消息解剖台 | 引用一条消息后发 `取` / `解剖`，输出其消息段结构与元信息（仅主人，支持 NapCat 等 OneBot 适配器） |
| 管理 | 插件安装 / 删除 | `#阿晴安装/删除插件`，支持单 js 与完整插件，GitHub 链接自动加速、失败退回原链接（仅主人） |
| 管理 | 主人管理 | 增删主人、绝对主人、主人列表 |
| 管理 | 机器人名字 / 上下班 | 修改机器人名字、群内上/下班开关 |
| 其它 | 帮助 / 版本 / 更新 | `#阿晴帮助`、`#阿晴版本`、`#阿晴更新` |

> 大部分配置均支持锅巴面板可视化修改与热加载。

## 安装方式

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

> 依赖（`axios`、`cheerio`、`@cantoo/pdf-lib`、`sharp`、`p-limit`）已写入本插件 `package.json`，
> 云崽为 pnpm workspace（`plugins/**`），在根目录执行一次 `pnpm install` 即会一并装好；
> 若个别包构建报错，可在命令末尾加 `-w` 重试。

## 使用说明

发送 `#阿晴帮助` 查看全部功能；发送 `#阿晴更新` 更新插件，`#阿晴版本` 查看版本信息。

### 禁漫天堂

1. 在云崽根目录执行 `pnpm install` 安装依赖（见上）。
2. 配置账号 AVS（任选其一，均热生效、无需重启）：
   - **锅巴**：锅巴管理面板 → AQing-plugin → 禁漫天堂，填入 AVS 等配置；
   - **手动**：编辑 `config/config/jm.yaml`。
   - AVS 获取：浏览器打开 `18comic-mygo.vip` 并登录 → F12 →「应用程序」→ Cookie 中名为 `AVS` 的值。
3. 发送 `#jm 漫画ID`（如 `#jm 350234`），机器人会把整本下载为加密 PDF 上传到群文件/私聊（PDF 默认密码见 `jm.yaml` 的 `PASSWORD`）。

### 涩图打分

发图或**引用一张图片**后发送「有多涩 / 涩不涩」即可打分，支持两个接口（均热生效、无需重启）：

- **百度图片审核**（默认）：真人照片较准，二次元偏差较大。在百度智能云开通「内容审核-图像」后，填 `APP_ID / API_KEY / SECRET_KEY`。
- **Sightengine**（推荐二次元）：区分插画与真人并分级。注册 [sightengine.com](https://sightengine.com) 后在 Dashboard 取 `API user / API secret`（免费 2000 次/月、500 次/天）；复制 secret 时注意别把网页上的「REVEAL」按钮文字一起带进去。

在锅巴「AQing-plugin → 涩涩配置」里选「打分接口」并填对应 key；Sightengine 还可在「涩度权重」逐档微调评分曲线（如嫌泳装判得太涩，调低 `mildly_suggestive` 即可）。

## 友情链接

- [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai) · [Gitee 镜像](https://gitee.com/TimeRainStarSky/Yunzai) —— 本插件所依赖的机器人框架
- [戏天插件 xitian-plugin](https://github.com/XiTianGame/xitian-plugin) —— Yunzai 插件管理器，本插件的「安装 / 删除插件」功能参考了它的实现

## 声明

- 本插件仅供学习与个人娱乐使用，请勿用于任何商业或违规用途。
- 插件部分内容（如随机图、QQ 信息查询等）来源于网络第三方接口，其数据准确性与可用性由对应来源决定，本插件不对其内容负责。
- 使用本插件所产生的一切后果由使用者自行承担。
