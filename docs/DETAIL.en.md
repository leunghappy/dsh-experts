# Experts

An expert is an Agent Preset already registered in DeepSeek Harness. Its role, tools, and skills come from the preset. The plugin adds a category directory and a conversation picker to DSH Desktop.

## Use the plugin

1. Open **Manage experts** in the sidebar to browse avatars, names, and descriptions. Create categories and assign multiple tags to an expert.
2. Open the expert picker next to permissions at the bottom of the composer. Search for a category on the left, then filter the expert names and aliases on the right. Hover or focus an entry to read its description.
3. In a blank chat, choose an expert and wait for its name to appear before sending. In a chat that has already started, choosing an expert opens a chat in the same workspace.

A plain-text draft can be copied to an empty target draft. The original chat keeps its copy. If the target already has a draft, you can return to the original chat or copy the text. Attachments and structured references stay in the original chat.

## Configuration example

The directory reads the Agent Presets registered with the connected DSH instance. After installing a preset, choose **Refresh local experts**. Edit categories and tags in **Manage experts**. Your client stores them locally. Package maintainers can add display names, descriptions, and aliases in `src/expert-metadata.json`, then rebuild or install the updated package.

```json
{
  "your-preset-id": {
    "name": { "zh": "SQL 审查专家", "en": "SQL review expert" },
    "description": { "zh": "审查 SQL 的正确性和性能。", "en": "Reviews SQL for correctness and performance." },
    "aliases": ["SQL审查", "SQL review"]
  }
}
```

Replace `your-preset-id` with the ID of an existing preset. Both `name` and `description` also accept a single string. Omit them to use the values from DSH. You can search using aliases in either language. An optional `avatar` accepts an image URL that the client can open.

## Compatibility

The current verification target is DSH Desktop `0.2.2-rc.5`. The interface follows the DSH language setting for Chinese and English. The native `@` expert picker and Web client support are deferred.
