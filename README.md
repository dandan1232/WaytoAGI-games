# 清洁小世界 · Clean a Little

拖动卡赫设备，给四个微缩世界一点焕新的好心情。真实 3D 场景、局部污渍清除、四种清洁反馈，无倒计时与付费限制。

**[在线试玩 → clean-a-little.vercel.app](https://clean-a-little.vercel.app)**

![清洁小世界庭院](docs/screenshots/courtyard.png)

## 四个可玩场景

| 场景 | 清洁设备 | 小任务 |
| --- | --- | --- |
| 庭院日常 | KHB AIR 无线折叠清洗机 | 单车、长椅、地砖 |
| 晴天窗边 | WV 2 镜面清洁机 | 擦亮三块玻璃，露出窗后花园 |
| 元气厨房 | SC4D 蒸汽清洁机 | 灶台、瓷砖背墙、地面 |
| 柔软客厅 | PUZZI 8-1 布艺喷抽机 | 沙发、靠垫、地毯 |

底部直接选择场景，每关独立保存、独立重玩。厂商设备使用用户提供的产品照片；清洁参数用于游戏体验，不代表真实产品性能。

## 操作

| 操作 | 鼠标 / 键盘 | 触屏 |
| --- | --- | --- |
| 拖动机器清洁 | 按住机器，拖过污渍 | 单指拖动机器 |
| 直接清洁 | 按住场景左键拖动 | 单指按住场景拖动 |
| 旋转 / 缩放 | 右键拖动 / 滚轮 | 双指拖动 / 缩放 |
| 移动机器 | 聚焦机器后用方向键；按住空格清洁 | 拖动机器 |
| 宽幅 / 细节 | 边缘工具或 1 / 2 | 边缘工具 |
| 复位视角 | 相机按钮或 R | 相机按钮 |
| 收回机器 | 四向箭头按钮 | 四向箭头按钮 |
| 设置 / 暂停 | 右上设置 / 暂停或 Esc | 右上按钮 |

点击任务可聚焦。每项达到 92% 后自动清除少量余渍，三项完成后结算，可欣赏成果、再洗一次或前往下一站。设置可切换昼夜、音效、音量和环境动画；偏好与当前场景会保存。图片或本地存储不可用时仍可游玩。

## 本地运行与验收

需要 Node.js 22.14+、npm；浏览器验收使用本机 Chrome。

```powershell
npm ci
npm run dev
npm test                # 清洁、存档、四场景、设置与拖动边界
npm run build           # TypeScript 与生产构建
npm run test:e2e        # 串行 Chrome 真实输入验收
npm run test:production # 独立生产预览与四场景检查
```

打开终端显示的本地地址（默认 `http://127.0.0.1:5173`）。所有依赖、照片和场景均随项目提供，运行时无需第三方素材、字体或 CDN。无需 Python；仅重新转换原厂照片时需要 Python + Pillow。

Chrome 未安装时运行 `npx playwright install chrome`。不要同时启动多组 Playwright 命令共用 `test-results/`，可统一执行 `npm run test:e2e`；完整通关测试通过真实鼠标输入完成。线上复验可运行 `node scripts/verify-production.mjs https://clean-a-little.vercel.app/`。

## 项目文档

- [需求与验收标准](docs/requirements.md)
- [四场景与 UI 设计](docs/design-v2.md)
- [架构与清洁算法](docs/architecture.md)
- [开发与提交里程碑](docs/development.md)
- [厂商设备素材](docs/product-assets.md)
- [验收记录和限制](docs/verification.md)
- [Vercel 部署](docs/deployment.md)

项目根据德国卡赫创意 brief 制作。活动是否接受游戏投稿仍需确认；手机已进行浏览器触屏模拟，尚未完成 iOS / Android 真机性能评审。
