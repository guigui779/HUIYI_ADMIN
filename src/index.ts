import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createRouter } from './routes';
import { initDatabase } from './database';
import { readIntEnv } from './env';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 初始化 PostgreSQL
const databaseUrl = process.env.DATABASE_URL?.trim();
let dbReady = false;

if (databaseUrl) {
  try {
    initDatabase(databaseUrl);
    dbReady = true;
    console.log('PostgreSQL 已连接');
  } catch (err) {
    console.error('PostgreSQL 初始化失败:', (err as Error).message);
  }
} else {
  console.warn('DATABASE_URL 未设置，进入降级模式');
}

// 路由
const router = createRouter();
app.use('/api', router);
app.use('/console', router);

// 健康检查
app.get('/health', (_req, res) => res.json({ ok: true, db: dbReady }));
app.get('/health/ping', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), db: dbReady }));

// 静态文件 + SPA fallback
const publicDir = path.resolve(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('/*path', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/console/') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => res.json({ status: 'ok', db: dbReady }));
}

const port = readIntEnv('PORT', 3000);
app.listen(port, () => console.log(`管理后台已启动: http://localhost:${port}`));
process.on('SIGTERM', () => process.exit(0));
