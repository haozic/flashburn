# ⚡ FlashBurn - Windows 物理光盘刻录工具

[![Platform](https://img.shields.io/badge/Platform-Windows-0078d4?style=flat-square&logo=windows)](https://www.microsoft.com/windows)
[![Framework](https://img.shields.io/badge/Framework-Electron-478aef?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![Language](https://img.shields.io/badge/Language-Vanilla%20JS-f7df1e?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

FlashBurn 是一款为 Windows 打造的轻量级 CD/DVD 刻录工具，采用 Windows 11 Fluent Design 视觉语言。100% 原生物理硬件支持，无需第三方驱动。

## ✨ 特性

- **100% 物理硬件支持** - 基于 Windows IMAPI2 系统接口，无仿真驱动
- **极致静音设计** - 智能焦点探测，后台自动休眠光驱电机
- **60fps 流畅界面** - 优化的窗口最大化性能，支持 4K 分辨率
- **Fluent Design UI** - 原生 Windows 11 视觉风格，毛玻璃亚克力材质
- **零依赖前端** - 100% Vanilla HTML/CSS/JS，无 React/Vue/Tailwind
- **轻量独立程序** - ~70MB 便携式 EXE，无需安装

## 🚀 快速开始

### 运行
\\\ash
npm install
npm start
\\\`n
### 构建 EXE
\\\ash
npm run dist
\\\`n生成的 \FlashBurn 1.0.0.exe\ 可直接在任何 Windows 电脑上运行。

## 📁 项目结构

\\\`n├── main.js           # Electron 主进程
├── preload.js        # IPC 安全桥接
├── renderer.js       # 前端交互逻辑
├── index.html        # UI 页面
├── styles.css        # Fluent Design 样式
├── detect_drives.ps1 # Windows COM/IMAPI2 调用脚本
└── package.json      # 项目配置
\\\`n
## ⚖️ 许可

MIT License
