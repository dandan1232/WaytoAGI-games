# 第三方素材与依赖说明

本项目的 MIT 许可证适用于项目原创内容，不替代第三方素材、商标或依赖各自的许可。

## 厂商产品图片与商标

以下内容不由本项目授予 MIT 许可，其权利保留给相应权利人：

- `public/products/` 中的 KHB AIR、WV 2、SC4D、PUZZI 8-1 产品照片及其网页转换版本。
- 本地 `images/` 中的原始厂商素材；该目录不随仓库分发。
- 产品图片、界面及 `docs/screenshots/` 截图中出现的 Kärcher / 卡赫等第三方商标、标识与产品图像。
- 外部创意 brief、参考网站及其原有内容。

产品照片由用户提供，来源记录与文件映射见 [厂商设备素材](docs/product-assets.md)。转换格式、缩放和裁剪空白边距不会改变原素材的权利归属。复用这些内容时需适用相应权利人的授权；本仓库的 MIT 许可证不授予第三方素材或商标使用权。

界面设计参考 [Choo-Choo World](https://choochooworld.com/?DATA=DFFBHFIJB/0/D)，本仓库未复制其图形、模型、音频或代码。

## 软件依赖

直接依赖与开发工具的许可证如下，具体版本由 `package-lock.json` 固定：

| 依赖 | 用途 | 许可证 |
| --- | --- | --- |
| Three.js | 3D 场景与渲染 | MIT |
| @types/three | Three.js 类型声明 | MIT |
| Vite | 开发服务器与构建 | MIT |
| TypeScript | 类型检查 | Apache-2.0 |
| Vitest | 逻辑测试 | MIT |
| Playwright Test | 浏览器验收 | Apache-2.0 |

这不是完整的传递依赖清单。第三方软件继续适用其自身的许可证、版权声明和 NOTICE；分发依赖时应保留对应声明。项目 MIT 许可证不将其他许可证改授为 MIT。

### Three.js 版权与许可声明

运行时使用的 Three.js 声明如下，来源为所安装版本的 `node_modules/three/LICENSE`：

```text
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
