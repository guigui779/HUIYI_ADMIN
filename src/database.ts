import { Pool } from 'pg';

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
