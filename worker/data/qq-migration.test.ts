import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SqliteD1Fixture } from "../test/sqlite-d1";
import { saveWorkspaceApplication, createSwap } from "./collaboration";
import { reviewApplication } from "./applications";
it("upgrades a populated database without losing account or participation data", async () => {
  const f = new SqliteD1Fixture({ throughMigration: "0019_activity_rule_acceptances.sql" });
  try {
    f.sqlite.exec(`UPDATE event_windows SET is_enabled=1;
      INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES('u1','One','one@example.com',1,'2026-01-01','2026-01-01'),('u2','Two','two@example.com',1,'2026-01-01','2026-01-01');
      INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES('credential-1','u1','credential','u1','old-hash','2026-01-01','2026-01-01');
      INSERT INTO session(id,token,userId,expiresAt,createdAt,updatedAt) VALUES('old-session','old-token','u1','2030-01-01','2026-01-01','2026-01-01');
      INSERT INTO activity_rule_acceptances VALUES('u1','rules-old','2026-01-01');
      INSERT INTO schedule_segments(id,schedule_version_id,code,name,status,sort_order,created_at,updated_at) VALUES('s1','schedule_default','A','First','open',1,'2026-01-01','2026-01-01'),('s2','schedule_default','B','Second','open',2,'2026-01-01','2026-01-01');`);
    for (const [userId,segmentId,email] of [["u1","s1","one@example.com"],["u2","s2","two@example.com"]]) {
      const a = await saveWorkspaceApplication(f.db,userId,email,{segmentId,profile:{creditName:"作者",bilibiliUid:"12345",contactEmail:email,primaryContactChannel:"QQ",primaryContactHandle:"123456789",isAnonymous:false},application:{contactEmail:email,interestFormat:"novel",introText:"创作意向"}});
      await reviewApplication(f.db,a.id,{status:"approved"},"admin");
    }
    const one = f.sqlite.prepare("SELECT id FROM participants WHERE user_id='u1'").get()!;
    await createSwap(f.db,String(one.id),"s2");
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
