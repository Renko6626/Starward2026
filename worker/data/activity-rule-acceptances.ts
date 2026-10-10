export async function saveActivityRuleAcceptance(db: D1Database, userId: string, version: string) {
  await db.prepare(
    "INSERT INTO activity_rule_acceptances(user_id, rules_version, accepted_at) VALUES (?, ?, ?)",
  ).bind(userId, version, new Date().toISOString()).run();
}
