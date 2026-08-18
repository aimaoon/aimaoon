-- 通知に必要な最小限だけを持つ。大会の中身は端末に残る。

CREATE TABLE IF NOT EXISTS subscriptions (
  id         TEXT PRIMARY KEY,          -- endpoint の SHA-256
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id              TEXT PRIMARY KEY,     -- 購読 ID + 端末側のキー
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  at              TEXT NOT NULL,        -- ISO 8601 (UTC)
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  sent_at         TEXT
);

-- Cron が毎回引く条件に合わせた索引。
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders (at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_subscription ON reminders (subscription_id);
