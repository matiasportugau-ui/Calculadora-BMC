import assert from "node:assert/strict";
import {
  normalizeDueTime,
  normalizeRecurrence,
} from "../server/routes/tasks.js";

{
  assert.equal(normalizeDueTime(null), null, "null due_time clears the stored time");
  assert.equal(normalizeDueTime(""), null, "empty due_time clears the stored time");
  assert.equal(normalizeDueTime("7:05"), "07:05:00", "single-digit hour should be padded");
  assert.equal(normalizeDueTime("23:59:30"), "23:59:30", "seconds should be preserved");
  assert.equal(normalizeDueTime("24:00"), undefined, "hour 24 is invalid");
  assert.equal(normalizeDueTime("12:60"), undefined, "minute 60 is invalid");
  assert.equal(normalizeDueTime("tomorrow morning"), undefined, "free text time is invalid");
}

{
  assert.equal(normalizeRecurrence(null), null, "null recurrence clears repeat");
  assert.equal(normalizeRecurrence(""), null, "blank recurrence clears repeat");
  assert.equal(normalizeRecurrence("none"), null, "none recurrence clears repeat");
  assert.equal(
    normalizeRecurrence("does_not_repeat"),
    null,
    "Google Tasks no-repeat marker clears repeat",
  );
  assert.equal(
    normalizeRecurrence("Weekly"),
    "RRULE:FREQ=WEEKLY",
    "bare frequencies should map to canonical RRULE strings",
  );
  assert.equal(
    normalizeRecurrence(" RRULE:FREQ=MONTHLY;INTERVAL=2 "),
    "RRULE:FREQ=MONTHLY;INTERVAL=2",
    "existing RRULE strings should pass through trimmed",
  );
  assert.equal(
    normalizeRecurrence("every business day"),
    null,
    "unsupported recurrence text should not violate the RRULE DB check",
  );
}

console.log("tasksRichFields tests OK (14/14)");
