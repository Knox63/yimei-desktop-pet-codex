# 逸美桌宠 · 完整 Codex 桌宠项目

**完整维护项目在 [`desktop/`](desktop/README.md)**，包含当前适配引擎、Vite/Rspack 模板、固定版本启动器、手动升级核心、Windows 升级窗口源码与现有编译产物、回归检查、全部 canonical 素材及元数据。

当前基线：Codex 26.1029.7803.0 / 逸美 r9，全部 144 张高清源图保持原始字节。安装依赖、新目录恢复、构建与维护方法见 [完整项目说明](desktop/README.md)。源文件核对与发布规范化记录见 [SOURCE-SNAPSHOT.json](desktop/SOURCE-SNAPSHOT.json)。

GPT Image 2.6 重绘实验已搁置，未生成或替换新动作。下面保留早期上传的独立素材快照和实验参考；当前项目使用 `desktop/` 中的完整维护代码。

这是现有版本的归档，**尚未包含 GPT Image 2.6 新生成动画或补帧结果**。

## 先看 working

桌面状态名称为 `working`，内部状态键为 `running`。这里表示专注工作，不是跑步。

![原 working 动画](references/working/working-original.webp)

- [原 working GIF（深色背景，2.52 秒）](references/working/working-original.gif)
- [人物参考 PNG：working 第 0 帧](references/working/working-reference.png)
- [动作参考 PNG：working 第 0、5、10、15 帧](references/working/working-motion-reference.png)
- [完整 16 张 working 源图总览](references/working/working-16-source-frames.png)
- [GPT Image 2.6 网页端提示词](prompts/working-gpt-image-2.6.md)

**重做 working 时，只用上述 working 参考。不要用 waiting、review 或其他动作作清晰度、人物或画风参照。**

## 当前基线

| 项目 | 当前值 |
| --- | --- |
| 归档日期 | 2026-11-06 |
| 对应 Codex 版本 | 26.1029.7803.0 |
| 素材修订 | 2026-10-26-anime6b-detail-original-poses |
| 高清单帧尺寸 | 576 × 624 |
| working 不同源图 | 16 张 |
| working 播放步骤 | 30 步，正向 0…15、反向 14…1 |
| working 循环 | 2520 ms |

原版预览保留原素材和动作时长。WebP 保留透明度，GIF 为便于查看合成在深色背景上。格式编码的帧间隔有微小量化，整轮仍为 2520 ms；精确时序见 `manifest.json`。

## 文件结构

```text
assets/                 当前高清图集与标准图集，按原文件哈希核验
references/working/     仅从 working 导出的参考图与原版动图
src/current-player.js   当前自定义播放器源码快照
manifest.json           各动作图集参数、逐帧顺序和时间
prompts/                网页生成提示词与后续处理约定
verification.json       导出文件哈希、尺寸和预览时长核验
```

`assets/` 保留全部当前动作，供归档和以后维护；此次 GPT Image 实验仅涉及 working。`look-9`、`look-10` 是静态视线方向，不是动作动画。已移除的 jumping 不在本次实验中恢复。idle 的 manifest 采用 5000 ms 代表性间隔；桌面版实际在 4000–6000 ms 之间随机选择。

仓库不包含 Codex 官方可执行文件、app.asar、官方前端模块、依赖安装目录、账号信息、聊天记录、本机运行路径或旧版本备份。`src/current-player.js` 依赖宿主提供素材映射，不能单独作为桌面安装器使用。

## 历史实验：网页生成与回传（已搁置）

1. 在 ChatGPT Images 新对话里提供本仓库链接和 `prompts/working-gpt-image-2.6.md` 内容。
2. 为可靠地传入视觉参考，同时直接附上 `working-reference.png`、`working-motion-reference.png`。如果网页不能读仓库或附件，请先说明，不要自行猜人物。
3. 请求输出真正的动画 GIF 文件，保留网页返回的原文件；不要将静态分镜图视为动画成功。
4. 将生成的 GIF 交回原 Codex 会话，再做帧数/时长核验、透明边缘处理、循环接缝检查和实际补帧。
5. 最终对比统一为 576 × 624、2520 ms；补帧目标可用 63 帧 × 40 ms = 25 fps。不能用重复帧冒充补帧。

仅凭提示词不能证明网页选中了 GPT Image 2.6；需记录网页显示的模型信息。当前文件也不能证明你的账号已获得 GIF 生成功能。

## 权利说明

本次归档没有新增开源许可；仓库公开不代表对所有素材作出任意再分发或商用授权。未打包任何 OpenAI 官方应用。
