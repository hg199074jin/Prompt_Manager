# Prompt Manager

AI 提示词管理器 — 快速复制、编辑、优化你的提示词，支持坚果云多端同步。

## 功能特性

### 核心功能

- **快速复制** — 单击提示词即可复制到剪贴板，按使用频率自动排序
- **分类管理** — 22 种预设分类 + 自定义分类，支持手动拖拽排序
- **实时搜索** — 快速搜索标题和内容
- **批量操作** — 全选、批量删除提示词

### AI 润色

- 调用 AI API 一键优化提示词
- 支持 4 种优化方向：角色设定、输出要求、示例参考、约束条件
- 兼容 OpenAI、Claude、通义千问等 OpenAI 格式 API

### 坚果云同步

- 通过 WebDAV 协议自动同步提示词、分类、API 配置等数据
- 启动时自动拉取远程数据，编辑后 15 秒自动推送
- 支持定时拉取（默认 2 小时，可配置 5-1440 分钟）
- 内容哈希检测，无变化时跳过上传，节省流量

### 其他

- 多语言支持（中文 / English）
- JSON 文件导入导出备份
- GitHub API 自动检测新版本
- 侧边栏宽度可拖拽调节

## 安装方法

### 首次安装

1. 访问 [Releases](https://github.com/hg199074jin/Prompt_Manager/releases) 页面
2. 下载最新版本的 `.zip` 文件并解压
3. 打开 Chrome 浏览器，访问 `chrome://extensions`
4. 开启右上角的"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择解压后的文件夹

### 更新

1. 插件会自动检测新版本（Popup 顶部显示更新提示）
2. 下载新版本并解压覆盖
3. 在 `chrome://extensions` 页面点击"重新加载"

## 使用方法

### 快速复制

1. 点击浏览器工具栏的插件图标
2. 浏览分类或搜索提示词
3. 单击提示词即可复制到剪贴板（使用频率自动提升排序）

### 管理提示词

1. 点击插件图标，点击设置按钮进入 Options 页面
2. 在 Options 页面可以：
   - 新建、编辑、删除提示词
   - 管理分类（添加、编辑、删除、排序）
   - 使用 AI 润色功能优化提示词
   - 配置 API 和坚果云同步

### 坚果云同步配置

1. 在坚果云客户端（Win/Mac）新建一个同步文件夹（如 `Prompt_Extension`）
2. 在坚果云网页端「安全选项」中生成应用密码
3. 在 Options 页面点击「同步设置」按钮
4. 填写配置：
   - 服务器地址：`https://dav.jianguoyun.com/dav`（不含用户名）
   - 用户名：你的坚果云邮箱
   - 应用密码：步骤 2 生成的密码
   - 远程文件路径：`/Prompt_Extension/prompt-manager-sync.json`
5. 点击「测试连接」验证后保存
6. 点击「立即同步」首次上传数据

> 坚果云免费账户每月 1GB 上传流量，提示词文件极小，完全够用。

### 配置 AI API

1. 在 Options 页面点击「API 配置」按钮
2. 填写 API 地址、Key、模型名称
3. 点击「测试连接」验证配置
4. 保存后即可使用 AI 润色功能

支持的 API：
- OpenAI（GPT-4、GPT-3.5）
- Claude
- 通义千问
- 其他 OpenAI 兼容格式 API

## 技术栈

- HTML + CSS + JavaScript（原生，无框架）
- Chrome Manifest V3
- chrome.storage.local 数据存储
- WebDAV 协议（坚果云同步）
- chrome.i18n 国际化

## 项目结构

```
prompt-manager/
  manifest.json        # 扩展配置
  background.js        # Service Worker（AI 润色 + WebDAV 同步引擎）
  popup.html/css/js    # 弹窗界面
  options.html/css/js  # 设置页面
  storage.js           # 数据存储层
  icons/               # 扩展图标
  _locales/            # 国际化文件
```

## 开发

```bash
# 克隆仓库
git clone https://github.com/hg199074jin/Prompt_Manager.git

# 在 Chrome 中加载
# 1. 打开 chrome://extensions
# 2. 开启"开发者模式"
# 3. 点击"加载已解压的扩展程序"
# 4. 选择 prompt-manager 文件夹
```

## 许可证

MIT License
