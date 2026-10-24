# Vercel 部署

2026-10-24，用户要求将本地原型部署到 Vercel。部署方式由此前的本地开发扩展为静态网站托管，不增加后端和环境变量。

## 当前部署

- 在线地址：<https://clean-a-little.vercel.app>。
- 项目：`dandan1232s-projects/clean-a-little`。
- 项目控制台：<https://vercel.com/dandan1232s-projects/clean-a-little>。
- 初次生产部署状态：`READY`；源提交：`60df182`。
- GitHub：`dandan1232/WaytoAGI-games`，已连接 Vercel Git 集成，`main` 推送触发后续生产部署。
- Vercel CLI：65.1.0。

已用未登录的独立 Chrome 实测公开域名：HTTP 200；开始清洁正常；鼠标实际清洗后地砖进度为 4%，刷新仍为 4%；390×844 手机布局无横向溢出；无页面 / 控制台错误和失败资源请求；生产页面没有开发测试入口。

## 配置

- 配置文件：根目录 `vercel.json`。
- Framework：Vite。
- Install：`npm ci`。
- Build：`npm run build`，包含 TypeScript 检查。
- Output：`dist`。
- 页面与资产均由 Vercel 静态托管，无服务端函数。
- `/assets/` 下的内容哈希资源使用一年不可变缓存；入口页面由平台默认策略处理。
- 不需要 API 密钥和运行时环境变量。

`.vercelignore` 排除工作文件、浏览器报告、文档截图和本地构建产物，Vercel 使用源代码重新构建。`.vercel/` 仅存放本地项目关联状态，不进入 Git。

## 部署命令

```powershell
# 首次使用需要通过浏览器完成 Vercel 官方登录
npm.cmd exec --yes --package vercel@latest -- vercel login --global-config ./work/vercel-cli

# 新工作副本先关联到已创建的游戏项目
npm.cmd exec --yes --package vercel@latest -- vercel link --yes --project clean-a-little --scope dandan1232s-projects --global-config ./work/vercel-cli

# 关联 / 创建本项目，并部署至生产环境
npm.cmd exec --yes --package vercel@latest -- vercel deploy --prod --scope dandan1232s-projects --global-config ./work/vercel-cli
```

首次关联选择当前游戏仓库对应的项目。后续部署复用 `.vercel/project.json`，避免重复创建项目。若在 Vercel Dashboard 导入 GitHub 仓库，可使用同一构建配置，并由 Git 集成触发后续部署。

本次环境将 CLI 会话配置放在 `work/vercel-cli`，避免默认配置目录的跨磁盘原子写入错误。该目录、`.env.local` 和 `.vercel/` 均被 Git 与 Vercel 上传规则排除；不在文档或命令参数中保存登录凭据。

## 线上验收

后续更新应检查首页 HTTP 200、脚本和样式加载、WebGL 初始化、开始清洁、实际污渍进度变化和刷新恢复。以 Vercel `READY` 状态和实际浏览器验收作为上线完成依据。

浏览器存档按网站来源隔离，localhost 的进度不会自动迁移到 Vercel 域名。
