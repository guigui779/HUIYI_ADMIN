import { getPool } from './database';

export interface CodeDetail {
  code: string;
  room_name: string | null;
  activated_at: string | null;
  expires_at: string | null;
  ttl_seconds: number;
  created_at: string;
  status: 'unused' | 'in_use' | 'expired';
  remaining_seconds: number | null;
}

function codeStatus(item: { activated_at: string | null; expires_at: string | null; room_name: string | null }, now = Date.now()): CodeDetail['status'] {
  const exp = item.expires_at ? new Date(item.expires_at).getTime() : null;
  if (exp !== null && exp <= now) return 'expired';
  if (item.room_name || item.activated_at) return 'in_use';
  return 'unused';
}

function remainingSeconds(expires_at: string | null, now = Date.now()): number | null {
  if (!expires_at) return null;
  return Math.max(0, Math.floor((new Date(expires_at).getTime() - now) / 1000));
}

export async function assignInviteCodes(
  codes: string[],
  assignment: { assignedTo?: number | null; assignedName?: string; note?: string } = {},
  options: { ttlSeconds: number; maxParticipants?: number },
): Promise<boolean> {
  const pool = getPool();
  const normalized = Array.from(new Set(codes.map(code => code.trim().toUpperCase()).filter(Boolean)));
  if (!normalized.length) return true;

  try {
    const { rows: existingRows } = await pool.query(
      'SELECT code FROM invite_codes WHERE code = ANY($1)',
      [normalized],
    );
    const existingCodes = new Set(existingRows.map((row: any) => row.code));
    const missingCodes = normalized.filter((code) => !existingCodes.has(code));

    if (missingCodes.length) {
      const values: any[] = [];
      const placeholders: string[] = [];
      let idx = 1;
      for (const code of missingCodes) {
        placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        values.push(
          code,
          options.ttlSeconds,
          options.maxParticipants ?? 2,
          assignment.assignedTo ?? null,
          assignment.assignedName ?? '',
          assignment.note ?? '',
        );
      }
      await pool.query(
        `INSERT INTO invite_codes (code, ttl_seconds, max_participants, assigned_to, assigned_name, note) VALUES ${placeholders.join(', ')}`,
        values,
      );
    }

    const setClauses: string[] = [];
    const updateParams: any[] = [];
    let pIdx = 1;
    if (Object.prototype.hasOwnProperty.call(assignment, 'assignedTo')) {
      setClauses.push(`assigned_to = $${pIdx++}`);
      updateParams.push(assignment.assignedTo ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(assignment, 'assignedName')) {
      setClauses.push(`assigned_name = $${pIdx++}`);
      updateParams.push(assignment.assignedName ?? '');
    }
    if (Object.prototype.hasOwnProperty.call(assignment, 'note')) {
      setClauses.push(`note = $${pIdx++}`);
      updateParams.push(assignment.note ?? '');
    }
    if (setClauses.length) {
      updateParams.push(normalized);
      await pool.query(
        `UPDATE invite_codes SET ${setClauses.join(', ')} WHERE code = ANY($${pIdx})`,
        updateParams,
      );
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Invite Codes ─────────────────────────────────────────────────────────────

export async function markCodeUnused(code: string): Promise<boolean> {
  try {
    const result = await getPool().query(
      'UPDATE invite_codes SET room_name = NULL WHERE code = $1',
      [code],
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function deleteUserCode(code: string): Promise<boolean> {
  try {
    await getPool().query('DELETE FROM invite_codes WHERE code = $1', [code]);
    return true;
  } catch {
    return false;
  }
}

export async function deleteUserCodes(codes: string[]): Promise<boolean> {
  const normalized = codes.map(c => c.trim().toUpperCase()).filter(Boolean);
  if (!normalized.length) return true;
  try {
    await getPool().query('DELETE FROM invite_codes WHERE code = ANY($1)', [normalized]);
    return true;
  } catch {
    return false;
  }
}

export async function getCodeDetail(code: string): Promise<CodeDetail | null> {
  const { rows } = await getPool().query(
    'SELECT * FROM invite_codes WHERE code = $1',
    [code.trim().toUpperCase()],
  );
  const data = rows[0];
  if (!data) return null;
  return {
    code: data.code,
    room_name: data.room_name,
    activated_at: data.activated_at,
    expires_at: data.expires_at,
    ttl_seconds: data.ttl_seconds,
    created_at: data.created_at,
    status: codeStatus(data),
    remaining_seconds: remainingSeconds(data.expires_at),
  };
}

export async function getAllInviteCodes(limit = 200): Promise<any[]> {
  const { rows } = await getPool().query(
    'SELECT * FROM invite_codes ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  const now = Date.now();
  return rows.map((item: any) => {
    const status = codeStatus(item, now);
    const isAssigned = status !== 'expired' && !item.activated_at &&
      (!!item.assigned_to || (item.assigned_name && item.assigned_name.trim()));
    return {
      code: item.code,
      status: status === 'in_use' ? 'in_use' : status === 'expired' ? 'expired' : isAssigned ? 'assigned' : 'available',
      in_use: status === 'in_use',
      expires_at: item.expires_at ?? null,
      bound_room: item.room_name ?? null,
      created_at: item.created_at,
      activated_at: item.activated_at ?? null,
      max_participants: item.max_participants ?? 2,
      assigned_to: item.assigned_to ?? null,
      assigned_name: item.assigned_name ?? '',
      note: item.note ?? '',
    };
  });
}

export async function getInviteCodeStats(): Promise<{ available: number; assigned: number; in_use: number; expired: number; total: number }> {
  const { rows } = await getPool().query(
    'SELECT activated_at, expires_at, room_name, assigned_to, assigned_name FROM invite_codes',
  );
  if (!rows.length) return { available: 0, assigned: 0, in_use: 0, expired: 0, total: 0 };
  const now = Date.now();
  let in_use = 0, expired = 0;
  for (const item of rows) {
    const s = codeStatus(item as any, now);
    if (s === 'expired') { expired++; continue; }
    if (s === 'in_use') { in_use++; continue; }
  }
  const available = rows.length - in_use - expired;
  return { available, assigned: 0, in_use, expired, total: rows.length };
}

export async function deleteExpiredCodes(): Promise<number> {
  try {
    const result = await getPool().query(
      'DELETE FROM invite_codes WHERE expires_at < $1',
      [new Date().toISOString()],
    );
    return result.rowCount ?? 0;
  } catch {
    return 0;
  }
}

// ─── App Config ───────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const { rows } = await getPool().query('SELECT value FROM app_config WHERE key = $1', [key]);
  return rows[0]?.value || null;
}

export async function getAllSettings(): Promise<{ key: string; value: string }[]> {
  const { rows } = await getPool().query('SELECT key, value FROM app_config ORDER BY key ASC');
  return rows as { key: string; value: string }[];
}

export async function getSettingsByPrefix(prefix: string): Promise<{ key: string; value: string }[]> {
  const { rows } = await getPool().query('SELECT key, value FROM app_config WHERE key LIKE $1', [`${prefix}%`]);
  return (rows as { key: string; value: string }[]).filter((item) => item.value);
}

export async function setSetting(key: string, value: string): Promise<boolean> {
  try {
    await getPool().query(
      'INSERT INTO app_config (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at',
      [key, value, new Date().toISOString()],
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteSetting(key: string): Promise<boolean> {
  try {
    await getPool().query('DELETE FROM app_config WHERE key = $1', [key]);
    return true;
  } catch {
    return false;
  }
}

// ─── Console Credentials ─────────────────────────────────────────────────────

export async function getConsoleCredentials(): Promise<{ username: string | null; password: string | null }> {
  const [u, p] = await Promise.all([getSetting('console_username'), getSetting('console_password')]);
  return { username: u, password: p };
}

export async function setConsolePassword(newPassword: string): Promise<boolean> {
  return setSetting('console_password', newPassword);
}

export async function setConsoleUsername(newUsername: string): Promise<boolean> {
  return setSetting('console_username', newUsername);
}

// ─── Backward-compat aliases (used by routes.ts / backofficeRouter.ts) ────────

export const setAppConfigValue = setSetting;
export const getAllAppConfig = getAllSettings;
