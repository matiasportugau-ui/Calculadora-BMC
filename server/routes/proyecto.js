import { Router } from "express";
import { getSections, getActiveTasks } from "../lib/todoistClient.js";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";

const router = Router();

// In Todoist REST API v2: priority 4 = p1 (highest), 1 = p4 (lowest)
function priorityLabel(p) {
  return p === 4 ? "p1" : p === 3 ? "p2" : p === 2 ? "p3" : "p4";
}

function durationMinutes(d) {
  if (!d) return null;
  if (d.unit === "minute") return d.amount;
  if (d.unit === "day") return d.amount * 1440;
  return d.amount * 60; // "hour" fallback
}

router.get("/proyecto/status", requireUser(), async (req, res) => {
  const projectId = config.todoistBmcProjectId;
  try {
    const [sections, tasks] = await Promise.all([
      getSections(projectId),
      getActiveTasks(projectId),
    ]);

    const sectionIndex = Object.fromEntries(sections.map((s) => [s.id, { ...s, tasks: [] }]));
    for (const t of tasks) {
      if (sectionIndex[t.section_id]) sectionIndex[t.section_id].tasks.push(t);
    }

    const COMPLETED_NAME = "Completado";
    const completedId = sections.find((s) => s.name === COMPLETED_NAME)?.id;
    const completedCount = completedId ? (sectionIndex[completedId]?.tasks.length ?? 0) : 0;
    const activeTasks = tasks.filter((t) => t.section_id !== completedId);

    const sectionList = sections
      .filter((s) => s.name !== COMPLETED_NAME)
      .map((s) => {
        const st = sectionIndex[s.id].tasks;
        return {
          id: s.id,
          name: s.name,
          taskCount: st.length,
          blockedCount: st.filter((t) => t.priority === 4).length,
          highCount: st.filter((t) => t.priority >= 3).length,
          estimatedMinutes: st.reduce((acc, t) => acc + (durationMinutes(t.duration) ?? 0), 0),
          tasks: st.map((t) => ({
            id: t.id,
            content: t.content,
            priority: priorityLabel(t.priority),
            priorityRaw: t.priority,
            durationMin: durationMinutes(t.duration),
          })),
        };
      });

    const priorityQueue = activeTasks
      .map((t) => ({
        id: t.id,
        content: t.content,
        priority: priorityLabel(t.priority),
        priorityRaw: t.priority,
        sectionName: sectionIndex[t.section_id]?.name ?? "—",
        durationMin: durationMinutes(t.duration),
        description: t.description || "",
      }))
      .sort((a, b) => {
        if (b.priorityRaw !== a.priorityRaw) return b.priorityRaw - a.priorityRaw;
        const da = a.durationMin ?? 9999;
        const db = b.durationMin ?? 9999;
        return da - db;
      })
      .slice(0, 10);

    res.json({
      projectId,
      syncedAt: new Date().toISOString(),
      sections: sectionList,
      totals: {
        active: activeTasks.length,
        completed: completedCount,
        total: tasks.length,
        blocked: activeTasks.filter((t) => t.priority === 4).length,
        estimatedMinutes: activeTasks.reduce((acc, t) => acc + (durationMinutes(t.duration) ?? 0), 0),
      },
      priorityQueue,
    });
  } catch (err) {
    if (err.code === "TODOIST_NOT_CONFIGURED") {
      return res.status(503).json({ code: "TODOIST_NOT_CONFIGURED", message: err.message });
    }
    res.status(503).json({ code: "todoist_error", message: err.message });
  }
});

export default router;
