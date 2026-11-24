# 专家 · DSH Experts

把 DSH 里已有的专家组织成目录，在聊天框里为当前任务选对专家。

简体中文 · [English](README.en.md) · [快速安装](#快速安装) · [使用与配置](#使用与配置) · [更新记录](CHANGELOG.md) · [开源协议](#开源协议)

[![版本 0.3.0](https://img.shields.io/badge/版本-0.3.0-0078D4)](CHANGELOG.md)
[![DSH Desktop 0.2.2-rc.5](https://img.shields.io/badge/DSH_Desktop-0.2.2--rc.5-4658C5)](#兼容性)
![简体中文与 English](https://img.shields.io/badge/语言-简体中文%20%2F%20English-087F69)
[![MIT](https://img.shields.io/badge/许可证-MIT-3E7954)](LICENSE)

这是面向 DeepSeek Harness（DSH）桌面端的独立社区插件。目录从当前 DSH 实例读取已注册的 Agent Preset，专家的角色、工具和技能由各自的预设提供。

## 功能概览

- **管理专家目录**。在左侧「专家管理」按卡片浏览头像、名称和简介。支持刷新已安装的专家、新建或重命名分类，以及为同一专家添加多个标签。
- **在聊天框里选专家**。从底部权限控件右侧打开双栏选择器。左栏搜分类，右栏按名称或别名筛专家。鼠标悬停或键盘聚焦可读简介。
- **带着草稿换专家**。空白会话原地切换。已开始的会话会在同一工作区打开目标专家会话，原会话保留历史与草稿副本。纯文本可预填到空稿目标，附件和结构化引用留在原会话。

## 快速安装

| 来源 | 操作 |
| --- | --- |
| GitHub Releases | 下载 [`dsh-experts-0.3.0.tgz`](https://github.com/leunghappy/dsh-experts/releases/tag/v0.3.0)。Windows 和 macOS 的 DSH Desktop 使用同一组合包，可在「插件」页安装。 |
| 社区 dsh-market | 社区目录收录后，在 dsh-market 中搜索 `dsh-experts` 或「专家」，核对来源和兼容版本后安装。 |
| DSH 原生「发现」 | 启用「自定义插件索引」，添加发布者提供的 HTTPS 索引地址，再搜索并安装。 |

已下载本地组合包时，也可在终端安装。将 `desktop` 换成实际使用的 profile 名称。

```sh
dsh plugin --profile desktop add "./dsh-experts-0.3.0.tgz"
```

## 使用与配置

1. 打开「专家管理」创建分类，为已有专家添加标签。新增 Agent Preset 后点击「刷新本地专家」。
2. 在聊天框底部打开选择器，选好专家并确认按钮显示目标名称，然后发送消息。
3. 如需维护双语名称、简介、别名或头像，修改源码中的 `src/expert-metadata.json`，重新构建。分类和标签保存在当前客户端。

[完整使用说明](docs/DETAIL.zh.md) · [中英文配置样例](examples/expert-metadata.json)

## 兼容性

当前包版本为 `0.3.0`，兼容范围声明为 **DSH Desktop 0.2.2-rc.5**。管理页和选择器随 DSH 的中英文设置切换。原生 `@` 专家和 Web 客户端适配暂缓。

## 本地开发

```sh
npm ci
npm test
npm pack --pack-destination dist
```

`prepare` 从源码生成 `dist/client.js`。

## 开源协议

本插件采用 [MIT 许可证](LICENSE)。复制或分发本软件或其实质性部分时，应保留版权和许可声明。
