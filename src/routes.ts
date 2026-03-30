import { Router, Request, Response, RequestHandler } from 'express';
import { registerBackofficeRoutes } from './backofficeRouter';
import { createConsoleTokenAsync, isConsoleLoginConfiguredAsync, readBearerToken, verifyConsoleToken, changeConsolePassword } from './consoleAuth';
import { deleteExpiredCodes, assignInviteCodes, getSetting, setSetting, getCodeDetail, markCodeUnused, getSettingsByPrefix } from './adminStore';
import * as externalApi from './externalApi';

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

const wrap = (fn: AsyncHandler): RequestHandler =>
  (req, res) => fn(req, res).catch(e => { res.status(500).json({ error: (e as Error).message }); });

export function createRouter(): Router {
  const router = Router();
  const adminSecret = process.env.API_SECRET?.trim() || process.env.API_SECRET_KEY?.trim() || '';

  const requireAdmin: RequestHandler = (req, res, next) => {
    const bearer = readBearerToken(req.headers.authorization);
    if (bearer) {
      try { verifyConsoleToken(bearer); return next(); }
      catch { res.status(401).json({ error: '登录已失效，请重新登录' }); return; }
    }
    const secret = (req.headers['x-api-secret'] as string) || (req.headers['x-api-key'] as string);
    if (!adminSecret || secret !== adminSecret) { res.status(401).json({ error: '无效的 API 密钥' }); return; }
    next();
  };

  // ─── 公开接口（客户端拉配置，无需鉴权） ─────────────────────────────────────

  router.get('/config', wrap(async (_req, res) => {
    const apiUrl = await getSetting('api_url') || '';
    const backups = await getSettingsByPrefix('api_url_backup');
    res.json({
      api_url: apiUrl,
      backup_urls: backups.map(b => b.value).filter(Boolean),
    });
  }));

  // ─── 认证 ──────────────────────────────────────────────────────────────────

  router.post('/auth/login', wrap(async (req, res) => {
    if (!await isConsoleLoginConfiguredAsync()) {
      res.status(503).json({ error: '后台登录未配置，请联系管理员设置环境变量或数据库' }); return;
    }
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || !password) { res.status(400).json({ error: '缺少账号或密码' }); return; }
    const token = await createConsoleTokenAsync(username, password);
    res.json({ ok: true, token, username });
  }));

  router.post('/auth/change-password', requireAdmin, wrap(async (req, res) => {
    const oldPassword = String(req.body.oldPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!oldPassword || !newPassword) { res.status(400).json({ error: '缺少旧密码或新密码' }); return; }
    if (newPassword.length < 6) { res.status(400).json({ error: '新密码长度至少6位' }); return; }
    await changeConsolePassword(oldPassword, newPassword);
    res.json({ ok: true, message: '密码修改成功' });
  }));

  router.post('/auth/init', wrap(async (req, res) => {
    const { username, password, setupKey } = req.body as Record<string, string | undefined>;
    if (!setupKey || setupKey !== adminSecret) {
      res.status(403).json({ error: '需要提供正确的 setupKey (API_SECRET)' }); return;
    }
    const pwd = password?.trim() ?? '';
    if (!pwd || pwd.length < 4) { res.status(400).json({ error: '密码至少4位' }); return; }
    if (['admin', 'password', '123456'].includes(pwd)) { res.status(400).json({ error: '禁止使用弱密码' }); return; }
    const { getConsoleCredentials, setConsoleUsername, setConsolePassword } = await import('./adminStore');
    const existing = await getConsoleCredentials();
    if (existing.username && existing.password) {
      res.status(400).json({ error: '账号密码已存在，请使用修改密码接口' }); return;
    }
    const newUsername = (username || 'admin').trim();
    await setConsoleUsername(newUsername);
    await setConsolePassword(pwd);
    res.json({ ok: true, message: '账号密码已初始化', username: newUsername });
  }));

  router.get('/auth/me', requireAdmin, (_req, res) => res.json({ ok: true }));

  // ─── 配置 ──────────────────────────────────────────────────────────────────

  router.post('/config', requireAdmin, wrap(async (req, res) => {
    const apiUrl = String(req.body.apiUrl || '').trim();
    const ops: Promise<boolean>[] = [];
    if (apiUrl) ops.push(setSetting('api_url', apiUrl), setSetting('api_url_main', apiUrl));
    const results = await Promise.all(ops);
    if (results.some(r => !r)) { res.status(500).json({ error: '保存失败' }); return; }
    res.json({ ok: true, apiUrl });
  }));

  // ─── 外部 API 代理 ─────────────────────────────────────────────────────────

  router.get('/health', requireAdmin, wrap(async (_req, res) => {
    const result = await externalApi.checkHealth();
    res.json({ ok: result.ok, reachable: result.reachable, external: result.data, error: result.error });
  }));

  router.post('/health/check', requireAdmin, wrap(async (_req, res) => {
    const result = await externalApi.checkHealth();
    res.json({ ok: result.ok, reachable: result.reachable, ...result.data, error: result.error });
  }));

  router.get('/rooms', requireAdmin, wrap(async (_req, res) => {
    const result = await externalApi.getRooms();
    result.ok ? res.json({ ok: true, rooms: result.data }) : res.status(500).json({ error: result.error });
  }));

  router.delete('/rooms/:roomName', requireAdmin, wrap(async (req, res) => {
    const result = await externalApi.deleteRoom(String(req.params.roomName));
    result.ok
      ? res.json({ ok: true, message: `房间 "${req.params.roomName}" 已删除` })
      : res.status(500).json({ error: result.error });
  }));

  router.post('/invite/release', requireAdmin, wrap(async (req, res) => {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) { res.status(400).json({ error: '缺少 code' }); return; }
    const result = await externalApi.releaseCode(code);
    if (!result.ok) { res.status(500).json({ error: result.error }); return; }
    if (!await markCodeUnused(code)) { res.status(500).json({ error: '释放成功，但数据库状态更新失败' }); return; }
    res.json({ ok: true });
  }));

  router.get('/invite/stats', requireAdmin, wrap(async (_req, res) => {
    const result = await externalApi.getInviteStats();
    result.ok ? res.json({ ok: true, ...result.data }) : res.status(500).json({ error: result.error });
  }));

  router.post('/cleanup', requireAdmin, wrap(async (_req, res) => {
    const cleaned = await deleteExpiredCodes();
    res.json({ ok: true, expired_sessions: cleaned });
  }));

  router.post('/codes/create', requireAdmin, wrap(async (req, res) => {
    const count = Number(req.body.count);
    const expireMinutes = Number(req.body.expire_minutes);
    const ttlSeconds = (expireMinutes || 60) * 60;
    const maxParticipants = 2;
    const assignedTo = Number.isInteger(Number(req.body.assigned_to)) && Number(req.body.assigned_to) > 0
      ? Number(req.body.assigned_to)
      : null;
    const assignedName = typeof req.body.assigned_name === 'string' ? req.body.assigned_name.trim() : '';
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
    if (!count || count <= 0) { res.status(400).json({ error: '缺少有效的数量' }); return; }
    if (!assignedTo && !assignedName) { res.status(400).json({ error: '缺少归属信息' }); return; }
    const result = await externalApi.createInviteCodes({
      count,
      expireMinutes: expireMinutes || 60,
      maxParticipants,
      assignedTo,
      assignedName,
      note,
    });
    if (!result.ok || !result.data) { res.status(503).json({ error: result.error || '创建授权码失败' }); return; }
    const codes = result.data.codes;
    if (!await assignInviteCodes(codes, { assignedTo, assignedName, note }, { ttlSeconds, maxParticipants })) {
      res.status(500).json({ error: '授权码创建成功，但归属信息写入失败' }); return;
    }
    res.json({ ok: true, created: result.data.created || codes.length, codes, upstream: result.data.raw });
  }));

  router.get('/code/:code', requireAdmin, wrap(async (req, res) => {
    const detail = await getCodeDetail(String(req.params.code));
    if (detail) { res.json(detail); return; }
    const result = await externalApi.getInviteDetail(String(req.params.code));
    result.ok ? res.json(result.data) : res.status(404).json({ error: '授权码不存在' });
  }));

  // ─── 后台管理路由（数据库）──────────────────────────────────────────────────

  registerBackofficeRoutes(router, requireAdmin);

  return router;
}
