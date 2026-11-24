# DSH Experts

Organize your existing DSH experts and choose the right one from the chat composer.

[简体中文](README.md) · English · [Quick install](#quick-install) · [Use and configuration](#use-and-configuration) · [Changelog](CHANGELOG.md) · [License](#license)

[![Version 0.3.0](https://img.shields.io/badge/version-0.3.0-0078D4)](CHANGELOG.md)
[![DSH Desktop 0.2.2-rc.5](https://img.shields.io/badge/DSH_Desktop-0.2.2--rc.5-4658C5)](#compatibility)
![Chinese and English](https://img.shields.io/badge/languages-Chinese%20%2F%20English-087F69)
[![MIT](https://img.shields.io/badge/license-MIT-3E7954)](LICENSE)

Experts is an independent community plugin for DeepSeek Harness Desktop. It lists the Agent Presets registered in your DSH instance. Each preset supplies its own role, tools, and skills.

## Features

- **Manage your experts.** Browse cards with avatars, names, and descriptions. Refresh the directory, create or rename categories, and assign multiple tags.
- **Choose from the composer.** Open the picker next to permissions. Search categories on the left and expert names or aliases on the right. Hover or focus a result for its description.
- **Keep your draft.** Change experts in place for a blank chat. For a started chat, open an expert chat in the same workspace and keep the original chat and its draft. A plain-text draft can prefill an empty target. Attachments and structured references stay in the original chat.

## Quick install

| Source | Steps |
| --- | --- |
| GitHub Releases | Download [`dsh-experts-0.3.0.tgz`](https://github.com/leunghappy/dsh-experts/releases/tag/v0.3.0) and add it in **Plugins**. The same bundle serves DSH Desktop on Windows and macOS. |
| Community dsh-market | After the catalog lists the plugin, search for `dsh-experts` or **Experts** and confirm the source and compatible version. |
| DSH Discover | Enable **Custom plugin indexes**, add the publisher's HTTPS index URL, then search and install. |

You can also install a downloaded package from the terminal. Replace `desktop` with your DSH profile name.

```sh
dsh plugin --profile desktop add "./dsh-experts-0.3.0.tgz"
```

## Use and configuration

Open **Manage experts** to create categories and tag existing experts. After adding an Agent Preset, select **Refresh local experts**. Choose an expert from the composer and wait for its name to appear before sending. To maintain bilingual display names, descriptions, aliases, and avatars, edit `src/expert-metadata.json` in the source and rebuild. Your client stores categories and tags locally.

[User guide](docs/DETAIL.en.md) · [Bilingual configuration example](examples/expert-metadata.json)

## Compatibility

Version `0.3.0` declares support for **DSH Desktop 0.2.2-rc.5**. The manager and picker follow the DSH setting for Chinese and English. Native `@` expert mentions and the Web client are deferred.

## Development

```sh
npm ci
npm test
npm pack --pack-destination dist
```

The `prepare` script builds `dist/client.js` from source.

## License

This plugin is available under the [MIT License](LICENSE). Preserve the copyright and license notices when redistributing the software or a substantial portion of it.
