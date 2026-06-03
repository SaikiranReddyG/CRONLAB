import Database from "better-sqlite3";
import path from "path";

const dbFile = path.join(process.cwd(), "database.db");
const db = new Database(dbFile);

// Enforce Foreign Key Constraints
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

/**
 * CUSTOMIZE THIS SECTION WITH YOUR REAL DATA!
 * Edit the arrays below with your actual projects, checklist items, logs, and ideas.
 */
const SEED_DATA = {
  // Define your real projects here
  projects: [
    {
      id: "ai-copilot",
      name: "AI Copilot Integration",
      tag: "ai-copilot",
      status: "ACTIVE", // ACTIVE, COMPLETED, PAUSED
      percentDone: 35,
      lastTouched: new Date().toISOString(),
      velocity: "flat" as "up" | "down" | "flat",
      mood: "calm" as "calm" | "energized" | "focused" | "tired" | "tense",
      dateStarted: "2026-05-15", // YYYY-MM-DD
      age: "9 days",
      checklist: [
        { id: "cop-1", text: "Design SQLite backend schema structure", done: true, completedAt: "2026-05-18T10:00:00.000Z" },
        { id: "cop-2", text: "Implement incremental log analysis algorithm", done: true, completedAt: "2026-05-20T14:30:00.000Z" },
        { id: "cop-3", text: "Build main active workspace dashboard UI", done: false },
        { id: "cop-4", text: "Set up keyboard shortcuts for quick swaps", done: false },
        { id: "cop-5", text: "Implement real-time micro-sessions and focus rating", done: false }
      ]
    },
    {
      id: "nextjs-migration",
      name: "Next.js 15 App Router Migration",
      tag: "nextjs",
      status: "ACTIVE",
      percentDone: 60,
      lastTouched: new Date().toISOString(),
      velocity: "up" as "up" | "down" | "flat",
      mood: "focused" as "calm" | "energized" | "focused" | "tired" | "tense",
      dateStarted: "2026-05-10",
      age: "14 days",
      checklist: [
        { id: "next-1", text: "Audit existing React Router client routes", done: true, completedAt: "2026-05-12T09:00:00.000Z" },
        { id: "next-2", text: "Configure new middleware boundary handlers", done: true, completedAt: "2026-05-13T16:20:00.000Z" },
        { id: "next-3", text: "Transition auth context state to Server Actions", done: true, completedAt: "2026-05-15T11:45:00.000Z" },
        { id: "next-4", text: "Optimize static page pre-rendering blocks", done: false },
        { id: "next-5", text: "Validate runtime performance on edge clusters", done: false }
      ]
    },
    {
      id: "marketing-site",
      name: "Product Landing Page & Copy",
      tag: "marketing",
      status: "PAUSED",
      percentDone: 20,
      lastTouched: new Date().toISOString(),
      velocity: "flat" as "up" | "down" | "flat",
      mood: "calm" as "calm" | "energized" | "focused" | "tired" | "tense",
      dateStarted: "2026-05-20",
      age: "4 days",
      checklist: [
        { id: "mkt-1", text: "Draft initial punchy hero copy variations", done: true, completedAt: "2026-05-22T17:00:00.000Z" },
        { id: "mkt-2", text: "Design responsive Tailwind CSS wireframes", done: false },
        { id: "mkt-3", text: "Set up analytics tracking with custom metrics", done: false }
      ]
    }
  ],

  // Optional: Seed initial logs for your work tracking history
  logs: [
    {
      id: "log-initial-1",
      timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
      rawText: "Completed Next.js auth migration items! Moving over to Next.js middleware routing configs next. >next Optimize static page pre-rendering blocks (+idea verify performance of edge actions)",
      project: "nextjs-migration",
      mood: "focused",
      intentions: ["Optimize static page pre-rendering blocks"],
      ideas: ["verify performance of edge actions"],
      sessionStart: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: "log-initial-2",
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), // 24 hours ago
      rawText: "Worked on core SQLite design specifications. Set up indices for robust foreign key cascades.",
      project: "ai-copilot",
      mood: "calm",
      intentions: [],
      ideas: [],
      sessionStart: undefined
    }
  ],

  // Optional: Seed ideas that you want readily available in your Resurface bank
  resurfacedIdeas: [
    {
      id: "idea-1",
      timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
      rawText: "Integrate keyboard navigation (vim-like bindings) to move around projects list",
      project: "ai-copilot",
      ageDays: 2.0,
      status: "active" as "active" | "later" | "done",
      deferredCount: 0
    },
    {
      id: "idea-2",
      timestamp: new Date(Date.now() - 3600000 * 72).toISOString(),
      rawText: "Build structural static sitemaps generated on deploy hook",
      project: "marketing-site",
      ageDays: 3.0,
      status: "later" as "active" | "later" | "done",
      deferredCount: 1
    }
  ]
};

function seed() {
  console.log("=== CRONLAB DATABASE SEEDER ===");
  console.log(`Target database: ${dbFile}`);

  db.transaction(() => {
    // 1. Clear existing application data safely
    console.log("Wiping logs, checklist_items, projects, resurfaced_ideas, and sessions...");
    db.exec("DELETE FROM logs");
    db.exec("DELETE FROM checklist_items");
    db.exec("DELETE FROM projects");
    db.exec("DELETE FROM resurfaced_ideas");
    db.exec("DELETE FROM sessions");

    // 2. Insert Projects and Checklist Items
    console.log(`Inserting ${SEED_DATA.projects.length} projects...`);
    const insertProj = db.prepare(`
      INSERT INTO projects (id, name, tag, status, percent_done, last_touched, velocity, mood, date_started, age)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertChecklist = db.prepare(`
      INSERT INTO checklist_items (id, project_id, text, done, completed_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const p of SEED_DATA.projects) {
      insertProj.run(
        p.id,
        p.name,
        p.tag,
        p.status,
        p.percentDone,
        p.lastTouched,
        p.velocity,
        p.mood,
        p.dateStarted,
        p.age
      );

      console.log(`  Added project: ${p.name} (#${p.tag})`);
      for (const item of p.checklist) {
        insertChecklist.run(
          item.id,
          p.id,
          item.text,
          item.done ? 1 : 0,
          item.completedAt || null
        );
        console.log(`    -> Checklist item: [${item.done ? "X" : " "}] ${item.text}`);
      }
    }

    // 3. Insert Logs
    console.log(`Inserting ${SEED_DATA.logs.length} logs...`);
    const insertLog = db.prepare(`
      INSERT INTO logs (id, timestamp, raw_text, project, mood, intentions_json, ideas_json, session_start)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const l of SEED_DATA.logs) {
      insertLog.run(
        l.id,
        l.timestamp,
        l.rawText,
        l.project,
        l.mood,
        JSON.stringify(l.intentions),
        JSON.stringify(l.ideas),
        l.sessionStart || null
      );
    }

    // 4. Insert Resurfaced Ideas
    console.log(`Inserting ${SEED_DATA.resurfacedIdeas.length} ideas...`);
    const insertIdea = db.prepare(`
      INSERT INTO resurfaced_ideas (id, timestamp, raw_text, project, age_days, status, deferred_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of SEED_DATA.resurfacedIdeas) {
      insertIdea.run(
        r.id,
        r.timestamp,
        r.rawText,
        r.project,
        r.ageDays,
        r.status,
        r.deferredCount
      );
    }

    // 5. Initialize the Active Session
    // We bind the session current state to the first project in our list (e.g. active-focused) or default.
    const defaultProject = SEED_DATA.projects[0]?.id || "compiler";
    console.log(`Initializing active session linked to default project: ${defaultProject}`);
    
    // Sparkline array (activity heatmap of 24 hours)
    const emptySparkline = Array(24).fill(0);
    // Backfill current hour slightly to show starting engagement color in UI metrics
    const currentHour = new Date().getHours();
    emptySparkline[currentHour] = 1;

    db.prepare(`
      INSERT OR REPLACE INTO sessions (
        id, project, start_time, last_log_line, elapsed_seconds, is_paused, missed_pings, next_ping_in, last_active,
        today_focus_json, focus_depth, dead_time_count, topic_entropy, project_age_vs_progress_json, sparkline_json,
        last_reset_date, total_pings_json, is_awaiting_response, awaiting_response_remaining
      ) VALUES (
        'current', ?, ?, 'Database seed successfully applied.', 0, 1, 0, 60, null, 
        ?, 100, 0, 1.2, 
        ?, ?,
        ?, ?, 0, 0
      )
    `).run(
      defaultProject,
      new Date().toISOString(),
      JSON.stringify({ [defaultProject]: 1 }),
      JSON.stringify({ [defaultProject]: { age: 1, progress: SEED_DATA.projects[0]?.percentDone || 0 } }),
      JSON.stringify(emptySparkline),
      new Date().toDateString(),
      JSON.stringify(Array(24).fill(0))
    );
  })();

  console.log("=========================================");
  console.log(" SUCCESS: Database seeded successfully!");
  console.log("=========================================");
}

try {
  seed();
} catch (error) {
  console.error("An error occurred during database seeding:", error);
  process.exit(1);
}
