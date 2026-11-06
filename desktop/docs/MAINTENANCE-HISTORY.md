# Codex · 固定版本的 16 帧逸美

桌面 **Codex - 新版16帧逸美** 使用本目录的固定入口。

## 新版打包结构适配（2026-11-04 r9，当前）

已修复桌面“一键适配 Codex”在官方 **26.1029.7803.0 / 内部版本26.1029.61003** 上的 `Unique renderer chunk required` 错误。新版前端从具名 Vite 文件切换为 `webview/assets/async/` 下的 Rspack 模块，旧适配器无法定位播放器；新分支按内容与结构定位模块，同时适配两个重复的 mascot button 模块，并正确处理嵌套目录中的素材 URL。旧版 Vite 分支保留，未知结构仍拒绝发布。

当前固定副本为 **26.1029.7803.0-1dac9ee5a467-r9**。沿用r8的全部高清素材，waiting/review图像、working全16帧、空闲眨眼、16向张望与1500ms拖住触发保持原样。真实Chromium播放与100%/150%/200%缩放、原生pointer down/move/release、两个实际Rspack按钮工厂、任务优先级、19,392个未修改文件记录及8个解包原生文件验证通过。

通过原有 `Manual-Upgrade-Worker.ps1` 发布，旧r8副本和旧策略保留；桌面快捷方式及GUI无需重建。没有启动、关闭或重启Codex，没有恢复自启或自动跟随。下一次自行退出当前Codex后，使用原来的“Codex - 新版16帧逸美”快捷方式打开。两版继续共用原来的账户/历史与单实例机制。

兼容源码为 `rspack-adapter.mjs`、`templates/rspack-renderer.js`；`engine.mjs` revision=9。完整测试和恢复记录位于新版本目录、`rspack-261029-installation-report.json` 与 `manual-updates/20261104-rspack-repair-publish/`。修改前脚本在 `backups/before-rspack-20261104/`。

## 其余动作清晰度细化（2026-10-26 r8，素材基底）

按用户反馈保留 **waiting/review 两类动作的全部32帧文件原样**，改进其余6类动作及16向张望，共112帧。尺寸仍为576×624，不再单纯放大。对比增强版动画模型、插画专用 Anime6B 和混合方案后，选用插画模型，从保留的原始288px素材推理4x，再缩至2x；与r7细节基底做固定强度混合，不将已超分图片送回模型反复放大。

同一动作所有帧采用相同参数：idle、working、左右移动增强更明显；挥手、failed、look使用较保守的强度，保留表情与过渡。透明轮廓沿用原始alpha；动作顺序/时序、空闲眨眼、按钮/指针回调、1.5秒张望、8/16帧兼容图集与r7完全一致。静态16向不是连续动画，明确分开检查方向取帧与动画时序残差，不把角度变化误判为闪烁。

已构建并发布r8独立副本，实际Chromium播放、16向、working完整16帧及释放恢复检查通过。官方入口和进程、自启禁用、固定/不自动跟随策略不变；手动适配器已验证会保留r8素材。没有重启当前运行的r7；下次用户自行退出再从桌面打开逸美生效。

本轮资料：`super-resolution/2026-10-26-detail/`，实际效果见`detail-before-after.png`及`detail-faces-before-after.png`。`refine-details.py`用于复现，保留该目录previous快照与首轮source原图；模型保存在原tools目录。安装/回退记录：`other-motion-detail-installation-report.json`，r7及其完整素材备份仍保留。

## 首轮全部动作高清版（2026-10-26 r7，历史）

按用户选择使用本地逐帧超分，而非 AI 重绘人物。当前 **8 类动作 + 16 向张望，共 144 帧**，每帧由 **288×312 提升至 576×624（density=3）**；桌宠显示大小不变。复用作者的 Real-ESRGAN AnimeVideo-v3 x2 模型，固定逐帧处理、保守细节混合并保留原图低频颜色。透明轮廓由原始 alpha 按固定规则放大，不使用模型生成的轮廓。

帧身份/顺序、原动作节奏、原版空闲眨眼、working 及 **1.5 秒拖住张望**逻辑保持不变。播放器、按钮及指针回调代码与 r6 字节一致；原8帧/16帧低清兼容图集保持原样，正常逸美播放使用新的 HD 图集。Chromium 已验证全部 HD 实际解码尺寸、16 向取帧、working 全16帧/松手恢复及模拟100%/150%/200%屏幕缩放（桌宠124%显示大小下也无上采样）。本地超分不会凭空恢复原图没有的真实细节，各动作原有线稿风格不强行改成相同笔触。

独立 r7 副本已发布，r6 与原素材均保留。备份/安装记录：`all-motion-resolution-installation-report.json`；素材、处理代码、对比图、动作保真和后续适配验证在 `super-resolution/2026-10-26/`。`upscale-yimei.py` 可复现处理；工具/模型及许可证在 `tools/super-resolution/`。桌面一键适配工具使用新的 canonical 高清素材，不会在以后手动升级时回退清晰度。

不修改官方版、桌面快捷方式、共用账户/历史、自启或自动跟随设置；没有重启当前 Codex。需要用户自行退出当前运行副本，再从桌面逸美快捷方式打开才会实际加载新图。

## 桌面一键手动升级（2026-10-19 已完成）

新增桌面 **逸美 - 一键适配 Codex**，指向原生窗口程序 `Yimei-Manual-Upgrade.exe`。它与原“打开逸美”快捷方式是两个入口。

使用：先正常更新官方 Codex，再双击这个升级工具。工具只识别**本机已经安装**的最新版，不负责下载或安装官方更新。已有同版且检查通过时直接显示无需重复构建。

有新版本时，在独立临时副本中适配，验证 working 全 16 帧、16 向、动作优先级及官方未改资源后，才原子切换固定策略。旧副本保留；未知未来结构、测试失败、官方包正在变化、配置被另行修改时都不覆盖旧固定版本。发布失败会回退指针。不能承诺任意未来结构都能自动兼容，失败时需根据日志更新适配器。

只在点击工具时运行一次，不创建自启/定时任务，不恢复后台跟随，不启动或关闭任何 Codex。可以在官方版运行时检查/制作逸美副本；完成后仍由用户自行打开逸美。两版配置没有隔离，原有互斥启动策略不变。

窗口显示实际阶段，可查看日志；若适配仍在进行，关闭窗口会明确询问并说明本次任务将继续，不会重启 Codex。重复点击有跨进程锁，不会重复构建。

源代码 `manual-upgrader/Program.cs` 用本机自带 .NET Framework 编译；`Build-Manual-Upgrader.ps1` 为开发构建入口。后台逻辑在 `manual-upgrade-core.ps1`，工作入口 `Manual-Upgrade-Worker.ps1`；**普通逸美启动不调用这些入口**。

每次状态、日志和结果位于 `manual-updates/<时间-ID>/`；发布时保留旧策略快照。验证记录：`manual-upgrader-unit-test-report.json`（构建/缓存/失败/冲突/回退/锁）、`manual-upgrader-integration-report.json`（真实安装包及缓存）、`manual-upgrader-gui-test-report.json`（实际原生窗口）、`manual-upgrader-installation-report.json`（桌面回读、原快捷方式和官方进程不变）。

## 当前策略：关闭自动跟随（用户于 2026-10-18 要求）

- 固定 **26.1029.7803.0 r9**（2026-11-04新版Rspack兼容），沿用r8高清素材、原动作和 working 时张望修复、1.5 秒触发、被动视线防定格；旧26.1013.4894.0 r8/r7/r6/r5/r4 和26.1007.9446.0 r3保留回退。回退时需同时恢复对应版本的canonical素材，备份位置见安装记录。
- `update-policy.json` 为当前策略：`mode=fixed`、`autoFollowOfficialPackage=false`、`backgroundPreparationEnabled=false`。日常启动、PrepareOnly、VerifyOnly 都只解析这份固定副本，不查询/构建/发布官方新版。
- 桌面快捷方式添加 `-FixedVersion`；配置缺失或被改为跟随时拒绝启动，不静默恢复自动更新。2026-10-19 已回读核对，见 `fixed-shortcut-installation-report.json`。
- 不派出后台更新助手；旧助手入口即使被调用也立即退出，不等待、不适配。没有新增开机自启或自动重启。
- **2026-10-19 用户进一步要求关闭“双击时关闭官方版”**：旧授权已撤销，Restart Manager 和强制终止代码已移除。即使旧脚本传 `ConfirmedSwitch` 也不能关闭其他 Codex。
- 当前打开顺序：校验策略指定的固定副本 → 只读检查其他 Codex 主进程 → 有其他版本则仅提示、不启动逸美、不退出其他版本；没有冲突才正常打开逸美。重复打开同一逸美版由原应用处理。不开启版本检查、后台适配或自启。
- 用户仅要求移除自动关闭，**没有启用独立配置，也没有迁移账户或历史**。仍共用默认配置和单实例机制，不保证两版同时独立运行；不能把“官方入口未改、自动关闭已移除”说成所有情况下都可共存。
- `official-protection-test-report.json` 覆盖旧开关/旧直接调用无法终止进程；`official-noninterference-report.json` 核对官方快捷方式仍是注册包入口、官方主进程未变。`fixed-version-test-report.json` 覆盖实际完整性、无查询/构建/后台调度、遇到其他 Codex 时不启动也不退出。
- 旧入口与快捷方式备份在 `backups/before-disable-follow-20261018`；撤销自动关闭前脚本在 `backups/before-official-isolation-20261019`（仅供历史恢复，不是当前授权）。

以下自动跟随说明仅为历史记录，不代表当前启用。

## 不开机自启

2026-10-14 用户要求不自动开机启动。核对发现官方安装包现有的 `App` 启动项处于启用状态，已将当前用户的该项设为禁用；旧值保存在 `backups/startup-setting-before-20261014.json`，回读结果在 `startup-disabled-report.json`。

逸美启动器没有新增开机任务；只在用户点击快捷方式时工作。开机启动设置的关闭不影响双击使用与更新适配，未修改额度面板或官方沙盒服务，也未重启当前 Codex。[Windows 启动任务状态说明](https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.startuptaskstate?view=winrt-26100)

## 历史更新方式（现已关闭）

2026-10-16 按用户要求取消“正在适配新版逸美”的阻塞窗口，改为先启动、后准备更新：

1. 双击时直接读取本地已验证副本，检查小型清单、资源包头和可执行文件匹配后打开。启动前不查询官方版本、不等待构建锁、不复制应用，也不跑浏览器播放测试。
2. 主程序启动后才派出隐藏后台助手，默认延后 15 秒检查官方是否更新。新版的复制、适配和完整检查仍保留，但不占用启动链路。
3. 新副本准备好后供**下次点击**使用；准备过程中先使用上一份已验证逸美，不冒充已经运行了新版本。
4. 后台失败只记录诊断并保留可用副本，不弹进度窗口、不关闭或重启当前 Codex。缺少任何可用副本时才需要显式运行 `PrepareOnly` 准备，而不是在日常启动中悄悄阻塞构建。

这是**自动跟随已经安装的官方更新**；不替代 Microsoft Store 下载、安装官方更新，也没有新增定时任务。
2026-10-13 用户已授权一键切换：**双击逸美快捷方式时**，按已经准备好的逸美副本自动退出普通版/旧版并打开；如果新版尚在准备则先用已验证的可用版本。已运行所选逸美版时只打开窗口，不重启。不会因后台发现更新而自行关闭工作。

`switch-policy.json` 保存这次授权。未授权时启动器会询问是否切换，不再弹出一个只能点“确定”的拦截提示。退出优先调用 [Windows Restart Manager](https://learn.microsoft.com/en-us/windows/win32/api/restartmanager/nf-restartmanager-rmshutdown)，必要时仅结束已确认的 Codex 主进程；进程身份用 [PID 与创建时间](https://learn.microsoft.com/en-us/windows/win32/api/restartmanager/ns-restartmanager-rm_unique_process) 校验。

后台启动入口显式加载 Windows PowerShell 自己的系统工具模块，避免继承 Codex 工具环境的 PowerShell 7 模块路径后找不到 `Get-FileHash`。`background-environment-test-report.json` 验证了真实隐藏后台启动环境；不只是前台命令检查。

## 早期版本验证（历史记录）

- 已就绪官方版本：**26.1013.4894.0**；内部版本：**26.1013.40934**。
- 保留用户选择的原版 16 姿势 working，仅修头顶纹理，2520 ms 原动作节奏。
- 原低头动作、4–6 秒随机空闲眨眼和其他动作/视线保留。
- 2026-10-16 r2 修复拖住停留 2 秒不转头：原来转头已触发，却被悬停挥手或左右拖动临时态遮盖。现仅在 idle 且没有更高任务临时态时让停留转头覆盖这两类动作；移动重新计时，释放清理。图像未更改。
- `look-test-report.json` 覆盖真实打包后的 pointer down/move/end 回调、悬停与左右拖动组合、全部 16 个方向、任务优先级与清理；Chromium 检查两个 HD 图集全部方向的实际图片和取帧位置。
- 2026-10-18 r3 修复任务 working 被原生视线静态帧和 hover 挥手盖住。只对逸美的非 idle 任务禁止静态 look、避免 hover 改写任务状态；空闲互动、明确拖动临时态及其他宠物行为保留。实际按钮+实际播放器的 Chromium 组合检查在 hover 和持续视线更新时画满 16 帧。
- 2026-10-22 r5 区分主动拖住张望与被动视线：idle/working 时拖住停留 2000 ms 显示 16 向；移动取消并重新计时，松手恢复原任务动画。review/failed/waiting 和高优先级临时态仍不被张望覆盖。普通鼠标视线/hover 不替代 working。原图完全不变，原版 Codex 未修改；不自动重启。适配器 revision=5，桌面手动升级工具会自动使用同一修复，无需修改快捷方式或 GUI。
- 2026-10-22 r6 按用户要求将该等待时间从 2000 ms 改为 **1500 ms**；其余优先级和动作不变。实际打包模块验证 1499 ms 尚未触发、1500 ms 触发，覆盖空闲/working、全部 16 向、移动重新计时及释放恢复。适配器 revision=6，后续手动适配同样保留 1.5 秒设置；验证记录 `hold-1500ms-verification-report.json`。
- 真实 Chromium 检查 working、向右移动全部 16 帧正常显示，无加载或脚本错误。
- 21070 个其他资源记录、新版 8 个原生文件保持一致；14 个素材文件未改动，资源完整性和可执行文件匹配。
- 快速入口检查实测约 **260 ms**：包括实际副本完整性检查和调度逻辑，不包含 PowerShell 进程启动、实际进程切换及 Codex 窗口初始化。测试中的应用启动被拦截，没有为测速重启用户窗口。
- 自动分发检查覆盖新版本构建、同版本缓存、失败不覆盖、运行中的其他版本不被重启、正常窗口启动。

`current.json` 和固定策略在当时指向已验证的 **26.1013.4894.0 r4**，供下次点击快捷方式使用；本次兼容没有启动或重启 Codex。`compat-261013-installation-report.json` 核对当前仍为官方主进程 5344、12:38 启动，启动项仍禁用，官方快捷方式哈希未改。`active-switch-report.json`、`look-live-state.json`、`working-live-state.json` 为历史核验，不代表 r4 已运行。

适配器兼容先完成，用户随后再次要求制作桌面工具，现已完成上方的一键手动升级入口。兼容细节与回归结果见 `compat-261013-verification.json`；构建在独立副本上完成，官方源包头和源可执行文件核对未变。

## 目录与记录

- `current.json`：当前官方版本对应的已验证副本。
- `versions`：独立副本和各自的验证记录；不会覆盖官方安装或旧手工副本。
- `artwork`：用户批准的逸美素材快照，不含未选定的发丝动力学实验版。
- `tools`：独立 Node、ASAR 和浏览器测试依赖，不依赖旧版 Codex 的工具目录。
- `backups`：变更前的桌面快捷方式。
- `auto-launcher-test-report.json`、`installation-report.json`：自动跟随及部署记录。
- `last-build.log`、`failures`：适配失败时的诊断信息；失败的运行文件不会留下占空间的临时副本。
- `fast-start-test-report.json`：实际副本校验、无阻塞构建路线、移除窗口及异常资源拒绝检查。
- `background-update-result.json`：隐藏助手只准备文件、不启动/关闭/重启 Codex 的结果。
- `look-repair-installation-report.json`：16 向修复的准备与发布状态；`test-look-regression.mjs` 为本地交互回归入口。
- `working-repair-installation-report.json`：working 优先级修复发布记录；`test-working-regression.mjs` 覆盖任务与 hover/look 四组合、切入和结束；版本目录 `working-test-report.json` 为实际打包代码检查结果。

首次自动适配使用本机已安装的 Chrome 做真实解码/播放检查。若以后 Codex 改变动画契约，适配器会拒绝未验证的结果并提示更新适配器。
