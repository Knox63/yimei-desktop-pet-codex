# 仅重做逸美 working · GPT Image 2.6 GIF

## 网页端可直接粘贴

以下英文提示词已填写仓库地址。除仓库链接外，请直接附上本仓库的 `references/working/working-reference.png` 和 `references/working/working-motion-reference.png`。仓库链接不一定自动成为视觉输入。

```text
Repository: https://github.com/Knox63/yimei-desktop-pet-codex

Create an actual animated GIF of Yimei's WORKING state using GPT Image 2.6, if that model and animated GIF generation are available in this interface. If they are unavailable, tell me clearly before generating anything. Do not silently substitute a different model or return a static sprite sheet as if it were an animated GIF.

Use ONLY these working references for the character, art style, detail quality, crop and motion:
- references/working/working-reference.png: canonical character reference, taken from working source frame 0.
- references/working/working-motion-reference.png: working motion reference, showing source frames 0, 5, 10 and 15 in reading order.
- references/working/working-original.gif or working-original.webp: original motion and pacing, if accessible.

Do not use waiting, review, idle or any other state as a visual, identity, style or clarity reference. Do not browse those images to guide the redesign. If you cannot see the working reference images, ask me to attach them instead of inventing the character.

Redraw the existing working animation with crisp, stable illustration details and coherent natural motion. Preserve this exact character: the same face, warm brown eyes, long brown hair, dark green hair ribbon and small gold ornament, white rolled-sleeve shirt, green bow and green shoulder straps. Preserve the existing half-body composition, shoulder width, head proportions, hand anatomy, clothing colors and original crop. Keep both hands visible as in the references. No new props or keyboard; no full-body redesign.

WORKING means quietly concentrating on a task, not running or jogging. Animate a restrained, purposeful head nod and small natural hand/finger movements consistent with the original working poses. Let the hair and cloth follow subtly. Keep the character recognizably busy and calm. Preserve the expression from the working reference; no new dramatic smile, speaking motion, large gesture or extra blink.

Use a locked camera. Keep the torso anchor, character scale, crop and baseline steady throughout. Do not individually recenter or resize the character in each frame. The head may move naturally as part of the nod. No zoom, camera motion, flicker, changing line thickness, face drift, hand morphing, new hair strands appearing, motion blur, glow, particles, speed lines, text, labels or watermark.

Make a complete seamless loop: leave the starting pose, perform one small working action, and return naturally to it. The last-to-first transition must look like the other neighboring transitions, without a jump or duplicated pause. Keep the face, fingers and fine hair edges sharp in every frame.

Requested animation: 16 coherent frames, approximately 160 ms per frame, total about 2.56 seconds. The original desktop cycle is 2.52 seconds; I will align duration and interpolate afterward. If the interface exposes GIF parameters, use frame_count=16 and frame_duration_ms=160. Use 576x624 per frame if supported; otherwise select an available resolution with sufficient detail and preserve the composition for later fitting into a 576x624 frame. Do not claim that a prompt alone has set API parameters.

Background: a perfectly uniform solid magenta (#FF00FF), with no gradient, texture, ground shadow, reflections, transparent-looking checkerboard or magenta lighting on the character. Keep a clean non-magenta character edge for later matting. If native GIF alpha is available, report its actual transparency behavior rather than promising soft alpha.

Deliver the actual animated GIF file at its original generated quality. Report its actual dimensions, encoded frame count and duration if you can inspect the file; otherwise say these are unverified. Do not present a static image or an invented download link as the result.
```

## 回到 Codex 后的处理约定

- 首先检查实际文件格式、不同帧数量、帧间隔、人物一致性、手部形态与首尾接缝。
- 先验收原始 2.6 动画，再做补帧。补帧不能修复错误人物或不连续动作语义。
- 保留源文件；抠图和补帧产物另存，不覆盖原版。
- 目标对比画布 576 × 624、周期 2520 ms；补帧目标 63 帧、每帧 40 ms，即 25 fps。
- 补帧需覆盖最后一帧到第一帧，并检查脸、手和发丝，不能用简单淡入淡出或复制帧冒充。
- 原版和候选版本在同样背景、显示尺寸和动作周期下并排比较。
- 此次只生成对比材料，不自动替换桌面素材、不重启 Codex。

能力依据：https://developers.openai.com/api/docs/guides/image-generation#generate-animated-gif-output
