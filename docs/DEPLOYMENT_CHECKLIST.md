# 通义听悟管理后台 - 部署检查清单

使用此清单确保您的应用已正确部署并运行。

## 📋 部署前检查

### 1. Supabase 数据库准备

- [ ] 已创建 Supabase 项目
- [ ] 已复制 **Project URL**（格式：https://xxx.supabase.co）
- [ ] 已复制 **service_role key**（不是 anon key）
- [ ] 已在 SQL Editor 中执行 `database_init.sql`
- [ ] 确认所有表都已创建（应该有 10 个表）
- [ ] 确认所有表都已启用 RLS（Row Level Security）
- [ ] 确认所有表都有 `service_role_all` 策略

### 2. 代码准备

- [ ] 已克隆代码仓库到本地
- [ ] 已运行 `npm install` 安装依赖
- [ ] 已复制 `api/.env.example` 为 `api/.env`
- [ ] 已在 `api/.env` 中填写正确的环境变量

### 3. Railway 准备

- [ ] 已在 Railway 创建新项目
- [ ] 已连接 GitHub 仓库
- [ ] 已在 Railway Variables 中设置环境变量

## 🔧 环境变量检查

### 必需变量

- [ ] `SUPABASE_URL` - 格式：`https://xxx.supabase.co`
- [ ] `SUPABASE_SERVICE_KEY` - 必须是 service_role key
- [ ] `API_SECRET` - 自定义的 API 密钥

### 可选变量

- [ ] `ADMIN_CONSOLE_USERNAME` - 管理后台用户名（可选，不设置则需通过 API 初始化）
- [ ] `ADMIN_CONSOLE_PASSWORD` - 管理后台密码（可选，不设置则需通过 API 初始化）
- [ ] `ADMIN_CONSOLE_JWT_SECRET` - JWT 密钥（默认使用 API_SECRET）
- [ ] `LIVEKIT_HOST` - LiveKit 服务器地址
- [ ] `LIVEKIT_API_KEY` - LiveKit API 密钥
- [ ] `LIVEKIT_API_SECRET` - LiveKit API 密钥

## 🚀 部署检查

### 1. 构建检查

- [ ] Railway 构建成功（无错误）
- [ ] TypeScript 编译成功
- [ ] 所有依赖都正确安装

### 2. 启动检查

- [ ] 服务已成功启动
- [ ] 日志中显示：`Supabase 已连接: <URL>`
- [ ] 日志中显示：`管理后台已启动: http://localhost:3000`

### 3. 健康检查

- [ ] 访问 `/health/ping` 返回 200
- [ ] `/health/ping` 响应包含 `"status": "ok"`
- [ ] `/health/ping` 响应包含 `timestamp`

## 🔐 功能测试检查

### 1. 登录测试

- [ ] 访问管理后台页面（Railway 域名）
- [ ] 显示登录界面
- [ ] 如果环境变量未设置，先调用 `/console/auth/init` 初始化账号密码
- [ ] 使用配置的用户名和密码登录
- [ ] 登录成功，进入主界面

**初始化管理后台（如需要）**:
```bash
curl -X POST https://your-domain.railway.app/console/auth/init \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "setupKey": "YOUR_API_SECRET"
  }'
```

### 2. 数据库功能测试

- [ ] "数据库: 已连接" 状态显示
- [ ] 授权码统计数据显示（可用码、已分配码、使用中、已过期）
- [ ] 授权码列表显示
- [ ] 点击 "详情" 按钮可以查看详情
- [ ] 点击 "删除" 按钮可以删除授权码

### 3. API 配置测试（可选）

- [ ] 可以输入 API 地址
- [ ] 可以输入 API Secret
- [ ] 点击 "保存并连接" 按钮成功
- [ ] "外部API: 已连接" 状态显示
- [ ] 可以添加备用接口
- [ ] 可以删除接口配置

### 4. 外部 API 功能测试（需要配置 API）

- [ ] 可以创建授权码
- [ ] 可以查看房间列表
- [ ] 可以删除房间
- [ ] 快速联调功能正常工作

## 📊 日志检查

### 正常日志应该包含

```
Supabase 已连接: https://xxx.supabase.co
管理后台已启动: http://localhost:3000
```

### 错误日志检查

- [ ] 日志中**没有** "Supabase 未初始化" 错误
- [ ] 日志中**没有** "后台登录未配置" 错误
- [ ] 日志中**没有** "无效的 API 密钥" 错误

## 🌐 网络检查

### 后端访问

- [ ] 后端域名可以访问
- [ ] `/health/ping` 可以访问
- [ ] API 响应时间 < 3秒

### 前端访问

- [ ] 前端页面可以访问
- [ ] CSS 样式正确加载
- [ ] JavaScript 文件正确加载
- [ ] 没有 404 错误

## 🔒 安全检查

- [ ] `SUPABASE_SERVICE_KEY` 已正确设置（不是 public/anon key）
- [ ] `API_SECRET` 已设置为强密码
- [ ] 管理后台密码已设置为强密码（不是 admin、password、123456 等弱密码）
- [ ] 没有将 `.env` 文件提交到 Git
- [ ] Railway 环境变量不在公开代码中
- [ ] 管理后台已通过环境变量或 /auth/init 接口初始化

## 🎯 性能检查

- [ ] 页面加载时间 < 3秒
- [ ] API 响应时间 < 2秒
- [ ] 数据库查询正常
- [ ] 没有内存泄漏警告

## ✅ 最终验证清单

完成以下步骤确认部署成功：

1. **访问应用**
   - [ ] 打开 Railway 提供的域名
   - [ ] 看到登录界面

2. **登录系统**
   - [ ] 输入用户名和密码
   - [ ] 点击登录按钮
   - [ ] 成功进入管理后台

3. **查看数据**
   - [ ] 看到授权码统计数据
   - [ ] 看到授权码列表
   - [ ] 状态显示 "数据库: 已连接"

4. **测试操作**
   - [ ] 点击 "刷新全部" 按钮
   - [ ] 数据刷新成功
   - [ ] 显示提示信息

5. **退出登录**
   - [ ] 点击 "退出登录" 按钮
   - [ ] 返回登录界面

## 🚨 常见部署问题及解决方案

### 问题 1: "Supabase 未初始化"

**原因**: 环境变量未正确设置

**解决方案**:
1. 检查 Railway Variables 中的变量名
2. 确认 `SUPABASE_URL` 格式正确
3. 确认 `SUPABASE_SERVICE_KEY` 是 service_role key
4. 重启服务

### 问题 2: "后台登录未配置"

**原因**: 管理后台凭据未配置

**解决方案**:
1. 检查是否设置了 `API_SECRET`（这是必需的）
2. 方案A：设置环境变量 `ADMIN_CONSOLE_USERNAME` 和 `ADMIN_CONSOLE_PASSWORD`
3. 方案B：调用 `/console/auth/init` 接口初始化（需要提供 setupKey=API_SECRET）
4. 初始化后重新登录

**初始化示例**:
```bash
curl -X POST https://your-domain.railway.app/console/auth/init \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "setupKey": "YOUR_API_SECRET"
  }'
```

### 问题 3: 按钮无法点击

**原因**: JavaScript 加载失败或错误

**解决方案**:
1. 检查浏览器控制台（F12）错误
2. 确认所有 JS 文件都正确加载
3. 刷新页面（Ctrl + F5）

### 问题 4: API 连接失败

**原因**: 外部 API 未配置或不可访问

**解决方案**:
1. 确认外部 API 地址配置正确
2. 确认外部 API 可以访问
3. 检查 API Secret 是否正确

## 📝 部署完成

如果以上所有检查都通过，恭喜！您的应用已成功部署。

**下一步建议**:
- 定期备份数据库
- 监控应用性能
- 定期更新依赖包
- 启用日志监控

## 🆘 获取帮助

如果遇到问题：
1. 查看本文档的"常见部署问题"部分
2. 检查 Railway 日志
3. 检查浏览器控制台错误
4. 查看项目 README.md 和 SETUP_GUIDE.md

---

**祝您部署成功！** 🎉
