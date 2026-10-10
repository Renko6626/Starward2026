CREATE TABLE activity_rule_acceptances (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  rules_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, rules_version)
);
