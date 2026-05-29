# Prompt Manager

AI 提示词管理器，让你快速复制、编辑、优化提示词。

## 功能特性

- ⚡ **快速复制**：单击提示词即可复制到剪贴板
- 📁 **分类管理**：22 种预设分类 + 自定义分类
- 🔍 **实时搜索**：快速搜索标题和内容
- ✨ **AI 润色**：调用 AI API 优化提示词
- 🌐 **多语言**：支持中文和 English
- 📥 **导入导出**：JSON 文件备份和恢复
- 🔄 **更新通知**：GitHub API 检测新版本

## 安装方法

### 首次安装

1. 访问 [Releases](https://github.com/用户名/prompt-manager/releases) 页面
2. 下载最新版本的 `.zip` 文件并解压
3. 打开 Chrome 浏览器，访问 `chrome://extensions`
4. 开启右上角的"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择解压后的文件夹

### 更新

1. 插件会自动检测新版本
2. 点击 Popup 顶部的更新提示
3. 下载新版本并解压
4. 在 `chrome://extensions` 页面点击"重新加载"

## 使用方法

### 快速复制

1. 点击浏览器工具栏的插件图标
2. 浏览或搜索提示词
3. 单击提示词即可复制到剪贴板

### 管理提示词

1. 点击插件图标，点击 ⚙️ 设置按钮
2. 在 Options 页面可以：
   - 新建、编辑、删除提示词
   - 管理分类
   - 配置 API
   - 使用 AI 润色功能

### AI 润色

1. 在 Options 页面，点击提示词的"✨ AI 润色"按钮
2. 选择优化方向
3. 点击"开始润色"
4. 查看优化结果，点击"使用优化结果"

## 配置 API

1. 在 Options 页面，点击"⚙️ API 配置"
2. 填写 API 地址、Key、模型名称
3. 点击"测试连接"验证配置
4. 点击"保存配置"

支持的 API：
- OpenAI (GPT-4, GPT-3.5)
- Claude
- 通义千问
- 其他 OpenAI 兼容 API

## 技术栈

- HTML + CSS + JavaScript (原生)
- Chrome Manifest V3
- chrome.storage.local
- chrome.i18n

## 开发

```bash
# 克隆仓库
git clone https://github.com/用户名/prompt-manager.git

# 在 Chrome 中加载
1. 打开 chrome://extensions
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目文件夹
```

## 许可证

MIT License
