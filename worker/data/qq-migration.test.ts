import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SqliteD1Fixture } from "../test/sqlite-d1";
it("upgrades a populated database without losing account or participation data", async () => {
  const f = new SqliteD1Fixture({ throughMigration: "0019_activity_rule_acceptances.sql" });
  try {
    f.sqlite.exec(`UPDATE event_windows SET is_enabled=1;
      INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES('u1','One','one@example.com',1,'2026-01-01','2026-01-01'),('u2','Two','two@example.com',1,'2026-01-01','2026-01-01');
      INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES('credential-1','u1','credential','u1','old-hash','2026-01-01','2026-01-01');
      INSERT INTO session(id,token,userId,expiresAt,createdAt,updatedAt) VALUES('old-session','old-token','u1','2030-01-01','2026-01-01','2026-01-01');
      INSERT INTO activity_rule_acceptances VALUES('u1','rules-old','2026-01-01');
      INSERT INTO schedule_segments(id,schedule_version_id,code,name,status,sort_order,created_at,updated_at) VALUES('s1','schedule_default','A','First','open',1,'2026-01-01','2026-01-01'),('s2','schedule_default','B','Second','open',2,'2026-01-01','2026-01-01');`);
    // Build historical rows directly; current application code requires newer columns.
    for (const [userId, segmentId, email] of [["u1", "s1", "one@example.com"], ["u2", "s2", "two@example.com"]]) {
      f.sqlite.prepare("INSERT INTO portal_profiles(user_id,credit_name,bilibili_uid,contact_email,primary_contact_channel,primary_contact_handle,is_anonymous,created_at,updated_at) VALUES(?,'作者','12345',?,'QQ','123456789',0,'2026-01-01','2026-01-01')").run(userId, email);
      f.sqlite.prepare("INSERT INTO applications(id,user_id,contact_email,interest_format,intro_text,status,created_at,updated_at) VALUES(?,?,?,'novel','创作意向','approved','2026-01-01','2026-01-01')").run(`app_${userId}`, userId, email);
      f.sqlite.prepare("INSERT INTO participants(id,user_id,application_id,invite_email,status,created_at,updated_at) VALUES(?,?,?,?,'approved','2026-01-01','2026-01-01')").run(`part_${userId}`, userId, `app_${userId}`, email);
      f.sqlite.prepare("UPDATE schedule_segments SET current_participant_id=?,status='held' WHERE id=?").run(`part_${userId}`, segmentId);
      f.sqlite.prepare("INSERT INTO project_drafts(id,participant_id,segment_id,preview_status,review_status,created_at,updated_at) VALUES(?,?,?,'draft','not_started','2026-01-01','2026-01-01')").run(`draft_${userId}`, `part_${userId}`, segmentId);
      f.sqlite.prepare("INSERT INTO participant_events(id,participant_id,actor_type,event_type,target_type,target_id,created_at) VALUES(?,?,'admin','application_approved','application',?,'2026-01-01')").run(`event_${userId}`, `part_${userId}`, `app_${userId}`);
    }
    f.sqlite.exec("INSERT INTO segment_swap_requests(id,requester_id,recipient_id,requester_segment_id,recipient_segment_id,status,created_at,updated_at) VALUES('swap_old','part_u1','part_u2','s1','s2','pending','2026-01-01','2026-01-01')");
    const tables = ["user","account","session","activity_rule_acceptances","portal_profiles","applications","participants","participant_events","project_drafts","segment_swap_requests","schedule_segments"];
    const rows = (table: string) => f.sqlite.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all();
    const before = Object.fromEntries(tables.map(t=>[t,rows(t)]));
    const sql=readFileSync("migrations/0020_qq_optional_contact_email.sql","utf8");
    f.sqlite.exec(`BEGIN; ${sql} COMMIT;`);
    for (const t of tables) expect(rows(t),t).toEqual(before[t]);
    expect(f.sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    f.sqlite.exec("UPDATE schedule_segments SET current_participant_id=NULL,status='released' WHERE id='s1'");
    expect(f.sqlite.prepare("SELECT status FROM segment_swap_requests").get()).toMatchObject({status:"expired"});
    f.sqlite.exec("UPDATE portal_profiles SET contact_email=NULL; UPDATE applications SET contact_email=NULL; UPDATE participants SET invite_email=NULL");
    expect(f.sqlite.prepare("SELECT count(*) AS n FROM participants WHERE invite_email IS NULL").get()).toMatchObject({n:2});
  } finally { f.sqlite.close(); }
});
