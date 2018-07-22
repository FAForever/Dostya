CREATE TABLE IF NOT EXISTS account_links(
    `id`            INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL ,
    `faf_id`        MEDIUMINT UNSIGNED  NOT NULL,
    `discord_id`    TEXT                NOT NULL,
    `create_time`   TIMESTAMP          DEFAULT CURRENT_TIMESTAMP
);