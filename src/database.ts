import { Pool } from 'pg';
import { TG_CREATE_TABLES_SQL } from './adminSchema';

let pool: Pool;

export function initDatabase(connectionString: string): Pool {
  pool = new Pool({ connectionString, max: 20 });
  pool.on('error', (err) => {
    console.error('数据库连接池异常:', err.message);
  });
  console.log('PostgreSQL 连接池已创建');
  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return pool;
}

export const CREATE_TABLES_SQL = `
-- 邀请码表
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  room_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  ttl_seconds INTEGER NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 2,
  assigned_to BIGINT,
  assigned_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires ON invite_codes(expires_at);

-- 应用配置表
CREATE TABLE IF NOT EXISTS app_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

${TG_CREATE_TABLES_SQL}
`;
