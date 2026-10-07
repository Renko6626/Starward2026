import { afterEach, describe, expect, it } from "vitest";
import type { WorkspaceApplicationInput } from "../../src/shared/collaboration";
import { SqliteD1Fixture } from "../test/sqlite-d1";
import {
  CollaborationConflict,
  createSwap,
  getCollaboration,
  respondSwap,
  saveWorkspaceApplication,
  withdrawApplication,
} from "./collaboration";
import { reviewApplication } from "./applications";

const fixtures: SqliteD1Fixture[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.sqlite.close();
});
function fixture() {
  const f = new SqliteD1Fixture();
  fixtures.push(f);
  f.sqlite
    .exec(`UPDATE event_windows SET is_enabled=1 WHERE key IN ('application_open','segment_change_open');
    INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES ('u1','One','one@example.com',1,'2026-01-01','2026-01-01'),('u2','Two','two@example.com',1,'2026-01-01','2026-01-01'),('u3','Three','three@example.com',1,'2026-01-01','2026-01-01');
    INSERT INTO schedule_segments(id,schedule_version_id,code,name,status,sort_order,created_at,updated_at) VALUES ('s1','schedule_default','A','早场','open',1,'2026-01-01','2026-01-01'),('s2','schedule_default','B','晚场','open',2,'2026-01-01','2026-01-01'),('s3','schedule_default','C','加场','open',3,'2026-01-01','2026-01-01');`);
  return f;
}
const input = (
  segmentId: string,
  anonymous = false,
): WorkspaceApplicationInput => ({
  segmentId,
  profile: {
    creditName: "署名",
    contactEmail: "contact@example.com",
    primaryContactChannel: "email",
    primaryContactHandle: "contact@example.com",
    isAnonymous: anonymous,
  },
  application: {
    contactEmail: "contact@example.com",
    interestFormat: "novel",
    introText: "创作计划",
  },
});
async function approvedPair(f: SqliteD1Fixture) {
  const a = await saveWorkspaceApplication(
    f.db,
    "u1",
    "one@example.com",
    input("s1"),
  );
  const b = await saveWorkspaceApplication(
    f.db,
    "u2",
    "two@example.com",
    input("s2", true),
  );
  await reviewApplication(f.db, a.id, { status: "approved" }, "admin");
  await reviewApplication(f.db, b.id, { status: "approved" }, "admin");
  return {
    one: (await getCollaboration(f.db, "u1")).participantId,
    two: (await getCollaboration(f.db, "u2")).participantId,
  };
}

describe("workspace reservations", () => {
  it("saves profile, plan and pending reservation, confirms on approval and releases on rejection", async () => {
    const f = fixture();
    const a = await saveWorkspaceApplication(
      f.db,
      "u1",
      "one@example.com",
      input("s1", true),
    );
    expect((await getCollaboration(f.db, "u2")).segments[0]).toMatchObject({
      status: "reserved",
      publicName: "匿名创作者",
    });
    await saveWorkspaceApplication(
      f.db,
      "u1",
      "one@example.com",
      input("s2", true),
    );
    expect(
      (await getCollaboration(f.db, "u1")).segments.map((s) => s.status),
    ).toEqual(["available", "reserved", "available"]);
    await reviewApplication(f.db, a.id, { status: "approved" }, "admin");
    expect((await getCollaboration(f.db, "u1")).segments[1].status).toBe(
      "confirmed",
    );
    await expect(
      saveWorkspaceApplication(f.db, "u1", "one@example.com", input("s3")),
    ).rejects.toThrow(CollaborationConflict);
    await reviewApplication(f.db, a.id, { status: "rejected" }, "admin");
    expect((await getCollaboration(f.db, "u1")).segments[1].status).toBe(
      "available",
    );
  });
  it("rolls back every saved field when another claim wins just before batch", async () => {
    const f = fixture();
    await saveWorkspaceApplication(f.db, "u2", "two@example.com", input("s2"));
    const target = (await getCollaboration(f.db, "u2")).participantId;
    f.beforeBatch = () => {
      f.sqlite.exec(
        "UPDATE schedule_segments SET current_participant_id=NULL,status='released' WHERE id='s2'",
      );
      f.sqlite
        .prepare(
          "UPDATE schedule_segments SET current_participant_id=?,status='held' WHERE id='s1'",
        )
        .run(target);
    };
    await expect(
      saveWorkspaceApplication(f.db, "u1", "one@example.com", input("s1")),
    ).rejects.toThrow(CollaborationConflict);
    expect((await getCollaboration(f.db, "u2")).segments[0].participantId).toBe(
      target,
    );
    expect(
      f.sqlite
        .prepare("SELECT COUNT(*) AS n FROM portal_profiles WHERE user_id='u1'")
        .get(),
    ).toMatchObject({ n: 0 });
    expect(
      f.sqlite
        .prepare("SELECT COUNT(*) AS n FROM applications WHERE user_id='u1'")
        .get(),
    ).toMatchObject({ n: 0 });
    expect(
      f.sqlite
        .prepare("SELECT COUNT(*) AS n FROM participants WHERE user_id='u1'")
        .get(),
    ).toMatchObject({ n: 0 });
  });
  it("withdraws an approved owner, detaches draft and permits reapplication", async () => {
    const f = fixture();
    await approvedPair(f);
    await withdrawApplication(f.db, "u1");
    expect((await getCollaboration(f.db, "u1")).segments[0].status).toBe(
      "available",
    );
    expect(
      f.sqlite
        .prepare(
          "SELECT segment_id FROM project_drafts WHERE participant_id=(SELECT id FROM participants WHERE user_id='u1')",
        )
        .get(),
    ).toMatchObject({ segment_id: null });
    await saveWorkspaceApplication(f.db, "u1", "one@example.com", input("s3"));
    expect((await getCollaboration(f.db, "u1")).segments[2].status).toBe(
      "reserved",
    );
  });
});

describe("ownership and concurrent edits", () => {
  it("does not acquire an unowned legacy application from an unverified email match", async () => {
    const f = fixture();
    f.sqlite.exec(`UPDATE "user" SET emailVerified=0 WHERE id='u1';
      INSERT INTO applications(id,contact_email,interest_format,status,created_at,updated_at)
      VALUES('legacy','one@example.com','novel','approved','2026-01-01','2026-01-01');`);
    const saved = await saveWorkspaceApplication(
      f.db,
      "u1",
      "one@example.com",
      input("s1"),
    );
    expect(saved.id).not.toBe("legacy");
    expect(
      f.sqlite
        .prepare("SELECT user_id,status FROM applications WHERE id='legacy'")
        .get(),
    ).toMatchObject({ user_id: null, status: "approved" });
  });
  it("keeps the last review feedback and aborts a stale edit after withdrawal", async () => {
    const f = fixture();
    const a = await saveWorkspaceApplication(
      f.db,
      "u1",
      "one@example.com",
      input("s1"),
    );
    await reviewApplication(
      f.db,
      a.id,
      { status: "rejected", adminNote: "请补充计划" },
      "admin",
    );
    const updated = await saveWorkspaceApplication(
      f.db,
      "u1",
      "one@example.com",
      input("s1"),
    );
    expect(updated).toMatchObject({
      status: "pending",
      adminNote: "请补充计划",
      reviewedBy: null,
      reviewedAt: null,
    });
    f.beforeBatch = () =>
      f.sqlite.exec(
        "UPDATE applications SET status='withdrawn' WHERE user_id='u1'",
      );
    const changed = input("s2");
    changed.profile.creditName = "未保存署名";
    await expect(
      saveWorkspaceApplication(f.db, "u1", "one@example.com", changed),
    ).rejects.toThrow(CollaborationConflict);
    expect(
      f.sqlite
        .prepare("SELECT credit_name FROM portal_profiles WHERE user_id='u1'")
        .get(),
    ).toMatchObject({ credit_name: "署名" });
    expect((await getCollaboration(f.db, "u1")).segments[0].status).toBe(
      "reserved",
    );
  });
});

describe("bilateral swaps", () => {
  it("exchanges owners and drafts atomically under the one-holder index and records both events", async () => {
    const f = fixture(),
      { one, two } = await approvedPair(f);
    const request = await createSwap(f.db, one, "s2", "请交换");
    expect((await getCollaboration(f.db, "u3")).requests).toEqual([]);
    await respondSwap(f.db, two, request.id, "accept");
    expect(
      (await getCollaboration(f.db, "u1")).segments.map((s) => s.participantId),
    ).toEqual([two, one, null]);
    expect(
      f.sqlite
        .prepare(
          "SELECT participant_id,segment_id FROM project_drafts ORDER BY segment_id",
        )
        .all(),
    ).toEqual([
      { participant_id: two, segment_id: "s1" },
      { participant_id: one, segment_id: "s2" },
    ]);
    expect(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM participant_events WHERE event_type='segment_swapped'",
        )
        .get(),
    ).toMatchObject({ n: 2 });
    expect((await getCollaboration(f.db, "u1")).requests[0].status).toBe(
      "accepted",
    );
  });
  it("enforces recipient ownership and the live cutoff and leaves both slots untouched", async () => {
    const f = fixture(),
      { one, two } = await approvedPair(f),
      request = await createSwap(f.db, one, "s2");
    await expect(respondSwap(f.db, one, request.id, "accept")).rejects.toThrow(
      CollaborationConflict,
    );
    f.beforeBatch = () =>
      f.sqlite.exec(
        "UPDATE event_windows SET closes_at='2026-01-01' WHERE key='segment_change_open'",
      );
    await expect(respondSwap(f.db, two, request.id, "accept")).rejects.toThrow(
      CollaborationConflict,
    );
    expect(
      (await getCollaboration(f.db, "u1")).segments.map((s) => s.participantId),
    ).toEqual([one, two, null]);
    expect((await getCollaboration(f.db, "u1")).requests[0].status).toBe(
      "expired",
    );
  });
  it("never resurrects a request after a slot changes away and back, including during an acceptance race", async () => {
    const f = fixture(),
      { one, two } = await approvedPair(f),
      request = await createSwap(f.db, one, "s2");
    f.beforeBatch = () =>
      f.sqlite.exec(
        `UPDATE schedule_segments SET current_participant_id=NULL,status='released' WHERE id='s1'; UPDATE schedule_segments SET current_participant_id='${one}',status='held' WHERE id='s1';`,
      );
    await expect(respondSwap(f.db, two, request.id, "accept")).rejects.toThrow(
      CollaborationConflict,
    );
    expect((await getCollaboration(f.db, "u1")).requests[0].status).toBe(
      "expired",
    );
  });
  it("retains slots on rejection and cancellation, and expires requests on withdrawal", async () => {
    const f = fixture(),
      { one, two } = await approvedPair(f);
    const rejected = await createSwap(f.db, one, "s2");
    await respondSwap(f.db, two, rejected.id, "reject");
    const cancelled = await createSwap(f.db, one, "s2");
    await respondSwap(f.db, one, cancelled.id, "cancel");
    const pending = await createSwap(f.db, one, "s2");
    await withdrawApplication(f.db, "u2");
    expect(
      (await getCollaboration(f.db, "u1")).requests.find(
        (r) => r.id === pending.id,
      )?.status,
    ).toBe("expired");
    expect((await getCollaboration(f.db, "u1")).segments[0].participantId).toBe(
      one,
    );
  });
});

describe("swap eligibility and replay", () => {
  it("disallows pending creators and prevents acceptance replay while invalidating other requests", async () => {
    const f = fixture();
    const a = await saveWorkspaceApplication(
      f.db,
      "u1",
      "one@example.com",
      input("s1"),
    );
    const b = await saveWorkspaceApplication(
      f.db,
      "u2",
      "two@example.com",
      input("s2"),
    );
    const one = (await getCollaboration(f.db, "u1")).participantId;
    const two = (await getCollaboration(f.db, "u2")).participantId;
    await expect(createSwap(f.db, one, "s2")).rejects.toThrow(
      CollaborationConflict,
    );
    await reviewApplication(f.db, a.id, { status: "approved" }, "admin");
    await expect(createSwap(f.db, one, "s2")).rejects.toThrow(
      CollaborationConflict,
    );
    await reviewApplication(f.db, b.id, { status: "approved" }, "admin");
    const primary = await createSwap(f.db, one, "s2");
    const reverse = await createSwap(f.db, two, "s1");
    await respondSwap(f.db, two, primary.id, "accept");
    await expect(respondSwap(f.db, two, primary.id, "accept")).rejects.toThrow(
      CollaborationConflict,
    );
    expect(
      (await getCollaboration(f.db, "u1")).requests.find(
        (r) => r.id === reverse.id,
      )?.status,
    ).toBe("expired");
    await withdrawApplication(f.db, "u1");
    await expect(createSwap(f.db, one, "s1")).rejects.toThrow(
      CollaborationConflict,
    );
  });
  it("retains a reservation and invalidates swaps when admin returns an approved application to pending", async () => {
    const f = fixture(),
      { one } = await approvedPair(f),
      request = await createSwap(f.db, one, "s2");
    const app = f.sqlite
      .prepare("SELECT id FROM applications WHERE user_id='u1'")
      .get() as { id: string };
    await reviewApplication(
      f.db,
      app.id,
      { status: "pending", adminNote: "请补充计划" },
      "admin",
    );
    const state = await getCollaboration(f.db, "u1");
    expect(state.segments[0]).toMatchObject({
      participantId: one,
      status: "reserved",
    });
    expect(state.canSwap).toBe(false);
    expect(state.requests.find((r) => r.id === request.id)?.status).toBe(
      "expired",
    );
  });
  it("keeps expired requests expired when the window reopens", async () => {
    const f = fixture(),
      { one, two } = await approvedPair(f),
      r = await createSwap(f.db, one, "s2");
    f.sqlite.exec(
      "UPDATE event_windows SET closes_at='2026-01-01' WHERE key='segment_change_open'; UPDATE event_windows SET closes_at=NULL WHERE key='segment_change_open'",
    );
    await expect(respondSwap(f.db, two, r.id, "accept")).rejects.toThrow(
      CollaborationConflict,
    );
    expect((await getCollaboration(f.db, "u1")).requests[0].status).toBe(
      "expired",
    );
  });
});
