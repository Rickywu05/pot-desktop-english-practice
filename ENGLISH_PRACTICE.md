# Pot 英语表达练习版

这是 Pot 的非官方个人修改版，基于官方 `master` 分支提交 `594d32e` 开发。

## 新增功能

- 点击翻译窗口顶栏的学士帽按钮，在原窗口右侧展开或收起英语表达练习区。
- 左右区域等宽；收起后恢复 Pot 原有窗口大小。
- 在右上框输入自己的英文，点击 AI 检查按钮或按 `Ctrl + Enter`。
- AI 会根据左侧中文原文检查英文是否准确、自然，并在右下框给出修改建议。
- 可以选择 Pot 中已经配置的 OpenAI-compatible 翻译服务，并记住所选服务实例。
- 支持普通响应和兼容的流式响应；结果支持 Markdown 和复制。

## AI 服务

练习区复用 Pot 的 OpenAI 服务配置，包括 Base URL、API Key、模型名称、自定义参数、请求头和流式设置。它使用标准文本 Chat Completions 请求，不写死服务商或模型名，可用于 DeepSeek、小米 MiMo及其他兼容服务。

请先在 Pot 设置中添加并启用一个 OpenAI 服务，然后在练习区选择它。中文原文和用户英文会发送给所选的第三方模型服务，请注意隐私和服务费用。

## 本地开发

环境要求与原项目相同：Node.js 18 或更高版本、pnpm 8.5 或更高版本、Rust 1.80 或更高版本。

```powershell
pnpm install
pnpm tauri dev
```

Windows 安装包可在本仓库的 Releases 页面下载。此个人构建未使用 Pot 官方代码签名，Windows 可能显示未知发布者提示。

## 上游项目与许可证

- 上游项目：https://github.com/pot-app/pot-desktop
- 许可证：GPL-3.0

本仓库不是 Pot 官方发布渠道。如需报告本修改版新增功能的问题，请在本仓库反馈。
