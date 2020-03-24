CREATE TEMPORARY TABLE t1_backup(
    id            INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL ,
    target_id     TEXT                NOT NULL,
    unban_at      TIMESTAMP           DEFAULT NULL,
    create_time   TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    moderator_action_id INTEGER       DEFAULT NULL
);
ALTER TABLE bans ADD COLUMN moderator_action_id INTEGER DEFAULT NULL;
INSERT INTO t1_backup SELECT id, target_id, unban_at, create_time, moderator_action_id FROM bans;
DROP TABLE bans;
CREATE TABLE bans(
    id            INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL ,
    target_id     TEXT                NOT NULL,
    unban_at      TIMESTAMP           DEFAULT NULL,
    create_time   TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    moderator_action_id INTEGER       DEFAULT NULL
);
INSERT INTO bans SELECT id, target_id, unban_at, create_time, moderator_action_id FROM t1_backup;
DROP TABLE t1_backup;
