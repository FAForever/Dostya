CREATE TABLE IF NOT EXISTS bans(
    id            INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL ,
    target_id     TEXT                NOT NULL,
    issuer_id     TEXT                NOT NULL,
    unban_at      TIMESTAMP           DEFAULT NULL,
    reason        TEXT                NOT NULL,
    create_time   TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    moderator_action_id INTEGER DEFAULT NULL
);
