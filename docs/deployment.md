# Vercel 部署

2026-10-24，用户要求将本地原型部署到 Vercel。部署方式由此前的本地开发扩展为静态网站托管，不增加后端和环境变量。

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
npm.cmd exec --yes --package vercel@latest -- vercel login

# 关联 / 创建本项目，并部署至生产环境
npm.cmd exec --yes --package vercel@latest -- vercel deploy --prod
```

首次关联选择当前游戏仓库对应的项目。后续部署复用 `.vercel/project.json`，避免重复创建项目。若在 Vercel Dashboard 导入 GitHub 仓库，可使用同一构建配置，并由 Git 集成触发后续部署。

## 线上验收

部署成功后检查首页 HTTP 200、脚本和样式加载、WebGL 初始化、开始清洁、实际污渍进度变化和刷新恢复。线上地址、部署状态和对应提交在完成后补记，不以配置完成代替部署成功。

浏览器存档按网站来源隔离，localhost 的进度不会自动迁移到 Vercel 域名。
