# GBase Billing Service

GBase 应用的共享 Stripe 支付微服务，支持 Freemium 模式（Free / Pro / Enterprise）。

## 技术栈

- **框架**: Hono
- **ORM**: Drizzle ORM
- **数据库**: PostgreSQL 16
- **验证**: Zod
- **支付**: Stripe

## 快速开始

```bash
# 1. 启动 PostgreSQL
docker-compose up -d

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 Stripe 密钥和 API Keys

# 4. 运行数据库迁移
npm run db:generate
npm run db:migrate

# 5. 启动开发服务器
npm run dev
```

服务运行在 `http://localhost:3100`。

## 环境变量

| 变量 | 说明 | 去哪获取 |
|------|------|---------|
| `STRIPE_SECRET_KEY` | Stripe API 密钥 | [Stripe Dashboard → API keys](https://dashboard.stripe.com/apikeys)（测试用 `sk_test_`，正式用 `sk_live_`） |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 签名密钥 | Stripe Dashboard → Webhooks → 添加端点后获取 |
| `DATABASE_URL` | PostgreSQL 连接串 | 你自己的数据库，如 `postgres://postgres:postgres@localhost:5432/gbase_billing` |
| `PORT` | 服务端口 | 默认 `3100` |
| `API_KEYS` | 多应用 API Key（逗号分隔） | 自行生成，格式 `app_id:key` |

## API 文档

所有 `/api/billing/*` 路由需要 `X-API-Key` 请求头。

### POST /api/billing/checkout

创建 Stripe Checkout 会话，用于升级到付费套餐。

```bash
curl -X POST http://localhost:3100/api/billing/checkout \
  -H "Content-Type: application/json" \
  -H "X-API-Key: gbase_sk_app1_xxxxx" \
  -d '{
    "app_id": "app1",
    "user_id": "user_123",
    "plan": "pro",
    "success_url": "https://app1.example.com/billing?success=true",
    "cancel_url": "https://app1.example.com/billing?canceled=true"
  }'
```

返回: `{ "checkout_url": "https://checkout.stripe.com/..." }`

### POST /api/billing/portal

创建 Stripe 客户门户会话，用于用户自助管理订阅。

```bash
curl -X POST http://localhost:3100/api/billing/portal \
  -H "Content-Type: application/json" \
  -H "X-API-Key: gbase_sk_app1_xxxxx" \
  -d '{
    "app_id": "app1",
    "user_id": "user_123",
    "return_url": "https://app1.example.com/settings"
  }'
```

返回: `{ "portal_url": "https://billing.stripe.com/..." }`

### GET /api/billing/subscription

查询当前订阅状态。无订阅记录时返回 `free` 套餐。

```bash
curl "http://localhost:3100/api/billing/subscription?app_id=app1&user_id=user_123" \
  -H "X-API-Key: gbase_sk_app1_xxxxx"
```

返回: `{ "plan": "pro", "status": "active", "current_period_end": "2026-04-25T00:00:00.000Z" }`

### POST /api/webhooks/stripe

Stripe Webhook 端点（无需 API Key，通过 Stripe 签名验证）。

在 Stripe Dashboard → Webhooks → 添加端点：
- URL: `https://your-domain.com/api/webhooks/stripe`
- 监听事件: `checkout.session.completed`、`customer.subscription.updated`、`customer.subscription.deleted`、`invoice.payment_failed`

## 添加新应用

1. 在 [Stripe Dashboard](https://dashboard.stripe.com/products) 创建 Product + Price
2. 在 `src/lib/plans.ts` 中添加 Price ID：
   ```typescript
   export const APP_PLANS = {
     "your-app": {
       pro: "price_xxx",
       enterprise: "price_yyy",
     },
   };
   ```
3. 在 `.env` 的 `API_KEYS` 中追加：
   ```
   API_KEYS=your-app:gbase_sk_yourapp_xxxxx
   ```
4. 重启服务

## 前端接入配置

当 ui-system-generator 生成的前端项目需要对接 Billing Service 时，在前端项目的 `.env.local` 中配置：

```env
BILLING_SERVICE_URL=http://115.191.45.101:3100    # 测试环境（开发调试用）
BILLING_API_KEY=gbase_sk_app1_xxxxx               # 与服务端 API_KEYS 中的 key 一致
BILLING_APP_ID=app1                                # 与服务端 API_KEYS 中的 app_id 一致
```

> **上线前** 必须替换为自己部署的服务地址和密钥。

### 服务架构

```
前端 (Next.js, 可部署在 Vercel)
  └── /api/billing/[...path]  → 代理转发 → GBase Billing Service (:3100)
                                                 ↓
                                           PostgreSQL (:5432)
                                           └── gbase_billing
```

前端只做请求转发（隐藏 API Key），业务逻辑在后端服务上。前端可以部署在 Vercel，但后端服务需要一台独立的服务器（VPS / 云服务器）。

## 部署

```bash
# Docker 部署
docker build -t gbase-billing-service .
docker run -p 3100:3100 --env-file .env gbase-billing-service

# 或用 pm2
npm run build
pm2 start dist/index.js --name gbase-billing --node-args="--env-file=.env"
```

支持 Docker 主机、Fly.io、Railway、Render 等平台。
