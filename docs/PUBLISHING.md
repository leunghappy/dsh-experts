# GitHub 发布与 DSH 社区市场收录

[English](#english)

## 中文

建议将本目录作为独立公开仓库 `OWNER/dsh-experts` 的根目录。首发使用 GitHub Release 的预构建安装包，向 `awesome-dsh-plugin` 提交目录条目。自有索引可用于发布验收，也可作为另一个安装入口。[dsh-market 的投稿说明](https://github.com/dsh-market/dsh-market#submit-your-plugin) · [DSH 原生索引文档](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.5/docs/user/guide/plugin-market.zh.md)

### 1. 建仓与首次提交

| 仓库设置 | 建议 |
| --- | --- |
| 仓库名与分支 | `dsh-experts`，公开仓库，默认分支 `main`。 |
| GitHub About | 「在 DeepSeek Harness 桌面端管理专家目录，并为会话选择专家。」 |
| GitHub Topics | 添加 `dsh-plugin`，这是社区目录的收录要求。可补充 `deepseek-harness` 和 `agent-preset`。 |
| 许可证 | 根目录 `LICENSE` 与 `package.json` 声明 MIT，中英文 README 链接同一份许可文本。 |
| 源码范围 | 提交插件源码、DSH 清单、锁文件、测试和双语文档。用独立目录避免将上层项目的其他插件和内部资料一并公开。 |
| 后续维护 | 可以启用 Issues 收集问题，用 GitHub Actions 在 PR 上运行 `npm ci` 和 `npm test`。正式版本通过 Release 和更新记录发布。 |

在 GitHub 创建空仓库，将本目录作为初始源码。当前已有 README 和许可证，建仓时使用空仓库选项。审核待提交文件，排除本地缓存、凭据、用户目录、真实对话与个人配置。构建目录和依赖目录由 `.gitignore` 排除。[GitHub 源码导入指南](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github) · [社区目录规则](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md#adding-a-plugin--收录插件)

首次提交可在独立的插件目录执行以下命令。其中 `OWNER` 换成实际账号或组织。

```sh
git init -b main
git add -- .gitignore LICENSE README.md README.en.md CHANGELOG.md package.json package-lock.json cordis.patch.yml host.js src scripts test locale docs examples
git diff --cached --stat
git diff --cached --check
git commit -m "feat: release DSH Experts 0.3.0"
git remote add origin https://github.com/OWNER/dsh-experts.git
git push -u origin main
```

README 首屏依次展示用途、中英文导航、版本、兼容范围和许可证，下面提供真实功能、安装步骤、配置样例。公开截图建议用干净测试 profile 拍摄「专家管理」和双栏选择器各一张，使用演示专家。图片提交到仓库后，可同时用于 README 和仓库根的 `screenshots.json`，后者列出相对于仓库根的实际图片路径。[README 结构参考](https://github.com/MichengAI/dsh-agency-agents) · [社区市场截图规范](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)

### 2. 发 GitHub Release

以正式发布的提交打 `v0.3.0` 标签，Release 标题可用「DSH Experts 0.3.0」。描述从[更新记录](../CHANGELOG.md)提取版本变化，明确支持 DSH Desktop `0.2.2-rc.5`。预构建安装包使用稳定文件名 `dsh-experts.tgz`，包内版本仍为 `0.3.0`。今后每个 Release 都使用该资产名，社区条目的 `latest/download` 链接即可延续。[GitHub Release 操作](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) · [社区安装包链接约定](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)

```sh
npm ci
npm test
npm pack --pack-destination dist
cp dist/dsh-experts-0.3.0.tgz dist/dsh-experts.tgz
git tag -a v0.3.0 -m "DSH Experts 0.3.0"
git push origin v0.3.0
```

在 GitHub 的 Releases 页面选择该标签，将 `dist/dsh-experts.tgz` 添加为发布资产。用干净的 Desktop profile 从 Release 下载并安装，确认插件能启用、管理页和选择器可用、会话切换及草稿保留正常，并切换中英文核对界面和详情。

本地联调记录涵盖 `0.1.0` 的入口挂载、`0.1.1` 的桌面 UI 和 `0.2.0` 的会话功能。`0.3.0` 已验证固定 Git 提交安装，以及模拟界面的语言切换。公开发行资产的安装结果和公开市场的可发现性以发布后的复测为准。

### 3. 申请社区 dsh-market 收录

公开仓库创建满一天并带有 `dsh-plugin` Topic 后，Fork `awesome-dsh-plugin/awesome-dsh-plugin`。在投稿分支新增 `data/plugins/OWNER__dsh-experts.yml`，替换下列 `OWNER`，然后针对上游 `main` 提交 PR。仓库已有 `dsh.bundle` 声明和实现代码。社区评审会核对清单和功能描述，生成的 README 将随目录更新。[社区投稿规则](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md#adding-a-plugin--收录插件)

```yaml
url: https://github.com/OWNER/dsh-experts
name: OWNER/dsh-experts
category: ui
description:
  en: Organizes installed Agent Presets by category and switches conversation experts in DeepSeek Harness Desktop while preserving drafts.
  zh: 在 DeepSeek Harness 桌面端分类管理已安装的专家，并在保留草稿的情况下切换会话专家。
tarball: https://github.com/OWNER/dsh-experts/releases/latest/download/dsh-experts.tgz
```

PR 标题可用 `Add dsh-experts to the plugin catalog`。正文附仓库与 Release，注明已验收的 Desktop 版本，简单说明从插件页安装和检查专家选择的步骤。PR 合并后，在 dsh-market 中搜索插件，检查详情来源、版本和安装按钮。GitHub Topics 提供仓库发现入口，dsh-market 的收录以目录合并为准。npm 是该目录支持的可选分发方式。后续若发布 npm 包，在包清单的 `repository` 字段填写与条目一致的公开仓库地址，供目录关联。[dsh-market 的目录来源](https://github.com/dsh-market/dsh-market#submit-your-plugin) · [社区 npm 关联规则](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md#npm-package--npm-包optional--可选)

### 4. 可选的自有「发现」索引

要在社区评审期间开放给测试者，可生成独立的索引文件。仓库地址和提交必须对应已推送的公开标签。原生索引以 Git 提交作为安装来源，源码安装可能要求用户授权构建。预构建 `.tgz` 走上面的 Release 下载和社区投稿路径。[原生索引来源格式](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.5/docs/user/guide/plugin-market.zh.md)

```sh
npm run market:index -- \
  --repository https://github.com/OWNER/dsh-experts \
  --commit "$(git rev-list -n 1 v0.3.0)"
```

发布 `dist/market/index.json` 到 GitHub Pages 或其他 HTTPS 静态站点。GitHub Pages 可以部署一个仅放公开索引文件的分支。确认公开 URL 直接返回 UTF-8 JSON，再在「插件 → 发现」添加索引。在一个干净 profile 搜索并核对版本、来源和安装结果。重建同一版本的索引时用 `--published-at` 保留原发布时间。[GitHub Pages 部署指南](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

<a id="english"></a>
## English

1. Create a public `OWNER/dsh-experts` repository with `main` as the default branch. Use this directory as the repository root. Add the `dsh-plugin` topic, review the staged files, and push the plugin source. The root MIT license and both README files are ready to commit.
2. Run the build and test commands above, tag the release `v0.3.0`, and attach the prebuilt package to the GitHub Release as `dsh-experts.tgz`. Keep the asset name stable across releases. Verify installation, locale switching, and draft handling in a clean DSH Desktop `0.2.2-rc.5` profile.
3. Once the public repository is at least one day old, submit the YAML shown above as `data/plugins/OWNER__dsh-experts.yml` in the `awesome-dsh-plugin` repository. Use the `ui` category and the prebuilt Release URL. After the PR merges and the catalog syncs, verify discovery and installation in dsh-market.
4. For a separate DSH Discover index, generate `dist/market/index.json` with the pinned release commit and serve it over HTTPS. Add that URL under **Plugins → Discover**. Git-source installation can ask for build approval.

[Community submission rules](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) · [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) · [DSH plugin indexes](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.5/docs/user/guide/plugin-market.md)
