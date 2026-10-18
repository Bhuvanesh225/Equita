/**
 * Recording what happened.
 *
 * Three things happen whenever something changes: a row is written to `activity`
 * so the project has a memory, notifications are created for the people who
 * should know, and an event goes out on the live channel so their screens update
 * without a refresh. Keeping all three in one place is what stops the feed, the
 * bell and the board from disagreeing.
 */
import { all, run, insert } from "./db.js";
import { publish } from "./bus.js";
import { newId, nowIso, json } from "./util.js";

/** Everyone who should hear about a project: its members, plus the class teacher. */
export function projectAudience(projectId) {
  const members = all(`SELECT user_id FROM project_members WHERE project_id = ?`, projectId).map((r) => r.user_id);
  const project = all(`SELECT classroom_id, owner_id FROM projects WHERE id = ?`, projectId)[0];
  const userIds = new Set(members);
  if (project?.owner_id) userIds.add(project.owner_id);
  const classroomIds = [];
  if (project?.classroom_id) {
    classroomIds.push(project.classroom_id);
    for (const row of all(`SELECT user_id FROM enrollments WHERE classroom_id = ? AND role IN ('teacher','assistant')`, project.classroom_id)) {
      userIds.add(row.user_id);
    }
  }
  return { userIds: [...userIds], classroomIds };
}

export function classroomAudience(classroomId) {
  const teachers = all(`SELECT user_id FROM enrollments WHERE classroom_id = ?`, classroomId).map((r) => r.user_id);
  const owner = all(`SELECT owner_id FROM classrooms WHERE id = ?`, classroomId)[0]?.owner_id;
  const userIds = new Set(teachers);
  if (owner) userIds.add(owner);
  return { userIds: [...userIds], classroomIds: [classroomId] };
}

/**
 * Write the activity row, notify and publish — in one call.
 *
 * @param {object} event
 * @param {string} event.verb      "task.completed", "task.assigned", ...
 * @param {string} event.subject   a human sentence, already written
 * @param {string} [event.projectId]
 * @param {string} [event.classroomId]
 * @param {string} [event.actorId]
 * @param {object} [event.meta]
 * @param {Array}  [event.notify]  [{ userId, title, body, link, kind }]
 * @param {boolean}[event.quiet]   do not publish (used by seeding)
 */
export function record(event) {
  const at = event.at || nowIso();
  const id = newId("act", new Date(at).getTime());
  insert("activity", {
    id,
    project_id: event.projectId ?? null,
    classroom_id: event.classroomId ?? null,
    actor_id: event.actorId ?? null,
    verb: event.verb,
    subject: event.subject ?? "",
    meta: json(event.meta, {}),
    created_at: at,
  });

  for (const item of event.notify ?? []) {
    if (!item?.userId) continue;
    if (item.userId === event.actorId && !item.notifySelf) continue;
    insert("notifications", {
      id: newId("ntf", new Date(at).getTime()),
      user_id: item.userId,
      kind: item.kind ?? "info",
      title: item.title ?? event.subject ?? "",
      body: item.body ?? "",
      link: item.link ?? "",
      meta: json(item.meta, {}),
      created_at: at,
    });
  }

  if (!event.quiet) {
    const audience = event.projectId ? projectAudience(event.projectId) : event.classroomId ? classroomAudience(event.classroomId) : { userIds: [], classroomIds: [] };
    publish(event.type ?? event.verb, {
      ...(event.meta || {}),
      projectId: event.projectId ?? null,
      classroomId: event.classroomId ?? null,
      actorId: event.actorId ?? null,
      subject: event.subject ?? "",
      activityId: id,
    }, {
      to: [...new Set([...(audience.userIds || []), ...((event.notify ?? []).map((n) => n.userId))])],
      classrooms: audience.classroomIds,
      broadcast: event.broadcast,
    });
  }

  return id;
}

/** Tell one person something without touching a project's feed. */
export function tell({ userId, kind = "info", title, body = "", link = "", meta = {}, type = "notify" }) {
  const at = nowIso();
  const id = newId("ntf");
  insert("notifications", { id, user_id: userId, kind, title, body, link, meta: json(meta, {}), created_at: at });
  publish(type, { notificationId: id, title, body, link, kind }, { to: [userId] });
  return id;
}

export const unseenActivity = (userId, since) =>
  all(
    `SELECT a.* FROM activity a
      WHERE a.created_at > ?
        AND (a.project_id IS NULL OR a.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?))
      ORDER BY a.created_at DESC LIMIT 50`,
    since,
    userId,
  );