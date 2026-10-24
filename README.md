# 清洁一平方米 · Clean a Little

根据德国卡赫创意 brief 制作的 3D 清洁互动原型。在一座微缩庭院里，洗净单车、长椅和地砖，让日常空间重新焕发色彩。

本仓库先交付可本地运行的浏览器游戏，不包含账号、支付或在线服务。

## 项目文档

- [需求与验收标准](docs/requirements.md)
- [架构与清洁算法](docs/architecture.md)
- [开发、验证与里程碑](docs/development.md)
- [技术决策记录](docs/decisions/0001-browser-prototype.md)

## 本地开发

需要 Node.js 22.14+ 与 npm。

```powershell
npm ci
npm run dev
```

打开终端显示的本地地址。当前 M2 提供工程入口和核心逻辑，3D 场景在 M3 接入。

```powershell
npm test          # 清洁与存档逻辑
npm run check    # TypeScript
npm run build    # 类型检查与生产构建
npm run preview  # 预览生产构建
```

## 第一版范围

- 一个可旋转查看的 3D 庭院，包含三个清洁目标。
- 按住鼠标或触屏拖动清洗；切换清洗范围，观察真实的局部污渍消退。
- 分目标进度、音效、水流反馈和完成展示。
- 本地保存进度、继续体验和重新开始。

实现进度和运行方式随各里程碑更新，详见开发文档。
