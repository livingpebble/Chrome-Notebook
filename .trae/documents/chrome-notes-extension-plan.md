# Chrome 浏览器笔记插件扩展 - 实现计划

## 1. 项目概述

**项目名称**: QuickNotes - 快速笔记扩展  
**目标**: 创建可安装的Chrome扩展，让用户随时记录纯文本笔记  
**核心功能**: 笔记存储在插件目录的notebooks文件夹下的txt文件中  

## 2. 技术方案

### 2.1 Chrome扩展架构
- **Manifest V3**: 使用最新的Chrome扩展清单版本
- **存储方案**: 使用 `chrome.fileSystemProvider` API 实现文件系统访问
  - notebooks目录位于扩展安装目录下
  - 每个笔记对应一个txt文件
  - 使用chrome.fileSystem API持久化目录访问权限

### 2.2 文件结构
```
quick-notes-extension/
├── manifest.json          # 扩展配置清单
├── background.js          # 后台服务脚本
├── popup.html            # 弹出窗口界面
├── popup.js              # 弹出窗口逻辑
├── popup.css             # 样式文件
├── notebooks/            # 笔记存储目录（自动创建）
│   ├── note1.txt
│   ├── note2.txt
│   └── ...
└── icons/                # 扩展图标
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 3. 功能模块

### 3.1 核心功能
1. **笔记编辑**
   - 简洁的文本编辑器
   - 标题栏显示当前文件名
   - 自动保存（输入后1.5秒自动保存）
   - 保存状态指示器

2. **文件管理**
   - 创建新笔记（输入文件名）
   - 打开已有笔记
   - 删除笔记（带确认）
   - 重命名笔记

3. **历史查询**
   - 笔记列表（按修改时间降序）
   - 显示每个笔记的名称和修改时间
   - 文件名搜索功能

### 3.2 用户界面

#### 主界面（popup.html）
- **顶部**: 工具栏
  - 新建笔记按钮
  - 搜索框
  - 设置按钮
  
- **中间**: 编辑区域
  - 笔记列表（可收起/展开）
  - 文本编辑区
  - 保存状态指示

- **底部**: 状态栏
  - 当前文件名
  - 修改时间
  - 字数统计

#### 样式设计
- 简洁现代的设计风格
- 宽度: 500px
- 高度: 600px
- 配色: 白色背景，灰色边框，蓝色强调色

## 4. 实现细节

### 4.1 manifest.json 配置
```json
{
  "manifest_version": 3,
  "name": "QuickNotes",
  "version": "1.0",
  "description": "快速笔记扩展 - 记录灵感碎片",
  "permissions": [
    "fileSystemProvider",
    "fileSystem"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### 4.2 核心API交互

#### 文件系统访问流程
1. 使用 `chrome.fileSystem.getWritableEntry()` 获取notebooks目录
2. 如果是首次使用，使用 `chrome.fileSystem.chooseEntry()` 让用户授权
3. 将授权信息存储到 `chrome.storage.local` 以便后续使用
4. 读取/写入时使用 `fileEntry.file()` 和 `FileReader/FileWriter`

#### 笔记操作
- **创建**: 输入文件名 → 写入空txt文件 → 打开编辑
- **打开**: 从列表选择 → 读取文件内容 → 显示在编辑器
- **保存**: 定时器检测输入 → 覆盖写入txt文件 → 更新状态
- **删除**: 确认对话框 → 调用 `entry.remove()` → 刷新列表

### 4.3 数据流

```
用户输入 → 自动保存计时器 → FileWriter → txt文件
                                    ↓
txt文件 ← FileReader ← 选择文件 ← 文件列表 ← 读取目录
```

## 5. 关键代码实现

### 5.1 文件系统初始化 (background.js)
```javascript
// 检查并初始化notebooks目录
// 持久化目录访问权限
```

### 5.2 笔记管理逻辑 (popup.js)
```javascript
class NoteManager {
  constructor()
  async init()           // 初始化文件系统
  async createNote()     // 创建新笔记
  async openNote()       // 打开笔记
  async saveNote()       // 保存笔记
  async deleteNote()     // 删除笔记
  async listNotes()      // 列出所有笔记
  async searchNotes()    // 搜索笔记
}
```

### 5.3 UI事件处理 (popup.js)
```javascript
// 自动保存逻辑
// 笔记列表渲染
// 搜索过滤
// 工具栏按钮事件
```

## 6. 错误处理

### 6.1 文件系统错误
- 用户未授权: 提示并引导重新授权
- 文件不存在: 显示错误消息并刷新列表
- 写入失败: 显示保存失败提示，提供重试选项

### 6.2 UI反馈
- 保存成功: 绿色状态指示
- 保存失败: 红色警告 + 重试按钮
- 文件操作中: 加载动画

## 7. 验收标准

### 7.1 功能验证
✅ 插件可以正常安装到Chrome  
✅ 首次使用可以成功授权文件系统访问  
✅ 可以创建新的笔记（输入文件名）  
✅ 笔记内容保存到notebooks目录的txt文件  
✅ 默认打开最新的笔记  
✅ 可以查看历史笔记列表  
✅ 可以搜索笔记  
✅ 可以删除笔记  
✅ 自动保存功能正常  

### 7.2 界面验证
✅ 简洁清晰的文本编辑器  
✅ 工具栏功能完整  
✅ 笔记列表显示修改时间  
✅ 保存状态清晰可见  

### 7.3 稳定性验证
✅ 长时间输入不丢失数据  
✅ 多次打开关闭扩展数据保持一致  
✅ 文件系统权限保持有效  

## 8. 实现步骤

### 步骤1: 项目初始化
- 创建项目目录结构
- 创建manifest.json配置文件
- 准备扩展图标

### 步骤2: 核心功能实现
- 实现文件系统的初始化和授权
- 实现笔记的创建、打开、保存、删除
- 实现自动保存功能

### 步骤3: UI界面实现
- 实现popup.html结构
- 实现popup.css样式
- 实现popup.js交互逻辑

### 步骤4: 高级功能
- 实现笔记列表和搜索功能
- 实现文件名输入和验证
- 优化用户体验和错误处理

### 步骤5: 测试和优化
- 在Chrome中测试所有功能
- 优化性能和稳定性
- 完善错误处理
