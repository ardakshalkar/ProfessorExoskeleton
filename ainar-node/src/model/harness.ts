/**
 * Harness entities: how the exoskeleton reacts and what it asks of the professor.
 * Ported from `ainar/model/harness.py`.
 */

import { z } from "zod";
import {
  ActionId,
  ActionStatus,
  CourseVersionId,
  EventId,
  Priority,
  Provenance,
  UserId,
  awareDatetime,
  entity,
} from "./common.ts";

export const CourseEvent = entity({
  event_id: EventId,
  event_type: z.string(),
  course_version_id: CourseVersionId,
  entity_type: z.string().nullish(),
  entity_id: z.string().nullish(),
  occurred_at: awareDatetime(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const ActionItem = entity({
  action_id: ActionId,
  course_version_id: CourseVersionId,
  assigned_to: UserId,
  type: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  priority: Priority.default("medium"),
  source_event_id: EventId.nullish(),
  source_refs: z.array(z.string()).default([]),
  status: ActionStatus.default("pending"),
  due_at: awareDatetime().nullish(),
  available_actions: z.array(z.string()).default(["review", "approve", "delegate", "dismiss"]),
  provenance: Provenance.nullish(),
});
