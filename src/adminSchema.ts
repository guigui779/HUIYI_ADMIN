export const TG_CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS tg_admins (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_config (key, value) VALUES
  ('api_url', ''),
  ('api_url_main', ''),
  ('api_url_backup', ''),
  ('usage_instructions', '📖 平台使用说明\n\n1️⃣ 购买后授权码会进入当前分组\n2️⃣ 授权码从第一次进入会议开始计时，有效时间 12 小时\n3️⃣ 授权码一码一房间，会议结束后可再次开设房间'),
  ('customer_service', '@yunjihuiyi_support'),
  ('purchase_notice', '📌 使用说明\n\n1️⃣ 授权码从第一次进入会议开始计时\n2️⃣ 授权码一码一房间\n3️⃣ 会议结束后可再次开设房间')
ON CONFLICT (key) DO NOTHING;
`;
