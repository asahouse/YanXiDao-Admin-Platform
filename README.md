# 研习岛管理平台与中心服务端（YanXiDao Admin Platform）

研习岛（YanXiDao）**独立管理后台**与**中心 API 服务端**仓库，支持 MySQL 生产持久化与 Docker Compose 一键编排部署。

> 共享领域规则与类型由 [@yanxidao/shared](https://github.com/asahouse/YanXiDao-Shared) 提供；学习客户端见 [YanXiDao](https://github.com/asahouse/YanXiDao)。

## 核心模块

- **独立管理后台（`/admin`、`/admin/login`）**：
  - 课程与教辅广场管理、分类管理、课程批量导入与 `.yxdpack` 离线同步包导出。
  - 全局用户管理（创建/激活/停用/删除、VIP 类型调整、随机 8 位密码重置与邮件通知）。
  - **会员升级申请审批**：查看用户升级申请、发送文本/支付链接回复、双向沟通以及审批通过自动开通 VIP。
  - SMTP 邮件服务配置与全量操作审计日志（`admin_audit_logs`）。
- **安全与数据架构**：
  - 双引擎数据库支持：线上生产推荐 `MySQL 8.0`（通过 `.env` 配置），本地开发兼容内置 SQLite；提供 `scripts/migrate-sqlite-to-mysql.mjs` 迁移脚本。
  - 独立 HMAC-SHA256 管理员/用户令牌签发、登录暴力破解锁定、SSRF 防护、CORS 白名单及安全响应头。

## 本地开发与测试

```bash
npm install

# 复制环境变量模板并按需修改
cp .env.example .env

# 启动中心 API 服务 (3001) 与管理后台前端
npm run server
npm run dev

# 类型检查、构建与端到端安全/业务回归测试
npm run typecheck
npm run build
npm run test:e2e
```

## 生产部署（Docker Compose：MySQL + Node + Nginx）

```bash
cp .env.example .env
# 务必修改 .env 中的 DB_PASSWORD、YANXIDAO_USER_SECRET 与 YANXIDAO_ADMIN_SECRET
docker compose up -d --build
```

## CI/CD 流水线

- Push / PR 至 `main`：自动执行 `typecheck`、`build` 并启动服务运行 `npm run test:e2e` 全量回归。
- 推送 `v*` 标签：自动构建多阶段生产 Docker 镜像。
