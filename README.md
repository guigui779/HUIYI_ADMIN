# 云际听悟管理后台

一个统一管理授权码、API配置和系统功能的现代化管理后台。

## ✨ 特性

- 🎨 **现代化界面** - 采用优雅的 UI 设计，响应式布局
- 🔐 **安全认证** - JWT Token 认证，支持密码修改
- 📊 **数据统计** - 实时统计授权码使用情况
- 🌐 **API集成** - 支持外部音视频 API 集成
- 💾 **双重存储** - 数据库 + localStorage 双重配置
- 🔄 **自动同步** - 配置自动同步到数据库
- 🚀 **快速部署** - 支持 Railway、Docker 等多种部署方式

## 🏗️ 技术栈

### 后端
- **Node.js** + **Express** - RESTful API 服务器
- **TypeScript** - 类型安全的 JavaScript
- **Supabase** - PostgreSQL 数据库 + 实时功能
- **JWT** - 用户认证
- **LiveKit SDK** - 视频会议集成

### 前端
- **Vanilla JavaScript** - 原生 JavaScript，无框架依赖
- **HTML5** + **CSS3** - 现代化界面
- **模块化 CSS** - 易于维护和定制

### 部署
- **Railway** - 主要部署平台
- **Docker** - 容器化部署
- **Vercel** - 无服务器部署（可选）

## 🚀 快速开始

### 本地开发

1. **克隆仓库**
```bash
git clone <your-repo-url>
cd your-project
```

2. **安装依赖**
```bash
npm install
cd api
npm install
```

3. **配置环境变量**
```bash
cp api/.env.example api/.env
# 编辑 api/.env 文件，填写你的配置
```

4. **初始化数据库**
- 访问 Supabase 控制台
- 打开 SQL Editor
- 执行 `database_init.sql` 文件中的 SQL

5. **启动服务**
```bash
npm run dev
```

6. **访问应用**
打开浏览器访问：http://localhost:3000

### Railway 部署

1. **连接 GitHub 仓库**
   - 在 Railway 创建新项目
   - 从 GitHub 导入仓库

2. **配置环境变量**
   在 Railway 的 Variables 中添加：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `API_SECRET`

3. **自动部署**
   - Railway 会自动检测并部署
   - 等待部署完成

4. **访问应用**
   - 使用 Railway 提供的域名访问

详细部署指南请查看 [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)


## 📁 项目结构

```
云际听悟管理后台/
├── src/                          # TypeScript 后端源码
│   ├── index.ts                  # 应用入口
│   ├── routes.ts                 # API 路由
│   ├── backofficeRouter.ts       # 后台管理路由
│   ├── database.ts               # 数据库连接
│   ├── adminStore.ts             # 数据库操作
│   ├── adminSchema.ts            # 数据库架构
│   ├── consoleAuth.ts            # 认证逻辑
│   ├── externalApi.ts            # 外部 API 集成
│   ├── env.ts                    # 环境变量
│   └── models.ts                 # 数据模型
├── public/                       # 前端代码
│   ├── index.html                # 主页面
│   ├── css/                      # 样式文件（模块化）
│   │   ├── admin.css             # 主样式
│   │   ├── variables.css         # CSS 变量
│   │   ├── base.css              # 基础样式
│   │   ├── layout.css            # 布局样式
│   │   ├── components.css        # 组件样式
│   │   ├── modules.css           # 模块样式
│   │   └── responsive.css        # 响应式
│   └── js/                       # JavaScript 文件
│       ├── login.js              # 登录模块
│       ├── config.js             # 配置模块
│       ├── api.js                # API 调用模块
│       └── app.js                # 主应用模块
├── database_init.sql             # 数据库初始化脚本
├── AI_RULES.md                   # AI 开发规则
├── docs/                         # 项目文档
│   ├── SETUP_GUIDE.md            # 部署指南
│   ├── DEPLOYMENT_CHECKLIST.md   # 部署检查清单
│   └── OPTIMIZATION_SUMMARY.md   # 优化总结
├── package.json                  # 依赖配置
├── tsconfig.json                 # TypeScript 配置
├── railway.json                  # Railway 部署配置
└── nixpacks.toml                 # Nixpacks 构建配置
```

## 🎯 核心功能

### 数据库功能（无需外部 API）

- ✅ **授权码统计** - 查看可用、已分配、使用中、过期的授权码
- ✅ **授权码列表** - 查看所有授权码及其状态
- ✅ **授权码详情** - 查看单个授权码的详细信息
- ✅ **删除授权码** - 删除未使用的授权码
- ✅ **清理过期会话** - 清理过期的授权码

### 外部 API 功能（需要配置 API）

- 📦 **创建授权码** - 批量创建授权码（调用外部 API）
- 🏠 **房间管理** - 管理视频会议房间
- 🧪 **快速联调** - 测试 API 功能
- ⚙️ **API 配置** - 管理外部 API 配置

### 管理功能

- 🔐 **用户登录/登出** - 安全的认证系统
- 🔑 **修改密码** - 修改管理后台密码
- 📊 **数据刷新** - 实时刷新数据
- 🌐 **API 配置管理** - 管理使用中和备用接口

## 🔧 环境变量

| 变量名 | 必需 | 说明 | 示例 |
|--------|------|------|------|
| `SUPABASE_URL` | ✅ | Supabase 项目 URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase service_role key | `eyJ...` |
| `API_SECRET` | ✅ | API 密钥（也用于管理后台初始化） | `your-secret-key` |
| `ADMIN_CONSOLE_USERNAME` | ❌ | 管理后台用户名（可选，不设置则需通过 API 初始化） | `admin` |
| `ADMIN_CONSOLE_PASSWORD` | ❌ | 管理后台密码（可选，不设置则需通过 API 初始化） | `your-secure-password` |
| `LIVEKIT_HOST` | ❌ | LiveKit 服务器地址 | `wss://xxx.com` |
| `LIVEKIT_API_KEY` | ❌ | LiveKit API 密钥 | `xxx` |
| `LIVEKIT_API_SECRET` | ❌ | LiveKit API 密钥 | `xxx` |

详细说明请查看 [.env.example](.env.example)

## 📚 API 端点

### 认证相关
- `POST /console/auth/login` - 登录（需先配置环境变量或通过 /auth/init 初始化）
- `POST /console/auth/init` - 初始化管理后台账号密码（需要 setupKey=API_SECRET）
- `POST /console/auth/change-password` - 修改密码
- `GET /console/auth/me` - 获取当前用户信息

### 数据库功能
- `GET /console/codes/stats` - 获取授权码统计
- `GET /console/codes` - 获取授权码列表
- `GET /console/codes/:code` - 获取授权码详情
- `DELETE /console/codes` - 删除授权码（批量）
- `POST /console/cleanup` - 清理过期会话

### 外部 API 功能
- `POST /console/codes/create` - 创建授权码
- `GET /console/rooms` - 获取房间列表
- `DELETE /console/rooms/:roomName` - 删除房间
- `POST /console/invite/release` - 释放授权码

### 配置管理
- `GET /console/config` - 获取配置
- `POST /console/config` - 保存配置
- `GET /console/api-urls` - 获取 API 配置
- `PUT /console/api-urls/main` - 设置主 API
- `POST /console/api-urls/backups` - 添加备用 API
- `DELETE /console/api-urls/backups/:key` - 删除备用 API

### 健康检查
- `GET /health` - 健康检查
- `GET /health/ping` - Ping 端点

## 🐛 常见问题

### 问题 1: 数据库连接失败
**错误**: `Supabase 未初始化，请先调用 initSupabase()`

**解决方案**:
1. 检查环境变量是否正确设置
2. 确认 `SUPABASE_URL` 格式正确
3. 确认 `SUPABASE_SERVICE_KEY` 是 service_role key
4. 重启服务

### 问题 2: 登录失败
**错误**: `后台登录未配置`

**解决方案**:
1. 检查是否设置了 `API_SECRET`
2. 设置环境变量 `ADMIN_CONSOLE_USERNAME` 和 `ADMIN_CONSOLE_PASSWORD`，或
3. 调用 `/console/auth/init` 接口初始化（需要提供 setupKey=API_SECRET）

**初始化示例**:
```bash
curl -X POST http://localhost:3000/console/auth/init \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "setupKey": "your-api-secret"
  }'
```

### 问题 3: 按钮无法点击
**问题**: 某些按钮点击无反应

**解决方案**:
1. 检查浏览器控制台（F12）是否有 JavaScript 错误
2. 确认所有 JS 文件都正确加载
3. 尝试刷新页面（Ctrl + F5）

### 问题 4: API 连接失败
**错误**: `外部API连接失败`

**解决方案**:
1. 确认外部 API 地址配置正确
2. 确认外部 API 可以访问
3. 检查 API Secret 是否正确
4. 查看后端日志获取详细错误信息

## 📝 开发指南

### 代码规范
项目遵循 [AI_RULES.md](AI_RULES.md) 中定义的编码规范。

### 添加新功能
1. 在 `src/` 中添加后端逻辑
2. 在 `public/js/` 中添加前端逻辑
3. 在 `public/css/` 中添加样式（如需要）
4. 更新数据库架构（如需要）

### 测试
```bash
# 运行开发服务器
npm run dev

# 编译 TypeScript
npm run build

# 启动生产服务器
npm start
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

ISC

## 📞 联系方式

- 项目地址: [GitHub](https://github.com/your-repo)
- 问题反馈: [Issues](https://github.com/your-repo/issues)

---

**注意**: 本项目仅用于学习和研究目的。请遵守相关法律法规。
