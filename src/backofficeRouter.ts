import { Request, RequestHandler, Response, Router } from 'express';
import * as externalApi from './externalApi';
import {
  deleteUserCode,
  deleteSetting,
  getAllInviteCodes,
  getAllSettings,
  getCodeDetail,
  getInviteCodeStats,
  getSetting,
  getSettingsByPrefix,
  markCodeUnused,
  setSetting,
} from './adminStore';

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

const wrap = (fn: AsyncHandler): RequestHandler =>
  (req, res) => fn(req, res).catch(e => { res.status(500).json({ error: (e as Error).message }); });

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : ''; }

function int(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && v.trim()) { const n = parseInt(v, 10); return isNaN(n) ? null : n; }
  return null;
}

function normalizeUrl(v: string): string | null {
  const s = v.trim().replace(/\/$/, '');
  return /^https?:\/\//i.test(s) ? s : null;
}

async function pingUrl(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/api/health`);
    return r.ok || r.status === 401;
  } catch { return false; }
}

export function registerBackofficeRoutes(router: Router, requireAdmin: RequestHandler) {

  // 概览
  router.get('/summary', requireAdmin, wrap(async (_req, res) => {
    const [settings, codeStats] = await Promise.all([getAllSettings(), getInviteCodeStats()]);
    res.json({ ok: true, settings, codeStats });
  }));

  // ─── 设置 ────────────────────────────────────────────────────────────────

  router.get('/settings', requireAdmin, wrap(async (_req, res) => {
    const [settings, backups] = await Promise.all([getAllSettings(), getSettingsByPrefix('api_url_backup')]);
    res.json({ settings, apiUrlBackups: backups });
  }));

  router.put('/settings/:key', requireAdmin, wrap(async (req, res) => {
    const key = str(req.params.key);
    const value = str(req.body.value);
    if (!key) { res.status(400).json({ error: '缺少 key' }); return; }
    if (!value) { res.status(400).json({ error: '缺少 value' }); return; }
    (await setSetting(key, value))
      ? res.json({ ok: true })
      : res.status(500).json({ error: '更新设置失败' });
  }));

  router.delete('/settings/:key', requireAdmin, wrap(async (req, res) => {
    const key = str(req.params.key);
    if (!key) { res.status(400).json({ error: '缺少 key' }); return; }
    res.json({ ok: await deleteSetting(key) });
  }));

  // ─── API URL 管理 ─────────────────────────────────────────────────────────

  router.get('/api-urls', requireAdmin, wrap(async (_req, res) => {
    const [currentRaw, mainRaw, backups] = await Promise.all([
      getSetting('api_url'), getSetting('api_url_main'),
      getSettingsByPrefix('api_url_backup'),
    ]);
    res.json({
      currentUrl: normalizeUrl(currentRaw || '') || '',
      mainUrl: normalizeUrl(mainRaw || '') || '',
      apiSecret: process.env.API_SECRET?.trim() || '',
      backups: backups.map(b => ({ key: b.key, value: normalizeUrl(b.value) || '' })).filter(b => b.value),
    });
  }));

  router.put('/api-urls/main', requireAdmin, wrap(async (req, res) => {
    const rawUrl = str(req.body.url);

    if (rawUrl === '') {
      const results = await Promise.all(['api_url_main', 'api_url'].map(k => setSetting(k, '')));
      if (results.some(r => !r)) { res.status(500).json({ error: '清空配置失败' }); return; }
      res.json({ ok: true, currentUrl: '', mainUrl: '', cleared: true }); return;
    }

    const url = normalizeUrl(rawUrl);
    if (!url) { res.status(400).json({ error: '接口地址格式错误，请以 http:// 或 https:// 开头' }); return; }

    const ops: Promise<boolean>[] = [setSetting('api_url_main', url), setSetting('api_url', url)];
    if ((await Promise.all(ops)).some(r => !r)) { res.status(500).json({ error: '保存使用中失败' }); return; }
    res.json({ ok: true, currentUrl: url, mainUrl: url });
  }));

  router.post('/api-urls/backups', requireAdmin, wrap(async (req, res) => {
    const url = normalizeUrl(str(req.body.url));
    if (!url) { res.status(400).json({ error: '接口地址格式错误，请以 http:// 或 https:// 开头' }); return; }
    const existing = await getSettingsByPrefix('api_url_backup');
    if (existing.some(b => normalizeUrl(b.value) === url)) { res.status(409).json({ error: '该备用接口已存在' }); return; }
    const maxNum = existing.reduce((max, b) => {
      const m = b.key.match(/api_url_backup_?(\d*)$/);
      return m ? Math.max(max, parseInt(m[1] || '1', 10)) : max;
    }, 0);
    const nextKey = maxNum === 0 ? 'api_url_backup' : `api_url_backup_${maxNum + 1}`;
    (await setSetting(nextKey, url))
      ? res.json({ ok: true, key: nextKey, url })
      : res.status(500).json({ error: '添加备用接口失败' });
  }));

  router.delete('/api-urls/backups/:key', requireAdmin, wrap(async (req, res) => {
    const key = str(req.params.key);
    if (!key.startsWith('api_url_backup')) { res.status(400).json({ error: '只能删除备用接口配置' }); return; }
    res.json({ ok: await deleteSetting(key) });
  }));

  router.post('/api-urls/check-single', requireAdmin, wrap(async (req, res) => {
    const url = normalizeUrl(str(req.body.url));
    if (!url) { res.status(400).json({ error: '无效的接口地址' }); return; }
    const healthy = await pingUrl(url);
    res.json({ ok: true, url, healthy });
  }));

  router.post('/api-urls/promote', requireAdmin, wrap(async (req, res) => {
    const backupKey = str(req.body.key);
    if (!backupKey.startsWith('api_url_backup')) { res.status(400).json({ error: '只能提升备用接口' }); return; }
    const [currentMain, backupVal] = await Promise.all([
      getSetting('api_url_main'),
      getSetting(backupKey),
    ]);
    const newMain = normalizeUrl(backupVal || '');
    if (!newMain) { res.status(404).json({ error: '备用接口不存在或地址无效' }); return; }
    const oldMain = normalizeUrl(currentMain || '');
    const ops: Promise<boolean>[] = [
      setSetting('api_url_main', newMain),
      setSetting('api_url', newMain),
    ];
    if (oldMain) {
      ops.push(setSetting(backupKey, oldMain));
    } else {
      ops.push(deleteSetting(backupKey));
    }
    if ((await Promise.all(ops)).some(r => !r)) { res.status(500).json({ error: '切换使用中失败' }); return; }
    res.json({ ok: true, newMain, oldMain });
  }));

  router.post('/api-urls/health-check', requireAdmin, wrap(async (_req, res) => {
    const [currentRaw, backups] = await Promise.all([getSetting('api_url'), getSettingsByPrefix('api_url_backup')]);
    const currentUrl = normalizeUrl(currentRaw || '');
    const currentHealthy = currentUrl ? await pingUrl(currentUrl) : false;
    const backupResults = await Promise.all(
      backups.map(b => ({ key: b.key, url: normalizeUrl(b.value) || '' })).filter(b => b.url)
        .map(async b => ({ ...b, healthy: await pingUrl(b.url) })),
    );
    let switchedTo: string | null = null;
    if (!currentHealthy) {
      const healthy = backupResults.find(b => b.healthy);
      if (healthy && await setSetting('api_url', healthy.url)) switchedTo = healthy.url;
    }
    res.json({
      ok: true,
      current: { key: 'api_url', url: currentUrl || '', healthy: currentHealthy },
      backups: backupResults,
      switchedTo,
    });
  }));

  // ─── 授权码查询 ───────────────────────────────────────────────────────────

  router.get('/codes/stats', requireAdmin, wrap(async (_req, res) => { res.json(await getInviteCodeStats()); }));

  router.get('/codes', requireAdmin, wrap(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const codes = await getAllInviteCodes(limit);
    res.json({ codes, total: codes.length });
  }));

  router.get('/codes/:code', requireAdmin, wrap(async (req, res) => {
    const detail = await getCodeDetail(str(req.params.code));
    detail ? res.json(detail) : res.status(404).json({ error: '授权码不存在' });
  }));

  router.post('/codes/:code/release', requireAdmin, wrap(async (req, res) => {
    const code = str(req.params.code).toUpperCase();
    if (!code) { res.status(400).json({ error: '缺少 code' }); return; }
    const result = await externalApi.releaseCode(code);
    if (!result.ok && result.error !== '音视频 API 地址未配置') {
      res.status(500).json({ error: result.error || '释放授权码失败' });
      return;
    }
    if (!await markCodeUnused(code)) {
      res.status(500).json({ error: '释放成功，但数据库状态更新失败' });
      return;
    }
    res.json({ ok: true });
  }));

  router.delete('/codes/:code', requireAdmin, wrap(async (req, res) => {
    const code = str(req.params.code).toUpperCase();
    if (!code) { res.status(400).json({ error: '缺少 code' }); return; }
    const detail = await getCodeDetail(code);
    if (detail?.room_name) { res.status(409).json({ error: '授权码正在使用中，不能删除' }); return; }

    const result = await externalApi.revokeInvite(code);
    if (!result.ok && result.error !== '音视频 API 地址未配置') {
      res.status(500).json({ error: result.error || '删除授权码失败' });
      return;
    }

    res.json({ ok: await deleteUserCode(code) });
  }));

  router.delete('/codes', requireAdmin, wrap(async (req, res) => {
    const codes: unknown = req.body?.codes;
    if (!Array.isArray(codes) || !codes.length) { res.status(400).json({ error: '缺少 codes 数组' }); return; }

    const normalizedCodes = codes.map(String).map((code) => code.trim().toUpperCase()).filter(Boolean);
    const failed: string[] = [];

    for (const code of normalizedCodes) {
      const detail = await getCodeDetail(code);
      if (detail?.room_name) {
        failed.push(code);
        continue;
      }

      const result = await externalApi.revokeInvite(code);
      if (!result.ok && result.error !== '音视频 API 地址未配置') {
        failed.push(code);
        continue;
      }

      const deleted = await deleteUserCode(code);
      if (!deleted) {
        failed.push(code);
      }
    }

    res.json({ ok: failed.length === 0, deleted: normalizedCodes.length - failed.length, failed });
  }));
}
