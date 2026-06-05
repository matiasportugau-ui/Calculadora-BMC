import assert from "node:assert/strict";
import { detectCalendarDrift } from "../server/routes/tasksSync.js";

const baseBmcTask = {
  due_time: "09:30:00",
  is_all_day: false,
  recurrence_rule: "RRULE:FREQ=WEEKLY",
};

{
  const reason = detectCalendarDrift(baseBmcTask, {
    start: { dateTime: "2026-06-05T09:30:00-03:00" },
    recurrence: ["RRULE:FREQ=WEEKLY"],
  });
  assert.equal(reason, null, "matching timed Calendar event should not create drift");
}

{
  const reason = detectCalendarDrift(baseBmcTask, null);
  assert.equal(reason, "event_missing", "missing paired event should be reported");
}

{
  const reason = detectCalendarDrift(baseBmcTask, {
    start: { date: "2026-06-05" },
    recurrence: ["RRULE:FREQ=WEEKLY"],
  });
  assert.equal(reason, "all_day_mismatch", "all-day Calendar event should differ from timed BMC task");
}

{
  const reason = detectCalendarDrift(baseBmcTask, {
    start: { dateTime: "2026-06-05T10:00:00-03:00" },
    recurrence: ["RRULE:FREQ=WEEKLY"],
  });
  assert.equal(reason, "time_mismatch", "Calendar time change should be detected by HH:MM");
}

{
  const reason = detectCalendarDrift(baseBmcTask, {
    start: { dateTime: "2026-06-05T09:30:00-03:00" },
    recurrence: ["RRULE:FREQ=MONTHLY"],
  });
  assert.equal(reason, "recurrence_mismatch", "Calendar recurrence change should be detected");
}

{
  const reason = detectCalendarDrift(
    { due_time: null, is_all_day: true, recurrence_rule: null },
    { start: { date: "2026-06-05" } },
  );
  assert.equal(reason, null, "matching all-day non-recurring task should not create drift");
}

console.log("tasksCalendarDrift tests OK (6/6)");
