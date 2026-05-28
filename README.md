# ⚡ FlashBurn (闪刻) - 极简现代化物理光盘刻录与克隆桌面客户端

[![Platform](https://img.shields.io/badge/Platform-Windows-0078d4?style=flat-square&logo=windows)](https://www.microsoft.com/windows)
[![Framework](https://img.shields.io/badge/Framework-Electron-478aef?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![Language](https://img.shields.io/badge/Language-Vanilla%20JS-f7df1e?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**FlashBurn（闪刻）** 是一款专为 Windows 平台打造的、操作极简且极具仪式感的专业物理光盘刻录与 ISO 提取克隆的原生桌面应用程序。软件遵循 **Windows 11 Fluent Design 2** 视觉语言，旨在彻底淘汰沉重复杂的传统刻录软件，为用户呈现“小而美”的高级工艺品级交互体验。

本项目坚持 **100% 物理硬件独占** 与 **极致静音设计**，去除了一切鸡肋的仿真逻辑，为您带来极佳的物理刻录质感。

---

## 💎 核心产品特性

### 1. 💿 100% 物理光盘驱动（彻底移出仿真）
* **硬核物理独占**：本系统专为真实硬件刻录而生，彻底移出并清除了所有模拟/仿真光驱代码。
* **物理智能锁定**：如若系统未连接物理光驱，目标卡片列表将明确渲染为“未检测到物理驱动器”并置灰。同时，下方所有的“开始刻录”、“弹出光盘”和“擦除光盘”按钮将强制锁定置灰，杜绝任何无盘模拟写入隐患。

### 2. 🔌 智能静音降噪机制 (Quiet Mode)
* **动态焦点探测**：为了解决传统软件频繁向光驱发送读取心跳导致电机持续高速旋转与发热的问题，引入了视窗状态感知技术：
  * **切入后台/失去焦点 (`blur`)**：软件一旦处于后台或失去焦点，将**彻底注销并清除自动探测定时器**。光驱电机在 10s 内平稳减速并进入深度静音待机休眠（Standby），让环境重归安宁。
  * **重新激活/获得焦点 (`focus`)**：当您切回前台时，系统立即瞬时拉起一次 WMI 物理探测并重新启动 30 秒的探测定时器。
* **手动 🔄 刷新机制**：页面显式保留高颜值毛玻璃 `🔄 刷新` 图标按钮，支持用户在放入光盘后一击主动唤醒电机运转读盘。
* **新硬件热插拔感应**：当检测到外接物理光驱热插拔或首次接入时，系统将弹出流畅的 Fluent 气泡通知，并**自动为用户选中并锁定新设备**，减少多余点击。

### 3. 🚀 极致流畅的 60fps 窗口最大化自适应
* **剥离布局过渡（零掉帧）**：完全消除了 `.app-container` 上会导致 GPU 强制在尺寸拉伸时进行重算重绘的 `border-radius` 等布局过渡，仅保留 `background` 和 `color` 过渡。
* **递归过渡消除**：在最大化（`.maximized`）状态下，对应用窗口及内部所有后代元素强制切断 CSS 过渡动画（`transition: none !important;`）。无论是 1080p 还是 4K 全屏切换，窗口拉伸与排版铺满都达到原生级别的 **60fps 极限帧率表现**，彻底告别掉帧与拖影。

### 4. 🎯 零层级扁平直选与高饱满按键
* **目标刻录机直选卡片 (Drive Cards Grid)**：淘汰下拉框！直接以精美的扁平化网格大卡片呈现电脑上的所有物理设备。一击卡片瞬间完成切换，亮莹蓝色炫光实时反馈。
* **刻录速度胶囊按钮 (Segmented Pills)**：以胶囊形滑动分段控制器承载 `Max` | `8x` | `4x` | `2x` | `1x` 速度选项，一点击平滑贴合，缩短操作链路。
* **饱满 52px 巨型按键**：底座的操作按键整体重度大尺寸化，拉伸至 52px 物理高度，配以高对比大字符与呼吸感 Fluent 蓝色半透明软投影，交互感极强。
* **极限高度自适应压缩**：加入了智能高度压缩媒体查询 `@media (max-height: 680px)`，在将软件高度拖动到 Windows 允许的最小尺寸（900x600 像素）时，系统会自动缩减卡片间距并压缩按钮比例，**保证所有按钮和核心内容 100% 完整呈现在界面上，绝不出现任何按钮被截断或挡住的问题**。

### 5. 🎨 柔和内敛的 Fluent HSL 阴影设计
* 彻底淡化了深色模式下过于生硬和高饱和度的蓝色外发光硬边投影。
* 全局 `--accent-glow` 降解为仅 `rgba(10, 132, 255, 0.12)` 的软性高斯微投影，搭配超细发光边框，在光影上将毛玻璃和亮暗亚克力材质烘托得更加细腻温润。

---

## ⚡ 架构设计与性能优化要点

1. **Vanilla Core（极速前端引擎）**：
   本系统前端采用 **100% 纯原生 HTML5 / ES6 JavaScript / Vanilla CSS** 开发，**完全没有引入 React、Vue、Tailwind、jQuery 等任何第三方沉重的前端框架与依赖**。这保证了渲染进程拥有最低的内存开销与绝对干净的 DOM 结构，启动毫秒级，执行速度极快。
2. **物理系统级集成 (Built-in Windows COM/IMAPI2)**：
   本程序**不打包任何庞大的第三方物理刻录 DLL，也无多余的驱动级底层安装包**。
   * 软件后台基于 Electron 主进程，通过 PowerShell 直接绑定 Windows 系统内核自带的 **MsftDiscFormat2Data (IMAPI2)** 物理烧录接口与 **WMI** 设备接口，调用系统底层自带资源完成扇区级的烧录与 ISO 对拷克隆。因此，软件的体积和稳定性得到了极佳的控制。

---

## 📂 项目结构说明

```
├── package.json        # 项目属性、 electron-builder 单免安装构建配置
├── main.js             # Electron 主进程 (生命周期、无边框窗体控制、PowerShell 底层总线调用)
├── preload.js          # 安全上下文桥接 (物理光驱底层 WMI/IMAPI2 接口映射)
├── index.html          # Windows 11 Fluent 页面骨架结构 (0框架 vanilla HTML5)
├── renderer.js         # 纯原生交互驱动 (硬件列表热重载、Quiet静音休眠、文件拖拽 API 解析)
├── styles.css          # Fluent 核心设计系统 (包含高度自适应、最大化60fps重画、HSL软投影)
├── detect_drives.ps1   # Native Windows COM 物理刻录总线交互脚本 (IMAPI2)
└── README.md           # 项目开源说明文档
```

---

## 🛠️ 本地运行与构建 (EXE 打包) 步骤

### 1. 克隆并安装依赖
在安装了 Node.js 的 Windows 电脑上，克隆项目后运行：
```bash
npm install
```

### 2. 开发调试运行
启动无边框的亚克力质感桌面客户端：
```bash
npm start
```

### 3. 构建 Portable 单文件独立版 `.exe`
运行以下命令：
```bash
npm run dist
```
构建引擎会自动执行并绕过 Windows 的软链接安全限制。打包完成后，会在根目录下的 `./dist` 文件夹中生成唯一的 **`FlashBurn 1.0.0.exe`** 独立免安装程序 (约 70MB)。
直接将其拷贝走分发至任何 Windows 电脑上，即可双击极速启动，享受物理刻录的极致快感！

---

## ⚖️ 开源协议

本项目采用 **MIT License** 许可协议开源，完整协议内容请查阅项目中的 `LICENSE` 文件。
