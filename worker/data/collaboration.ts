import type {
  CollaborationResponse,
  PortalNeighbor,
  PortalNeighborsResponse,
  SwapRequest,
  WorkspaceApplicationInput,
} from "../../src/shared/collaboration";
import { createPrefixedId } from "../lib/ids";
import { nowIso } from "../lib/time";
import { normalizeOptionalText } from "../lib/strings";
import { getPortalApplicationByUserId } from "./applications";

export class CollaborationConflict extends Error {}
const windowOpen = (key: string) =>
  `EXISTS (SELECT 1
        FROM event_windows
        WHERE key = '${key}' AND is_enabled = 1 AND (opens_at IS NULL OR julianday(opens_at) <= julianday(?)) AND (closes_at IS NULL OR julianday(closes_at) > julianday(?)))`;

function guard(
  db: D1Database,
  id: string,
  condition: string,
  values: unknown[],
) {
  return db
    .prepare(
      `INSERT INTO collaboration_guards(id, valid) SELECT ?, CASE WHEN ${condition} THEN 1 ELSE 0 END`,
    )
    .bind(id, ...values);
}
async function atomic(
  db: D1Database,
  id: string,
  statements: D1PreparedStatement[],
) {
  try {
    await db.batch([
      ...statements,
      db.prepare("DELETE FROM collaboration_guards WHERE id = ?").bind(id),
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      /CHECK constraint|UNIQUE constraint/i.test(error.message)
    ) {
      throw new CollaborationConflict("资料或时段状态已变化，请刷新后重试。");
    }
    throw error;
  }
}

export async function saveWorkspaceApplication(
  db: D1Database,
  userId: string,
  authEmail: string,
  input: WorkspaceApplicationInput,
) {
  const application = await db
    .prepare(
      "SELECT id, status, updated_at FROM applications WHERE user_id = ? LIMIT 1",
    )
    .bind(userId)
    .first<{ id: string; status: string; updated_at: string }>();
  if (application?.status === "approved")
    throw new CollaborationConflict("该报名已审核通过，不能修改报名计划。");
  const participant = await db
    .prepare(
      "SELECT id, status, updated_at FROM participants WHERE user_id = ?",
    )
    .bind(userId)
    .first<{ id: string; status: string; updated_at: string }>();
  // Advance the version even when two updates fall in the same millisecond.
  const now = new Date(
    Math.max(
      Date.now(),
      Date.parse(application?.updated_at ?? "") + 1 || 0,
      Date.parse(participant?.updated_at ?? "") + 1 || 0,
    ),
  ).toISOString();
  const participantId = participant?.id ?? createPrefixedId("part");
  const applicationId = application?.id ?? createPrefixedId("app");
  const operationId = createPrefixedId("op");
  const p = input.profile;
  const a = input.application;
  const statements = [
    guard(
      db,
      operationId,
      `${windowOpen("application_open")}
        AND NOT EXISTS (SELECT 1
        FROM applications
        WHERE (user_id = ? OR id = ?) AND status = 'approved')
        AND NOT EXISTS (SELECT 1
        FROM participants
        WHERE user_id = ? AND status IN ('approved','completed'))
        AND (? IS NULL OR EXISTS (SELECT 1
        FROM applications
        WHERE id=? AND user_id=? AND updated_at=? AND status=?))
        AND (? IS NULL OR EXISTS (SELECT 1
        FROM participants
        WHERE id=? AND user_id=? AND updated_at=? AND status=?))
        AND EXISTS (SELECT 1
        FROM schedule_segments s
        JOIN schedule_versions v ON v.id = s.schedule_version_id AND v.status = 'active'
        WHERE s.id = ? AND ((s.current_participant_id IS NULL AND s.status IN ('open','released')) OR (s.current_participant_id = ? AND s.status = 'held')))`,
      [
        now,
        now,
        userId,
        applicationId,
        userId,
        application?.id ?? null,
        applicationId,
        userId,
        application?.updated_at ?? null,
        application?.status ?? null,
        participant?.id ?? null,
        participantId,
        userId,
        participant?.updated_at ?? null,
        participant?.status ?? null,
        input.segmentId,
        participantId,
      ],
    ),
    db
      .prepare(
        `INSERT INTO portal_profiles(user_id,credit_name,bilibili_uid,contact_email,primary_contact_channel,primary_contact_handle,backup_contact,is_anonymous,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(user_id)
        DO UPDATE SET credit_name=excluded.credit_name,
        bilibili_uid=excluded.bilibili_uid,
        contact_email=excluded.contact_email,
        primary_contact_channel=excluded.primary_contact_channel,
        primary_contact_handle=excluded.primary_contact_handle,
        backup_contact=excluded.backup_contact,
        is_anonymous=excluded.is_anonymous,
        updated_at=excluded.updated_at`,
      )
      .bind(
        userId,
        p.creditName,
        p.bilibiliUid,
        authEmail.trim().toLowerCase(),
        p.primaryContactChannel,
        p.primaryContactHandle,
        normalizeOptionalText(p.backupContact),
        Number(p.isAnonymous),
        now,
        now,
      ),
    db
      .prepare(
        `INSERT INTO applications(id,user_id,contact_email,contact_handle,interest_format,intro_text,portfolio_url,message_to_hosts,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,'pending',?,?)
        ON CONFLICT(id)
        DO UPDATE SET user_id=excluded.user_id,
        contact_email=excluded.contact_email,
        contact_handle=excluded.contact_handle,
        interest_format=excluded.interest_format,
        intro_text=excluded.intro_text,
        portfolio_url=excluded.portfolio_url,
        message_to_hosts=excluded.message_to_hosts,
        status='pending',
        reviewed_by=NULL,
        reviewed_at=NULL,
        updated_at=excluded.updated_at`,
      )
      .bind(
        applicationId,
        userId,
        authEmail.trim().toLowerCase(),
        normalizeOptionalText(a.contactHandle),
        a.interestFormat,
        normalizeOptionalText(a.introText),
        normalizeOptionalText(a.portfolioUrl),
        normalizeOptionalText(a.messageToHosts),
        now,
        now,
      ),
    db
      .prepare(
        `INSERT INTO participants(id,user_id,application_id,invite_email,contact_handle,status,created_at,updated_at)
        VALUES(?,?,?,?,?,'pending',?,?)
        ON CONFLICT(id)
        DO UPDATE SET application_id=excluded.application_id,
        contact_handle=excluded.contact_handle,
        status='pending',
        updated_at=excluded.updated_at`,
      )
      .bind(
        participantId,
        userId,
        applicationId,
        authEmail.toLowerCase(),
        normalizeOptionalText(a.contactHandle),
        now,
        now,
      ),
    db
      .prepare(
        `UPDATE schedule_segments SET current_participant_id=NULL,
        status='released',
        released_at=?,
        updated_at=?
        WHERE current_participant_id=? AND id<>? AND status='held'`,
      )
      .bind(now, now, participantId, input.segmentId),
    db
      .prepare(
        `UPDATE schedule_segments SET current_participant_id=?,
        status='held',
        claimed_at=CASE WHEN current_participant_id=? THEN claimed_at ELSE ? END,
        released_at=NULL,
        updated_at=?
        WHERE id=?`,
      )
      .bind(participantId, participantId, now, now, input.segmentId),
    db
      .prepare(
        `UPDATE project_drafts SET segment_id=?,updated_at=? WHERE participant_id=?`,
      )
      .bind(input.segmentId, now, participantId),
    event(
      db,
      participantId,
      "application_segment_reserved",
      input.segmentId,
      now,
    ),
  ];
  await atomic(db, operationId, statements);
  const saved = await getPortalApplicationByUserId(db, userId);
  if (!saved) throw new Error("Saved application missing");
  return saved;
}

const publicName = `CASE WHEN pp.is_anonymous = 1 THEN '匿名创作者' ELSE COALESCE(pp.credit_name, '未填写署名') END`;

/** Read eligibility and adjacency in one snapshot; contact fields never enter this response. */
export async function getPortalNeighbors(
  db: D1Database,
  userId: string,
): Promise<PortalNeighborsResponse> {
  const rows = await db
    .prepare(
      `SELECT s.id AS segmentId, s.code AS segmentCode, s.name AS segmentName,
        CASE
          WHEN s.status IN ('held','completed') AND
            (p.status='approved' OR (p.status='completed' AND a.status='approved')) THEN 'confirmed'
          WHEN s.status='held' THEN 'reserved'
          WHEN s.current_participant_id IS NULL AND s.status IN ('open','released') THEN 'available'
          ELSE 'unavailable'
        END AS status,
        CASE WHEN p.id IS NULL THEN NULL ELSE ${publicName} END AS publicName,
        CASE WHEN s.status IN ('held','completed') AND
          (p.status='approved' OR (p.status='completed' AND a.status='approved'))
          THEN pp.bilibili_uid ELSE NULL END AS bilibiliUid,
        CASE WHEN p.user_id=? AND p.status='approved' AND s.status='held' THEN 1 ELSE 0 END AS isCurrent
      FROM schedule_segments s
      JOIN schedule_versions v ON v.id=s.schedule_version_id AND v.status='active'
      LEFT JOIN participants p ON p.id=s.current_participant_id
      LEFT JOIN applications a ON a.id=p.application_id
      LEFT JOIN portal_profiles pp ON pp.user_id=p.user_id
      WHERE EXISTS (
        SELECT 1 FROM schedule_segments own
        JOIN participants owner ON owner.id=own.current_participant_id
        WHERE own.schedule_version_id=v.id AND own.status='held'
          AND owner.user_id=? AND owner.status='approved'
      )
      ORDER BY s.sort_order, s.id`,
    )
    .bind(userId, userId)
    .all<PortalNeighbor & { isCurrent: number }>();
  const index = rows.results.findIndex((row) => row.isCurrent === 1);
  if (index < 0) return { currentSegmentId: null, previous: null, next: null };
  const neighbor = (row: (typeof rows.results)[number] | undefined): PortalNeighbor | null =>
    row
      ? {
          segmentId: row.segmentId,
          segmentCode: row.segmentCode,
          segmentName: row.segmentName,
          status: row.status,
          publicName: row.publicName,
          bilibiliUid: row.bilibiliUid,
        }
      : null;
  return {
    currentSegmentId: rows.results[index].segmentId,
    previous: neighbor(rows.results[index - 1]),
    next: neighbor(rows.results[index + 1]),
  };
}

type SegmentRow = {
  scheduledAt: string | null;
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  participantId: string | null;
  participantStatus: string | null;
  publicName: string | null;
};
export async function getCollaboration(
  db: D1Database,
  userId: string,
): Promise<CollaborationResponse> {
  await expirePastCutoffRequests(db);
  const participant = await db
    .prepare("SELECT id,status FROM participants WHERE user_id=?")
    .bind(userId)
    .first<{ id: string; status: string }>();
  const segments = await db
    .prepare(
      `SELECT s.id,s.code,s.name,s.description,s.status,s.scheduled_at AS scheduledAt,
        s.current_participant_id AS participantId,
        p.status AS participantStatus,CASE WHEN p.id IS NULL THEN NULL ELSE ${publicName} END AS publicName
        FROM schedule_segments s
        JOIN schedule_versions v ON v.id=s.schedule_version_id AND v.status='active'
        LEFT
        JOIN participants p ON p.id=s.current_participant_id
        LEFT
        JOIN portal_profiles pp ON pp.user_id=p.user_id
        ORDER BY s.sort_order`,
    )
    .all<SegmentRow>();
  const requests = participant
    ? await db
        .prepare(
          `SELECT r.id,
        r.requester_id AS requesterId,
        r.recipient_id AS recipientId,CASE WHEN rp.is_anonymous=1 THEN '匿名创作者' ELSE COALESCE(rp.credit_name,'未填写署名') END AS requesterName,CASE WHEN tp.is_anonymous=1 THEN '匿名创作者' ELSE COALESCE(tp.credit_name,'未填写署名') END AS recipientName,
        r.requester_segment_id AS requesterSegmentId,
        r.recipient_segment_id AS recipientSegmentId,
        rs.name AS requesterSegmentName,
        ts.name AS recipientSegmentName,r.message,r.status,
        r.created_at AS createdAt
        FROM segment_swap_requests r
        JOIN participants pr ON pr.id=r.requester_id
        JOIN participants pt ON pt.id=r.recipient_id
        LEFT
        JOIN portal_profiles rp ON rp.user_id=pr.user_id
        LEFT
        JOIN portal_profiles tp ON tp.user_id=pt.user_id
        JOIN schedule_segments rs ON rs.id=r.requester_segment_id
        JOIN schedule_segments ts ON ts.id=r.recipient_segment_id
        WHERE r.requester_id=? OR r.recipient_id=?
        ORDER BY r.created_at DESC`,
        )
        .bind(participant.id, participant.id)
        .all<SwapRequest>()
    : { results: [] };
  const now = nowIso();
  const open = await db
    .prepare(`SELECT ${windowOpen("segment_change_open")} AS isOpen`)
    .bind(now, now)
    .first<{ isOpen: number }>();
  return {
    participantId: participant?.id ?? "",
    segments: segments.results.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      scheduledAt: s.scheduledAt,
      participantId: s.participantId,
      publicName: s.publicName,
      status:
        s.status === "held"
          ? s.participantStatus === "approved" ||
            s.participantStatus === "completed"
            ? "confirmed"
            : "reserved"
          : s.participantId === null && ["open", "released"].includes(s.status)
            ? "available"
            : "unavailable",
    })),
    requests: requests.results,
    canSwap:
      participant?.status === "approved" &&
      !!open?.isOpen &&
      segments.results.some(
        (s) => s.participantId === participant.id && s.status === "held",
      ),
  };
}

export async function createSwap(
  db: D1Database,
  participantId: string,
  segmentId: string,
  message?: string,
) {
  await expirePastCutoffRequests(db);
  const pair = await db
    .prepare(
      `SELECT own.id AS ownId,
        target.current_participant_id AS recipientId
        FROM schedule_segments own
        JOIN schedule_versions v ON v.id=own.schedule_version_id AND v.status='active'
        JOIN schedule_segments target ON target.schedule_version_id=v.id
        WHERE own.current_participant_id=? AND own.status='held' AND target.id=? AND target.status='held' AND target.current_participant_id<>?`,
    )
    .bind(participantId, segmentId, participantId)
    .first<{ ownId: string; recipientId: string }>();
  if (!pair)
    throw new CollaborationConflict("只能向持有时段的其他创作者发起交换。");
  const id = createPrefixedId("swap"),
    now = nowIso(),
    operationId = createPrefixedId("op");
  await atomic(db, operationId, [
    guard(
      db,
      operationId,
      `${windowOpen("segment_change_open")} AND ${pairValid}`,
      [
        now,
        now,
        participantId,
        pair.recipientId,
        pair.ownId,
        participantId,
        segmentId,
        pair.recipientId,
      ],
    ),
    db
      .prepare(
        `INSERT INTO segment_swap_requests(id,requester_id,recipient_id,requester_segment_id,recipient_segment_id,message,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,'pending',?,?)`,
      )
      .bind(
        id,
        participantId,
        pair.recipientId,
        pair.ownId,
        segmentId,
        normalizeOptionalText(message),
        now,
        now,
      ),
  ]);
  const recipient = await db
    .prepare(
      `SELECT COALESCE(pp.contact_email, p.invite_email) AS email
        FROM participants p
        LEFT JOIN portal_profiles pp ON pp.user_id = p.user_id
        WHERE p.id = ?`,
    )
    .bind(pair.recipientId)
    .first<{ email: string }>();
  return { id, email: recipient?.email };
}
const pairValid = `EXISTS (SELECT 1
        FROM participants
        WHERE id=? AND status='approved')
        AND EXISTS (SELECT 1
        FROM participants
        WHERE id=? AND status='approved')
        AND EXISTS (SELECT 1
        FROM schedule_segments s
        JOIN schedule_versions v ON v.id=s.schedule_version_id AND v.status='active'
        WHERE s.id=? AND s.current_participant_id=? AND s.status='held')
        AND EXISTS (SELECT 1
        FROM schedule_segments s
        JOIN schedule_versions v ON v.id=s.schedule_version_id AND v.status='active'
        WHERE s.id=? AND s.current_participant_id=? AND s.status='held')`;

export async function respondSwap(
  db: D1Database,
  participantId: string,
  requestId: string,
  action: "accept" | "reject" | "cancel",
) {
  await expirePastCutoffRequests(db);
  const r = await db
    .prepare("SELECT * FROM segment_swap_requests WHERE id=?")
    .bind(requestId)
    .first<{
      requester_id: string;
      recipient_id: string;
      requester_segment_id: string;
      recipient_segment_id: string;
      status: string;
    }>();
  if (
    !r ||
    (action === "cancel" ? r.requester_id : r.recipient_id) !== participantId
  )
    throw new CollaborationConflict("你没有权限处理这个交换请求。");
  const now = nowIso(),
    op = createPrefixedId("op");
  const pendingCondition =
    "EXISTS (SELECT 1 FROM segment_swap_requests WHERE id=? AND status='pending')";
  const condition =
    action === "accept"
      ? `${windowOpen("segment_change_open")} AND ${pendingCondition} AND ${pairValid}`
      : pendingCondition;
  const values =
    action === "accept"
      ? [
          now,
          now,
          requestId,
          r.requester_id,
          r.recipient_id,
          r.requester_segment_id,
          r.requester_id,
          r.recipient_segment_id,
          r.recipient_id,
        ]
      : [requestId];
  const statements = [
    guard(db, op, condition, values),
    db
      .prepare(
        "UPDATE segment_swap_requests SET status=?,updated_at=? WHERE id=?",
      )
      .bind(
        action === "accept"
          ? "accepted"
          : action === "cancel"
            ? "cancelled"
            : "rejected",
        now,
        requestId,
      ),
  ];
  if (action === "accept") {
    statements.push(
      db
        .prepare(
          "UPDATE schedule_segments SET current_participant_id=NULL,updated_at=? WHERE id IN (?,?)",
        )
        .bind(now, r.requester_segment_id, r.recipient_segment_id),
      db
        .prepare(
          "UPDATE schedule_segments SET current_participant_id=CASE id WHEN ? THEN ? ELSE ? END,claimed_at=?,updated_at=? WHERE id IN (?,?)",
        )
        .bind(
          r.requester_segment_id,
          r.recipient_id,
          r.requester_id,
          now,
          now,
          r.requester_segment_id,
          r.recipient_segment_id,
        ),
      db
        .prepare(
          "UPDATE project_drafts SET segment_id=CASE participant_id WHEN ? THEN ? ELSE ? END,updated_at=? WHERE participant_id IN (?,?)",
        )
        .bind(
          r.requester_id,
          r.recipient_segment_id,
          r.requester_segment_id,
          now,
          r.requester_id,
          r.recipient_id,
        ),
      event(
        db,
        r.requester_id,
        "segment_swapped",
        r.recipient_segment_id,
        now,
        participantId,
      ),
      event(
        db,
        r.recipient_id,
        "segment_swapped",
        r.requester_segment_id,
        now,
        participantId,
      ),
    );
  }
  await atomic(db, op, statements);
}
function event(
  db: D1Database,
  participantId: string,
  eventType: string,
  segmentId: string,
  now: string,
  actorId = participantId,
) {
  return db
    .prepare(
      `INSERT INTO participant_events(id,participant_id,actor_type,actor_id,event_type,target_type,target_id,payload_json,created_at)
        VALUES(?,?,'participant',?,?,'schedule_segment',?,?,?)`,
    )
    .bind(
      createPrefixedId("pevt"),
      participantId,
      actorId,
      eventType,
      segmentId,
      JSON.stringify({ segmentId }),
      now,
    );
}

export async function withdrawApplication(db: D1Database, userId: string) {
  const now = nowIso();
  const op = createPrefixedId("op");
  // Resolve every related row inside the batch, so a participant initialized
  // concurrently cannot leave a newly reserved slot behind after withdrawal.
  await atomic(db, op, [
    guard(
      db,
      op,
      "EXISTS (SELECT 1 FROM applications WHERE user_id=? AND status<>'withdrawn')",
      [userId],
    ),
    db
      .prepare(
        `UPDATE applications
      SET status='withdrawn', updated_at=?
      WHERE user_id=?`,
      )
      .bind(now, userId),
    db
      .prepare(
        `UPDATE participants
      SET status='withdrawn', updated_at=?
      WHERE user_id=?`,
      )
      .bind(now, userId),
    db
      .prepare(
        `UPDATE schedule_segments
      SET current_participant_id=NULL, status='released', released_at=?, updated_at=?
      WHERE current_participant_id IN (SELECT id FROM participants WHERE user_id=?)
        AND status='held'`,
      )
      .bind(now, now, userId),
    db
      .prepare(
        `UPDATE project_drafts
      SET segment_id=NULL, updated_at=?
      WHERE participant_id IN (SELECT id FROM participants WHERE user_id=?)`,
      )
      .bind(now, userId),
    db
      .prepare(
        `INSERT INTO participant_events (
      id, participant_id, actor_type, actor_id, event_type, target_type, target_id, payload_json, created_at
    ) SELECT ?, id, 'participant', id, 'application_withdrawn', 'application', application_id, '{}', ?
      FROM participants WHERE user_id=?`,
      )
      .bind(createPrefixedId("pevt"), now, userId),
  ]);
}

async function expirePastCutoffRequests(db: D1Database) {
  const now = nowIso();
  await db
    .prepare(
      `UPDATE segment_swap_requests
    SET status = 'expired', updated_at = ?
    WHERE status = 'pending' AND EXISTS (
      SELECT 1 FROM event_windows
      WHERE key = 'segment_change_open' AND (
        is_enabled = 0 OR
        (closes_at IS NOT NULL AND julianday(closes_at) <= julianday(?))
      )
    )`,
    )
    .bind(now, now)
    .run();
}
