# 逸美桌宠完整维护项目

这里归档当前实际使用的维护源码与 canonical 素材。适配器 revision=9，已知兼容基线为官方 Codex 26.1029.7803.0 / 内部版本 26.1029.61003；未知版本仍需通过结构及播放检查。

| 路径 | 用途 |
| --- | --- |
| `artwork/` | 全部当前原始字节素材、动作元数据与超分 QA 报告 |
| `engine.mjs` / `rspack-adapter.mjs` | Vite/Rspack 识别、适配、独立副本构建与验证 |
| `templates/` | 播放器、补丁模板、真实浏览器播放和行为测试 |
| `Launch-Codex-Yimei.ps1` / `launcher-core.ps1` | 固定版本启动、冲突检查与完整性验证 |
| `manual-upgrade-core.ps1` / `Manual-Upgrade-Worker.ps1` | 手动适配、验证、发布固定版本与失败回退 |
| `manual-upgrader/Program.cs` | Windows 手动升级窗口源码 |
| `Build-Manual-Upgrader.ps1` / `Yimei-Manual-Upgrade.exe` | 窗口编译入口与自有编译产物 |
| `Test-*.ps1` / `test-*.mjs` | 固定入口、升级、working、16 向、模块及进程保护回归 |
| `super-resolution/` | 既有超分、细节增强与保真检查脚本 |
| `config-examples/` | 新目录首次初始化的配置示例 |
| `docs/MAINTENANCE-HISTORY.md` | 原维护记录，部分条目是历史状态 |
| `SOURCE-SNAPSHOT.json` | 原文件和发布文件的核对记录 |

## 在新目录恢复

需要 Windows x64、已安装的官方 Codex、Node.js >=22.12.0 和 Google Chrome。以下命令只在自己的克隆目录 `desktop` 中执行，不要指向当前正在使用的逸美目录。

### 依赖

```powershell
npm install --prefix tools
Copy-Item -LiteralPath (Get-Command node.exe).Source -Destination .\tools\node.exe
```

`--prefix tools` 将固定版本依赖安装到源码约定的目录；第二条复制本机已安装的 Node 到启动器约定的位置。npm 依赖及 Node 二进制不进入 Git。

浏览器测试目前使用 `C:/Program Files/Google/Chrome/Application/chrome.exe`，其他安装位置需调整对应测试源码。

### 初始化本目录配置

仅在配置不存在时复制示例，避免覆盖已维护的固定指针：

```powershell
if (-not (Test-Path .\update-policy.json)) {
    Copy-Item .\config-examples\update-policy.example.json .\update-policy.json
}
if (-not (Test-Path .\current.json)) {
    Copy-Item .\config-examples\current.example.json .\current.json
}
if (-not (Test-Path .\switch-policy.json)) {
    Copy-Item .\config-examples\switch-policy.example.json .\switch-policy.json
}
```

示例版本 `0.0.0.0` 只用于首次构建，没有可用运行副本。此时直接启动会拒绝运行。

### 手动适配本机官方版本

打开 `Yimei-Manual-Upgrade.exe`，或在 Windows PowerShell 执行：

```powershell
$runDirectory = Join-Path $PWD ('manual-updates\restore-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
.\Manual-Upgrade-Worker.ps1 -RunDirectory $runDirectory
```

该入口识别本机官方安装包，在 `versions/` 制作独立副本，完整检查后再保存本目录的固定策略。它不会启动、关闭或重启 Codex。若需重新编译升级窗口，运行 `Build-Manual-Upgrader.ps1`，使用 Windows 自带 .NET Framework C# 编译器。

构建成功后，自行正常退出其他正在运行的 Codex，再执行：

```powershell
.\Launch-Codex-Yimei.ps1 -FixedVersion
```

`-FixedVersion` 要求固定模式配置；存在其他 Codex 主进程时仅提示，不关闭它。账户、历史和单实例沿用应用原机制，没有做数据隔离。

## 归档说明

源码统一 UTF-8/LF，PowerShell 脚本保留 UTF-8 BOM 以兼容 Windows PowerShell 5.1；旧开发机的依赖地址改为一致的 `C:/Yimei/template-dependencies` 模板占位地址。引擎准备阶段会把匹配锚点替换成当前目录的依赖路径，不能直接运行未处理模板。素材 JSON 中绝对历史报告路径仅保留文件名，图片、动作参数、时序与 QA 数值保持不变。

没有分发官方 Codex EXE、app.asar、官方前端模块、账号或聊天数据；没有归档旧运行副本、备份、日志、本机 current/update/switch 指针或第三方依赖目录。实际构建时从用户自己安装的官方应用制作本地副本。

`Install-Shortcut.ps1` 为早期自动跟随时期的历史入口，依赖旧报告和既有快捷方式，不在上述新目录恢复步骤中使用。当前策略为手动适配、固定版本、不自动跟随、不关闭或重启其他 Codex。

`Test-Manual-Upgrader.ps1` 使用隔离夹具检查升级和回退；实际播放检查需要官方安装包及构建副本。`engine.mjs build` 会调用完整验证链。

超分脚本需要历史 288px 输入、外部模型及对应加工快照，未打包这些历史输入；它们用于维护溯源。从现有 `artwork/` 重建桌宠运行副本不需要重新超分。
