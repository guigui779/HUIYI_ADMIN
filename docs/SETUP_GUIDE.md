# 云际听悟管理后台 - 部署指南

## 📋 部署前准备

### 1. Supabase 数据库准备

#### 1.1 创建 Supabase 项目
1. 访问 [Supabase 控制台](https://supabase.com/dashboard)
2. 点击 "New Project" 创建新项目
3. 选择区域（推荐选择离你最近的区域）
4. 设置密码（记住这个密码）
5. 等待项目创建完成（约2分钟）

#### 1.2 获取 API 凭据
1. 进入项目后，点击左侧 **Settings** → **API**
2. 复制以下信息：
   - **Project URL**: 形如 `https://xxx.supabase.co`
   - **service_role key**: 在 "Project API keys" 部分，找到 `service_role` 并复制（⚠️ 不要使用 `anon` key）

#### 1.3 初始化数据库
1. 点击左侧 **SQL Editor**
2. 点击 "New Query"
3. 复制 `database_init.sql` 文件的内容
4. 粘贴到编辑器中
5. 点击 **Run** 执行SQL脚本
6. 确认所有表都创建成功（应该看到 10 个表）

### 2. Railway 部署准备

#### 2.1 连接 GitHub 仓库
1. 登录 [Railway 控制台](https://railway.app)
2. 点击 **New Project** → **Deploy from GitHub repo**
3. 选择你的仓库
4. 添加构建配置（如果需要）

#### 2.2 配置环境变量
1. 进入部署的 Service
2. 点击 **Variables** 标签
3. 添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|----|------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 项目 URL |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | Supabase service_role key |
| `API_SECRET` | `your-secret-key` | API 密钥（必需，用于认证和初始化）|
| `ADMIN_CONSOLE_USERNAME` | `admin` | 管理后台用户名（可选，不设置则需通过 API 初始化）|
| `ADMIN_CONSOLE_PASSWORD` | `your-secure-password` | 管理后台密码（可选，不设置则需通过 API 初始化）|
| `ADMIN_CONSOLE_JWT_SECRET` | `your-jwt-secret` | JWT 密钥（可选）|

#### 2.3 启动服务
1. 点击 **Redeploy** 按钮重新部署
2. 等待部署完成（约1-2分钟）
3. 检查 **Logs** 标签，确认看到：
   ```
   Supabase 已连接: https://xxx.supabase.co
   管理后台已启动: http://localhost:3000
   ```

#### 2.4 验证部署
1. 打开 Railway 提供的域名
2. 访问 `/health/ping` 端点：
   ```
   https://your-app.railway.app/health/ping
   ```
3. 应该返回：
   ```json
   {
     "status": "ok",
     "timestamp": "2025-01-20T..."
   }
   ```

## 🚀 首次使用

### 1. 访问管理后台
1. 打开你的 Railway 域名
2. 例如：`https://your-app.railway.app`
3. 会看到登录界面

### 2. 初始化管理后台（如需要）
如果你没有设置环境变量 `ADMIN_CONSOLE_USERNAME` 和 `ADMIN_CONSOLE_PASSWORD`，需要先初始化：

**方法A：通过 API 初始化**
```bash
curl -X POST https://your-app.railway.app/console/auth/init \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "setupKey": "YOUR_API_SECRET"
  }'
```

**方法B：通过环境变量初始化**
在 Railway 环境变量中添加：
- `ADMIN_CONSOLE_USERNAME`: 设置用户名（如：admin）
- `ADMIN_CONSOLE_PASSWORD`: 设置强密码（至少4位，不能是 admin、password、123456）

### 3. 登录系统
- **用户名**: 你设置的用户名（默认：admin）
- **密码**: 你设置的密码

### 4. 配置外部 API（可选）
如果你有外部音视频 API：
1. 在 "外部API配置" 卡片中
2. 输入 API 地址（如：`https://api.example.com`）
3. 输入 API Secret
4. 点击 "保存并连接"

### 3. 配置外部 API（可选）
如果你有外部音视频 API：
1. 在 "外部API配置" 卡片中
2. 输入 API 地址（如：`https://api.example.com`）
3. 输入 API Secret
4. 点击 "保存并连接"

### 4. 创建授权码
1. 在 "创建授权码" 卡片中
2. 填写：
   - 数量：要创建的授权码数量
   - 有效分钟：授权码有效期（分钟）
   - 归属：归属人（可以是 ID 或名称）
   - 备注：备注信息
3. 点击 "创建授权码"

## 🔧 常见问题

### 问题1：数据库连接失败
**错误信息**: `Supabase 未初始化，请先调用 initSupabase()`

**解决方案**:
1. 检查 Railway 环境变量是否正确设置
2. 确认 `SUPABASE_URL` 格式正确（必须是 `https://xxx.supabase.co`）
3. 确认 `SUPABASE_SERVICE_KEY` 是 service_role key，不是 anon key
4. 重启服务

### 问题2：登录失败
**错误信息**: `后台登录未配置`

**解决方案**:
1. 检查是否设置了 `API_SECRET` 环境变量（这是必需的）
2. 方案A：设置环境变量 `ADMIN_CONSOLE_USERNAME` 和 `ADMIN_CONSOLE_PASSWORD`
3. 方案B：调用 `/console/auth/init` 接口初始化（需要提供 setupKey=API_SECRET）
4. 确保密码至少4位且不是弱密码（如 admin、password、123456）

**初始化示例**:
```bash
curl -X POST https://your-app.railway.app/console/auth/init \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "setupKey": "YOUR_API_SECRET"
  }'
```

### 问题3：按钮无法点击
**问题**: 某些按钮点击无反应

**解决方案**:
1. 检查浏览器控制台（F12）是否有 JavaScript 错误
2. 确认所有 JS 文件都正确加载
3. 尝试刷新页面（Ctrl + F5）

### 问题4：API 连接失败
**错误信息**: `外部API连接失败`

**解决方案**:
1. 确认外部 API 地址配置正确
2. 确认外部 API 可以访问
3. 检查 API Secret 是否正确
4. 查看 Railway 日志获取详细错误信息

## 📁 文件结构

```
云际听悟管理后台/
├── api/                          # 后端代码
│   ├── src/                      # TypeScript 源码
│   │   ├── index.ts              # 入口文件
│   │   ├── routes.ts             # API 路由
│   │   ├── backofficeRouter.ts   # 后台管理路由
│   │   ├── database.ts           # 数据库连接
│   │   ├── adminStore.ts         # 数据库操作
│   │   ├── adminSchema.ts        # 数据库架构
│   │   ├── consoleAuth.ts        # 认证逻辑
│   │   ├── externalApi.ts        # 外部 API 调用
│   │   ├── env.ts                # 环境变量
│   │   └── models.ts             # 数据模型
│   ├── public/                   # 前端代码
│   │   ├── index.html            # 主页面
│   │   ├── css/                  # 样式文件
│   │   │   ├── admin.css         # 主样式（导入所有模块）
│   │   │   ├── variables.css     # CSS 变量
│   │   │   ├── base.css          # 基础样式
│   │   │   ├── layout.css        # 布局样式
│   │   │   ├── components.css     # 组件样式
│   │   │   ├── modules.css       # 模块样式
│   │   │   └── responsive.css    # 响应式
│   │   └── js/                   # JavaScript 文件
│   │       ├── login.js          # 登录模块
│   │       ├── config.js         # 配置模块
│   │       ├── api.js            # API 调用模块
│   │       └── app.js            # 主应用模块
│   ├── .env.example              # 环境变量示例
│   ├── package.json               # 依赖配置
│   └── tsconfig.json              # TypeScript 配置
├── database_init.sql             # 数据库初始化脚本
├── AI_RULES.md                   # AI 开发规则
├── docs/                         # 项目文档
│   └── SETUP_GUIDE.md            # 部署指南（本文件）
├── package.json                  # 根依赖
├── railway.json                  # Railway 部署配置
└── README.md                     # 项目说明
```

## 🎯 功能说明

### 数据库功能（无需外部API）
- ✅ 授权码统计
- ✅ 授权码列表查看
- ✅ 授权码详情
- ✅ 删除授权码
- ✅ 清理过期会话

### 外部API功能（需要配置API）
- 📦 创建授权码（调用外部API）
- 🏠 房间管理
- 🧪 快速联调测试
- 🔧 API 配置管理

### 管理功能
- 🔐 用户登录/登出
- 🔑 修改密码
- ⚙️ API 配置
- 🔄 刷新数据

## 📞 技术支持

如遇到问题，请：
1. 查看 Railway 日志
2. 检查浏览器控制台错误
3. 确认所有环境变量正确配置
4. 确认数据库已正确初始化

## 📝 更新日志

### v1.0.0 (2025-01-20)
- ✅ 完成基础架构
- ✅ 数据库集成
- ✅ 用户认证
- ✅ 授权码管理
- ✅ 外部API集成
- ✅ CSS 模块化
- ✅ HTML 重构
- ✅ 按钮功能修复
