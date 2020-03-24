CREATE TABLE IF NOT EXISTS moderator_actions(
    id            INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL ,
    target_id     TEXT                NOT NULL,
    issuer_id     TEXT                NOT NULL,
    action        TINYINT             DEFAULT 0,
    reason        TEXT                NOT NULL,
    create_time   TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
);
