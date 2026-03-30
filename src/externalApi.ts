// 调用外部音视频 API 的模块
import { getSetting, getSettingsByPrefix, setSetting } from './adminStore';

export interface ExternalApiConfig {
  url: string;
  secret: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

type CreateInviteCodeOptions = {
  count: number;
  expireMinutes: number;
  maxParticipants?: number;
  assignedTo?: number | null;
  assignedName?: string;
  note?: string;
};

type CreateInviteCodeResponse = {
  created: number;
  codes: string[];
  raw: unknown;
};

// 获取当前配置的 API 地址
export async function getApiConfig(): Promise<ExternalApiConfig | null> {
  const [url, secret, legacySecret] = await Promise.all([
    getSetting('api_url'),
    getSetting('api_secret'),
    getSetting('api_key'),
  ]);

  if (!url) return null;
  return { url: url.replace(/\/$/, ''), secret: secret || legacySecret || '' };
}

// 对单个地址发起请求，成功返回 { url, response }，失败返回 null
async function tryFetch(
  baseUrl: string,
  apiPath: string,
  fetchOptions: { method: string; headers: Record<string, string>; body?: string; timeout: number },
): Promise<{ url: string; response: Response } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), fetchOptions.timeout);
  try {
    const response = await fetch(`${baseUrl}${apiPath}`, {
      method: fetchOptions.method,
      headers: fetchOptions.headers,
      body: fetchOptions.body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return { url: baseUrl, response };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

// 竞速：同时请求所有地址，返回最快响应的那个
async function raceApis(
  candidateUrls: string[],
  apiPath: string,
  fetchOptions: { method: string; headers: Record<string, string>; body?: string; timeout: number },
): Promise<{ url: string; response: Response } | null> {
  if (candidateUrls.length === 1) {
    return tryFetch(candidateUrls[0], apiPath, fetchOptions);
  }

  return new Promise((resolve) => {
    let settled = false;
    let remaining = candidateUrls.length;

    for (const url of candidateUrls) {
      tryFetch(url, apiPath, fetchOptions).then((result) => {
        remaining -= 1;
        if (!settled && result !== null) {
          settled = true;
          resolve(result);
        } else if (!settled && remaining === 0) {
          resolve(null);
        }
      });
    }
  });
}

/**
 * 调用外部 API
 * - write: false（默认）→ 竞速模式，同时请求主地址+所有备用地址，最快的赢，自动更新 api_url
 * - write: true         → 写操作模式，只用 api_url_write（未配则降级用 api_url），不竞速避免重复写入
 */
export async function callExternalApi<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    timeout?: number;
    write?: boolean;
  } = {}
): Promise<ApiResponse<T>> {
  const [activeUrlRaw, writeUrlRaw, secret, legacySecret, backups] = await Promise.all([
    getSetting('api_url'),
    getSetting('api_url_write'),
    getSetting('api_secret'),
    getSetting('api_key'),
    options.write ? Promise.resolve([]) : getSettingsByPrefix('api_url_backup'),
  ]);

  if (!activeUrlRaw) {
    return { ok: false, error: '音视频 API 地址未配置' };
  }

  const apiSecret = secret || legacySecret || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiSecret) headers['X-API-Secret'] = apiSecret;

  const apiPath = path.startsWith('/api/') ? path : `/api${path}`;
  const fetchOptions = {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    timeout: options.timeout || 15000,
  };

  // 写操作：只用 api_url_write，未配置则降级用 api_url
  if (options.write) {
    const writeUrl = (writeUrlRaw || activeUrlRaw).replace(/\/$/, '');
    const result = await tryFetch(writeUrl, apiPath, fetchOptions);
    if (!result) return { ok: false, error: '写接口连接失败' };
    const data = await result.response.json().catch(() => ({})) as Record<string, unknown>;
    if (!result.response.ok) {
      return { ok: false, error: typeof data.error === 'string' ? data.error : `HTTP ${result.response.status}` };
    }
    return { ok: true, data: data as T };
  }

  // 读操作：竞速，同时请求主地址 + 所有备用地址
  const activeUrl = activeUrlRaw.replace(/\/$/, '');
  const candidateUrls: string[] = [activeUrl];
  for (const item of backups) {
    const u = item.value?.trim().replace(/\/$/, '');
    if (u && u !== activeUrl) candidateUrls.push(u);
  }

  const winner = await raceApis(candidateUrls, apiPath, fetchOptions);
  if (!winner) {
    return { ok: false, error: '所有接口地址均不可用' };
  }

  // 最快的不是当前主地址 → 自动更新
  if (winner.url !== activeUrl) {
    setSetting('api_url', winner.url).catch(() => undefined);
    console.log(`[API竞速] 切换到更快的地址: ${winner.url}`);
  }

  const data = await winner.response.json().catch(() => ({})) as Record<string, unknown>;
  if (!winner.response.ok) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : `HTTP ${winner.response.status}` };
  }
  return { ok: true, data: data as T };
}

// ===== 外部 API 封装 =====

// 健康检查（走竞速模式）
export async function checkHealth(): Promise<{ ok: boolean; reachable: boolean; data?: any; error?: string }> {
  const result = await callExternalApi<Record<string, unknown>>('/health');
  if (result.ok) return { ok: true, reachable: true, data: result.data };
  if (result.error === '音视频 API 地址未配置') return { ok: false, reachable: false, error: result.error };
  const isNetworkError = result.error?.includes('不可用') || result.error?.includes('连接失败');
  return { ok: false, reachable: !isNetworkError, error: result.error };
}

// 获取房间列表（读，竞速）
export async function getRooms(): Promise<{ ok: boolean; data?: any[]; error?: string }> {
  return callExternalApi('/rooms');
}

// 删除房间（写，不竞速）
export async function deleteRoom(roomName: string): Promise<{ ok: boolean; error?: string }> {
  return callExternalApi(`/rooms/${encodeURIComponent(roomName)}`, { method: 'DELETE', write: true });
}

// 创建邀请码（写，不竞速）
export async function createInviteCodes(
  options: CreateInviteCodeOptions,
): Promise<{ ok: boolean; data?: CreateInviteCodeResponse; error?: string }> {
  const legacyResult = await callExternalApi<Record<string, unknown>>('/codes/create', {
    method: 'POST',
    write: true,
    body: {
      count: options.count,
      expire_minutes: options.expireMinutes,
      assigned_to: options.assignedTo ?? undefined,
      assigned_name: options.assignedName || undefined,
      note: options.note || undefined,
    },
  });
  if (legacyResult.ok) {
    const parsed = parseCreatedCodes(legacyResult.data);
    if (parsed.codes.length) return { ok: true, data: parsed };
    return { ok: false, error: '创建授权码成功，但返回数据中没有授权码' };
  }
  if (legacyResult.error !== 'HTTP 404') {
    return { ok: false, error: legacyResult.error || '创建授权码失败' };
  }

  const batchResult = await callExternalApi<Record<string, unknown>>('/invite/batch', {
    method: 'POST',
    write: true,
    body: {
      count: options.count,
      ttlSeconds: options.expireMinutes * 60,
      maxParticipants: options.maxParticipants ?? 2,
    },
  });
  if (!batchResult.ok) return { ok: false, error: batchResult.error || '创建授权码失败' };
  const parsed = parseCreatedCodes(batchResult.data);
  if (parsed.codes.length) return { ok: true, data: parsed };
  return { ok: false, error: '创建授权码成功，但返回数据中没有授权码' };
}

// 释放房间/授权码（写，不竞速）
export async function releaseCode(code: string): Promise<{ ok: boolean; error?: string }> {
  return callExternalApi('/invite/release', { method: 'POST', write: true, body: { code } });
}

// 撤销邀请码（写，不竞速）
export async function revokeInvite(code: string): Promise<{ ok: boolean; error?: string }> {
  return callExternalApi(`/invite/${encodeURIComponent(code)}`, { method: 'DELETE', write: true });
}

// 获取邀请码详情（读，竞速）
export async function getInviteDetail(code: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  return callExternalApi(`/invite/${encodeURIComponent(code)}`);
}

// 获取邀请码统计（读，竞速）
export async function getInviteStats(): Promise<{ ok: boolean; data?: any; error?: string }> {
  return callExternalApi('/invite/stats');
}

function parseCreatedCodes(payload: unknown): CreateInviteCodeResponse {
  const data = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {};
  const codeList = extractCodeList(data.codes)
    || extractCodeList(data.data)
    || extractCodeList(data.items)
    || [];
  const created = typeof data.created === 'number' ? data.created : codeList.length;
  return { created, codes: codeList, raw: payload };
}

function extractCodeList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const codes = value
    .map((item) => {
      if (typeof item === 'string') return item.trim().toUpperCase();
      if (item && typeof item === 'object' && typeof (item as { code?: unknown }).code === 'string') {
        return ((item as { code: string }).code).trim().toUpperCase();
      }
      return '';
    })
    .filter(Boolean);
  return codes;
}
