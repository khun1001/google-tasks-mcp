#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { google, tasks_v1 } from "googleapis";
import { loadSavedCredentialsIfExist, TOKEN_PATH } from "./auth.js";

let tasksClient: tasks_v1.Tasks | null = null;

/** Lazily build an authorized Tasks client; throws a clear error if not authorized yet. */
async function getTasks(): Promise<tasks_v1.Tasks> {
  if (tasksClient) return tasksClient;
  const auth = await loadSavedCredentialsIfExist();
  if (!auth) {
    throw new Error(
      `Not authorized yet. No token found at ${TOKEN_PATH}. ` +
        `Run "npm run auth" in the google-tasks-mcp folder once to sign in.`
    );
  }
  tasksClient = google.tasks({ version: "v1", auth });
  return tasksClient;
}

/** Helper: return API data as pretty JSON text content. */
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({ name: "google-tasks", version: "1.0.0" });

// ---- Task lists ----

server.tool(
  "list_tasklists",
  "List all of the user's task lists (returns id + title for each).",
  {},
  async () => {
    const tasks = await getTasks();
    const res = await tasks.tasklists.list({ maxResults: 100 });
    const lists = (res.data.items ?? []).map((l) => ({ id: l.id, title: l.title }));
    return ok(lists);
  }
);

server.tool(
  "create_tasklist",
  "Create a new task list.",
  { title: z.string().describe("Title of the new task list") },
  async ({ title }) => {
    const tasks = await getTasks();
    const res = await tasks.tasklists.insert({ requestBody: { title } });
    return ok({ id: res.data.id, title: res.data.title });
  }
);

// ---- Tasks (read) ----

server.tool(
  "list_tasks",
  "List tasks in a task list. Supports date-range filters, useful for weekly reports.",
  {
    tasklist: z
      .string()
      .default("@default")
      .describe('Task list id, or "@default" for the default list'),
    showCompleted: z
      .boolean()
      .default(true)
      .describe("Include completed tasks (default true — needed for reports)"),
    showHidden: z
      .boolean()
      .default(true)
      .describe("Include hidden (completed & cleared) tasks"),
    showAssigned: z
      .boolean()
      .default(true)
      .describe(
        "Include tasks assigned to you from Google Docs / Chat spaces (the ones with a person icon). Default true."
      ),
    dueMin: z.string().optional().describe("RFC3339 lower bound on due date"),
    dueMax: z.string().optional().describe("RFC3339 upper bound on due date"),
    completedMin: z
      .string()
      .optional()
      .describe("RFC3339 lower bound on completion time (e.g. start of the week)"),
    completedMax: z
      .string()
      .optional()
      .describe("RFC3339 upper bound on completion time (e.g. end of the week)"),
    maxResults: z.number().int().min(1).max(100).default(100),
  },
  async (args) => {
    const tasks = await getTasks();
    const res = await tasks.tasks.list({
      tasklist: args.tasklist,
      showCompleted: args.showCompleted,
      showHidden: args.showHidden,
      showAssigned: args.showAssigned,
      dueMin: args.dueMin,
      dueMax: args.dueMax,
      completedMin: args.completedMin,
      completedMax: args.completedMax,
      maxResults: args.maxResults,
    });
    const items = (res.data.items ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due: t.due,
      completed: t.completed,
      notes: t.notes,
      parent: t.parent,
      updated: t.updated,
    }));
    return ok(items);
  }
);

server.tool(
  "get_task",
  "Get a single task's full details.",
  {
    tasklist: z.string().default("@default"),
    task: z.string().describe("Task id"),
  },
  async ({ tasklist, task }) => {
    const tasks = await getTasks();
    const res = await tasks.tasks.get({ tasklist, task });
    return ok(res.data);
  }
);

// ---- Tasks (write) ----

server.tool(
  "create_task",
  "Create a new task in a task list.",
  {
    tasklist: z.string().default("@default"),
    title: z.string().describe("Task title"),
    notes: z.string().optional().describe("Task notes/description"),
    due: z
      .string()
      .optional()
      .describe("Due date, RFC3339 (e.g. 2026-08-10T00:00:00.000Z). Time is ignored by Google."),
    parent: z.string().optional().describe("Parent task id, to create a subtask"),
    previous: z.string().optional().describe("Previous sibling task id, to control ordering"),
  },
  async ({ tasklist, title, notes, due, parent, previous }) => {
    const tasks = await getTasks();
    const res = await tasks.tasks.insert({
      tasklist,
      parent,
      previous,
      requestBody: { title, notes, due },
    });
    return ok(res.data);
  }
);

server.tool(
  "update_task",
  "Update fields of an existing task (only provided fields change).",
  {
    tasklist: z.string().default("@default"),
    task: z.string().describe("Task id"),
    title: z.string().optional(),
    notes: z.string().optional(),
    due: z.string().optional().describe("RFC3339 due date"),
    status: z
      .enum(["needsAction", "completed"])
      .optional()
      .describe('Task status; "completed" marks it done'),
  },
  async ({ tasklist, task, title, notes, due, status }) => {
    const tasks = await getTasks();
    const requestBody: tasks_v1.Schema$Task = {};
    if (title !== undefined) requestBody.title = title;
    if (notes !== undefined) requestBody.notes = notes;
    if (due !== undefined) requestBody.due = due;
    if (status !== undefined) {
      requestBody.status = status;
      // Google requires completed timestamp cleared when reverting to needsAction.
      if (status === "needsAction") requestBody.completed = null;
    }
    const res = await tasks.tasks.patch({ tasklist, task, requestBody });
    return ok(res.data);
  }
);

server.tool(
  "complete_task",
  "Mark a task as completed (convenience wrapper around update_task).",
  {
    tasklist: z.string().default("@default"),
    task: z.string().describe("Task id"),
  },
  async ({ tasklist, task }) => {
    const tasks = await getTasks();
    const res = await tasks.tasks.patch({
      tasklist,
      task,
      requestBody: { status: "completed" },
    });
    return ok(res.data);
  }
);

server.tool(
  "delete_task",
  "Permanently delete a task.",
  {
    tasklist: z.string().default("@default"),
    task: z.string().describe("Task id"),
  },
  async ({ tasklist, task }) => {
    const tasks = await getTasks();
    await tasks.tasks.delete({ tasklist, task });
    return ok({ deleted: true, task });
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is reserved for the MCP protocol.
  console.error("google-tasks MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
