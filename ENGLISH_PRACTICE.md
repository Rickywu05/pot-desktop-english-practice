# Pot 英语表达练习版

这是 Pot 的非官方个人修改版，基于官方 `master` 分支提交 `594d32e` 开发。

## 新增功能

- 点击翻译窗口顶栏的学士帽按钮，在原窗口右侧展开或收起英语表达练习区。
- 左右区域等宽；收起后恢复 Pot 原有窗口大小。
- 在右上框输入自己的英文，点击 AI 检查按钮或按 `Ctrl + Enter`。
- AI 会根据左侧中文原文检查英文是否准确、自然，并在右下框给出修改建议。
- 可以选择 Pot 中已经配置的 OpenAI-compatible 翻译服务，并记住所选服务实例。
- 支持普通响应和兼容的流式响应；结果支持 Markdown 和复制。
- 检查结果会在左侧普通翻译后继续保留；相同中文、英文和模型会直接复用已有结果，不重复调用 AI。
- 当前练习模型只用于右侧检查，不会生成左侧翻译卡片。
- 英文输入框关闭浏览器拼写检查，AI 忽略不影响表达的中英文标点样式差异。

## AI 服务

OpenAI 服务配置内置 GLM、Kimi、MiniMax、DeepSeek 和小米 MiMo 五个预设。选择服务后，请求地址、模型名称、认证方式和兼容参数会自动填写，通常只需输入 API Key 并保存。

如供应商以后更换接口或模型，可展开“高级设置”手动调整。练习区仍复用这套配置，并通过标准文本 Chat Completions 请求发送中文原文和用户英文。

请先在 Pot 设置中添加一个 OpenAI-compatible 服务，填写 API Key 后可以先点击“测试连接”，确认成功后再保存。练习区会自动恢复已经配置但尚未加入服务列表的兼容实例，并默认选择第一个可用实例；用户也可以自行切换，所选服务实例 ID 会保存到本地配置。

中文原文和用户英文会发送给所选的第三方模型服务，请注意隐私、余额、限流和调用费用。项目不会在日志中主动输出完整 API Key，也不应将本地配置文件或包含密钥的截图提交到仓库。

## 下载与使用

- 项目主页：https://github.com/Rickywu05/pot-desktop-english-practice
- 安装包与版本说明：https://github.com/Rickywu05/pot-desktop-english-practice/releases
- 当前预览版：Preview 4（Windows x64）

Preview 4 安装包尚未使用商业代码签名证书，Windows 可能显示未知发布者。本修改版与官方 Pot 使用相同的应用标识和本地配置目录，覆盖安装前建议备份重要配置。

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
