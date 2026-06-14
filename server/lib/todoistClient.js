import { config } from "../config.js";

const BASE = "https://api.todoist.com/rest/v2";

function notConfigured() {
  return Object.assign(new Error("TODOIST_API_TOKEN not set — add it to .env"), {
    code: "TODOIST_NOT_CONFIGURED",
  });
}

async function todoistFetch(path) {
  const token = config.todoistApiToken;
  if (!token) throw notConfigured();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Todoist ${res.status}: ${path}`);
  return res.json();
}

export async function getSections(projectId) {
  return todoistFetch(`/sections?project_id=${projectId}`);
}

export async function getActiveTasks(projectId) {
  return todoistFetch(`/tasks?project_id=${projectId}`);
}
