import { afterEach, describe, expect, it } from "vitest";
import { SqliteD1Fixture } from "../test/sqlite-d1";
import { getParticipationStatistics } from "./participation";

const fixtures: SqliteD1Fixture[] = [];
afterEach(() => { for (const fixture of fixtures.splice(0)) fixture.sqlite.close(); });
function fixture() {
  const f = new SqliteD1Fixture();
  fixtures.push(f);
  return f;
}

describe("public participation statistics", () => {
  it("counts registered creators and active, usable slots, including pending reservations", async () => {
    const f = fixture();
    f.sqlite.exec(`
      INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES
        ('u1', 'One', 'one@example.com', 1, '2026-01-01', '2026-01-01'),
        ('u2', 'Two', 'two@example.com', 1, '2026-01-01', '2026-01-01'),
        ('u3', 'Three', 'three@example.com', 1, '2026-01-01', '2026-01-01');
      INSERT INTO participants (id, user_id, invite_email, status, created_at, updated_at) VALUES
        ('p1', 'u1', 'one@example.com', 'pending', '2026-01-01', '2026-01-01'),
        ('p2', 'u2', 'two@example.com', 'approved', '2026-01-01', '2026-01-01'),
        ('p3', 'u3', 'three@example.com', 'withdrawn', '2026-01-01', '2026-01-01'),
        ('invite', NULL, 'invite@example.com', 'pending', '2026-01-01', '2026-01-01'),
        ('orphan', 'deleted-user', 'old@example.com', 'pending', '2026-01-01', '2026-01-01');
      INSERT INTO schedule_versions (id, title, status, created_at, updated_at)
        VALUES ('old', 'Archived', 'archived', '2026-01-01', '2026-01-01');
      INSERT INTO schedule_segments (id, schedule_version_id, code, name, status, current_participant_id, sort_order, created_at, updated_at) VALUES
        ('s1', 'schedule_default', '01', 'Reserved', 'held', 'p1', 1, '2026-01-01', '2026-01-01'),
        ('s2', 'schedule_default', '02', 'Confirmed', 'held', 'p2', 2, '2026-01-01', '2026-01-01'),
        ('s3', 'schedule_default', '03', 'Open', 'open', NULL, 3, '2026-01-01', '2026-01-01'),
        ('s4', 'schedule_default', '04', 'Released', 'released', NULL, 4, '2026-01-01', '2026-01-01'),
        ('s5', 'schedule_default', '05', 'Disabled', 'locked', NULL, 5, '2026-01-01', '2026-01-01'),
        ('s6', 'schedule_default', '06', 'Finished', 'completed', NULL, 6, '2026-01-01', '2026-01-01'),
        ('old-slot', 'old', '01', 'Old', 'held', 'p2', 1, '2026-01-01', '2026-01-01');
    `);
    expect(await getParticipationStatistics(f.db)).toEqual({
      registeredCreators: 3, schedule: { occupied: 3, total: 5 },
    });
    f.sqlite.exec("UPDATE schedule_segments SET status='released', current_participant_id=NULL WHERE id='s1'");
    expect((await getParticipationStatistics(f.db)).schedule).toEqual({ occupied: 2, total: 5 });
  });

  it("distinguishes an empty active schedule from an unpublished schedule", async () => {
    const f = fixture();
    expect(await getParticipationStatistics(f.db)).toEqual({
      registeredCreators: 0, schedule: { occupied: 0, total: 0 },
    });
    f.sqlite.exec("UPDATE schedule_versions SET status='archived'");
    expect(await getParticipationStatistics(f.db)).toEqual({ registeredCreators: 0, schedule: null });
  });
});
