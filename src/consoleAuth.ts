import jwt, { SignOptions } from 'jsonwebtoken';
import { getConsoleCredentials, setConsolePassword, setConsoleUsername } from './adminStore';

type TokenPayload = { sub: string; role: 'admin-console' };

// ─── 环境变量读取 ─────────────────────────────────────────────────────────────

function jwtSecret(): string {
  return (
    process.env.ADMIN_CONSOLE_JWT_SECRET?.trim() ||
    process.env.API_SECRET?.trim() ||
    process.env.API_SECRET_KEY?.trim() ||
    ''
  );
}

function envCreds(): { username: string; password: string } | null {
  const u = process.env.ADMIN_CONSOLE_USERNAME?.trim();
  const p = process.env.ADMIN_CONSOLE_PASSWORD?.trim();
  return u && p ? { username: u, password: p } : null;
}

function expiresIn(): string {
  return process.env.ADMIN_CONSOLE_JWT_EXPIRES_IN?.trim() || '12h';
}

// ─── DB 凭据缓存（1分钟）────────────────────────────────────────────────────

let credCache: { username: string | null; password: string | null; ts: number } | null = null;

async function dbCreds(): Promise<{ username: string | null; password: string | null }> {
  const now = Date.now();
  if (credCache && now - credCache.ts < 60_000) return credCache;
  try {
    const c = await getConsoleCredentials();
    credCache = { ...c, ts: now };
    return c;
  } catch {
    return { username: null, password: null };
  }
}

// ─── 公开 API ─────────────────────────────────────────────────────────────────

export async function isConsoleLoginConfiguredAsync(): Promise<boolean> {
  if (!jwtSecret()) return false;
  const env = envCreds();
  if (env) return true;
  const db = await dbCreds();
  return !!(db.username && db.password);
}

function makeToken(username: string): string {
  const secret = jwtSecret();
  if (!secret) throw new Error('未配置 JWT Secret，请设置 API_SECRET');
  return jwt.sign(
    { sub: username, role: 'admin-console' } satisfies TokenPayload,
    secret,
    { expiresIn: expiresIn() as SignOptions['expiresIn'] },
  );
}

export async function createConsoleTokenAsync(username: string, password: string): Promise<string> {
  if (!jwtSecret()) throw new Error('后台登录未配置，请设置 API_SECRET 或 ADMIN_CONSOLE_JWT_SECRET');

  // 优先环境变量
  const env = envCreds();
  if (env) {
    if (username !== env.username || password !== env.password) throw new Error('账号或密码错误');
    return makeToken(env.username);
  }

  // 数据库凭据
  const db = await dbCreds();
  if (!db.username || !db.password) {
    throw new Error('后台登录未配置，请通过 /auth/init 接口初始化或设置环境变量');
  }
  if (username !== db.username || password !== db.password) throw new Error('账号或密码错误');
  return makeToken(db.username);
}

export async function changeConsolePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 4) throw new Error('新密码至少需要4位');
  if (envCreds()?.password) throw new Error('当前使用环境变量配置密码，请修改 ADMIN_CONSOLE_PASSWORD 环境变量');

  const db = await dbCreds();
  if (!db.password) throw new Error('未配置数据库密码，请通过 /auth/init 接口初始化');
  if (currentPassword !== db.password) throw new Error('当前密码错误');

  await setConsolePassword(newPassword);
  if (!db.username) await setConsoleUsername('admin');
  credCache = null;
}

export function verifyConsoleToken(token: string): TokenPayload {
  const secret = jwtSecret();
  if (!secret) throw new Error('后台登录未配置');
  const payload = jwt.verify(token, secret) as Partial<TokenPayload>;
  if (payload.role !== 'admin-console' || typeof payload.sub !== 'string') {
    throw new Error('无效的登录令牌');
  }
  return { sub: payload.sub, role: 'admin-console' };
}

export function readBearerToken(authorizationHeader: string | undefined): string | null {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
