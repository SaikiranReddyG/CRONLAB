import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { CronlabState, Project, LogEntry, ResurfacedIdea, ActiveSession, Metrics } from "./src/types";

const dbFile = path.join(process.cwd(), "database.db");
const dbJsonFile = path.join(process.cwd(), "db.json");

const db = new Database(dbFile);

// Enable WAL mode for high concurrency
db.pragma("journal_mode = WAL");

// Initialize Schema Version Table
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`);

// Get current migration version
function getCurrentVersion(): number {
  const row = db.prepare("SELECT MAX(version) as ver FROM schema_version").get() as { ver: number | null };
  return row?.ver ?? 0;
}

// Function to run migrations
export function initDB() {
  const currentVersion = getCurrentVersion();
  
  if (currentVersion < 1) {
    db.transaction(() => {
      // 1. Create table projects
      db.exec(`
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          tag TEXT NOT NULL,
          status TEXT NOT NULL,
          percent_done INTEGER NOT NULL,
          last_touched TEXT NOT NULL,
          velocity TEXT NOT NULL,
          mood TEXT NOT NULL,
          date_started TEXT NOT NULL,
          age TEXT NOT NULL
        );
      `);

      // 2. Create table checklist_items
      db.exec(`
        CREATE TABLE checklist_items (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          text TEXT NOT NULL,
          done INTEGER NOT NULL,
          completed_at TEXT,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
      `);

      // 3. Create table logs
      db.exec(`
        CREATE TABLE logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          raw_text TEXT NOT NULL,
          project TEXT NOT NULL,
          mood TEXT NOT NULL,
          intentions_json TEXT NOT NULL,
          ideas_json TEXT NOT NULL
        );
      `);

      // 4. Create table resurfaced_ideas
      db.exec(`
        CREATE TABLE resurfaced_ideas (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          raw_text TEXT NOT NULL,
          project TEXT NOT NULL,
          age_days REAL NOT NULL,
          status TEXT NOT NULL,
          deferred_count INTEGER NOT NULL
        );
      `);

      // 5. Create table sessions
      db.exec(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY DEFAULT 'current',
          project TEXT,
          start_time TEXT,
          last_log_line TEXT,
          elapsed_seconds INTEGER,
          is_paused INTEGER,
          missed_pings INTEGER,
          next_ping_in INTEGER,
          last_active TEXT,
          today_focus_json TEXT,
          focus_depth INTEGER,
          dead_time_count INTEGER,
          topic_entropy REAL,
          project_age_vs_progress_json TEXT,
          sparkline_json TEXT
        );
      `);

      db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)").run(1, new Date().toISOString());
    })();

    console.log("[MIGRATION] Schema Version 1 initialized successfully.");
    
    // Check if db.json exists, if so migrate its contents
    if (fs.existsSync(dbJsonFile)) {
      try {
        console.log("[MIGRATION] db.json detected. Migrating to SQLite...");
        const rawJson = fs.readFileSync(dbJsonFile, "utf-8");
        const oldState: CronlabState = JSON.parse(rawJson);
        
        db.transaction(() => {
          // Import projects
          if (Array.isArray(oldState.projects)) {
            const insertProject = db.prepare(`
              INSERT INTO projects (id, name, tag, status, percent_done, last_touched, velocity, mood, date_started, age)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const insertChecklist = db.prepare(`
              INSERT INTO checklist_items (id, project_id, text, done, completed_at)
              VALUES (?, ?, ?, ?, ?)
            `);

            for (const p of oldState.projects) {
              insertProject.run(p.id, p.name, p.tag, p.status, p.percentDone, p.lastTouched, p.velocity, p.mood, p.dateStarted, p.age);
              if (Array.isArray(p.checklist)) {
                for (const item of p.checklist) {
                  insertChecklist.run(item.id, p.id, item.text, item.done ? 1 : 0, item.completedAt || null);
                }
              }
            }
          }

          // Import logs
          if (Array.isArray(oldState.logs)) {
            const insertLog = db.prepare(`
              INSERT INTO logs (id, timestamp, raw_text, project, mood, intentions_json, ideas_json)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            for (const l of oldState.logs) {
              insertLog.run(l.id, l.timestamp, l.rawText, l.project, l.mood, JSON.stringify(l.intentions || []), JSON.stringify(l.ideas || []));
            }
          }

          // Import resurfaced ideas
          if (Array.isArray(oldState.resurfacedIdeas)) {
            const insertIdea = db.prepare(`
              INSERT INTO resurfaced_ideas (id, timestamp, raw_text, project, age_days, status, deferred_count)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            for (const r of oldState.resurfacedIdeas) {
              insertIdea.run(r.id, r.timestamp, r.rawText, r.project, r.ageDays, r.status, r.deferredCount);
            }
          }

          // Import activeSession and metrics
          if (oldState.activeSession) {
            db.prepare(`
              INSERT OR REPLACE INTO sessions (
                id, project, start_time, last_log_line, elapsed_seconds, is_paused, missed_pings, next_ping_in, last_active,
                today_focus_json, focus_depth, dead_time_count, topic_entropy, project_age_vs_progress_json, sparkline_json
              ) VALUES ('current', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              oldState.activeSession.project,
              oldState.activeSession.startTime,
              oldState.activeSession.lastLogLine,
              oldState.activeSession.elapsedSeconds,
              oldState.activeSession.isPaused ? 1 : 0,
              oldState.activeSession.missedPings,
              oldState.activeSession.nextPingIn,
              oldState.activeSession.lastActive || null,
              JSON.stringify(oldState.metrics?.todayFocus || {}),
              oldState.metrics?.focusDepth ?? 80,
              oldState.metrics?.deadTimeCount ?? 0,
              oldState.metrics?.topicEntropy ?? 1.5,
              JSON.stringify(oldState.metrics?.projectAgeVsProgress || {}),
              JSON.stringify(oldState.metrics?.sparkline || Array(24).fill(0))
            );
          }
        })();

        console.log("[MIGRATION] db.json imported to SQLite successfully. Renaming to db.json.bak");
        fs.renameSync(dbJsonFile, dbJsonFile + ".bak");
      } catch (err) {
        console.error("[MIGRATION] db.json migration failed:", err);
      }
    }
  }

  if (currentVersion < 2) {
    db.transaction(() => {
      try {
        db.exec("ALTER TABLE logs ADD COLUMN session_start TEXT;");
      } catch (e) {}
      try {
        db.exec("ALTER TABLE sessions ADD COLUMN last_reset_date TEXT;");
      } catch (e) {}
      try {
        db.exec("ALTER TABLE sessions ADD COLUMN total_pings_json TEXT;");
      } catch (e) {}
      
      db.prepare("INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)").run(2, new Date().toISOString());
    })();
    console.log("[MIGRATION] Schema Version 2 initialized successfully.");
  }
}

export function getCompleteState(): CronlabState {
  // Query projects and join / map checklist items
  const projectsRows = db.prepare("SELECT * FROM projects").all() as any[];
  const projects: Project[] = [];
  
  for (const p of projectsRows) {
    const checklistRows = db.prepare("SELECT * FROM checklist_items WHERE project_id = ?").all(p.id) as any[];
    
    // Dynamic age calculation
    let calculatedAge = p.age;
    try {
      const start = new Date(p.date_started);
      const now = new Date();
      const diffTime = now.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      calculatedAge = `${Math.max(0, diffDays)} days`;
    } catch {
      calculatedAge = p.age || "0 days";
    }

    projects.push({
      id: p.id,
      name: p.name,
      tag: p.tag,
      status: p.status,
      percentDone: p.percent_done,
      lastTouched: p.last_touched,
      velocity: p.velocity,
      mood: p.mood,
      dateStarted: p.date_started,
      age: calculatedAge,
      checklist: checklistRows.map((item) => ({
        id: item.id,
        text: item.text,
        done: item.done === 1,
        completedAt: item.completed_at || undefined,
      })),
    });
  }

  // Query logs
  const logsRows = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC").all() as any[];
  const logs: LogEntry[] = logsRows.map((l) => ({
    id: l.id,
    timestamp: l.timestamp,
    rawText: l.raw_text,
    project: l.project,
    mood: l.mood,
    intentions: l.intentions_json ? JSON.parse(l.intentions_json) : [],
    ideas: l.ideas_json ? JSON.parse(l.ideas_json) : [],
    sessionStart: l.session_start || undefined,
  }));

  // Query resurfaced_ideas
  const resurfacedIdeaRows = db.prepare("SELECT * FROM resurfaced_ideas ORDER BY timestamp DESC").all() as any[];
  const resurfacedIdeas: ResurfacedIdea[] = resurfacedIdeaRows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    rawText: r.raw_text,
    project: r.project,
    ageDays: r.age_days,
    status: r.status,
    deferredCount: r.deferred_count,
  }));

  // Query session row
  let sessionRow = db.prepare("SELECT * FROM sessions WHERE id = 'current'").get() as any;
  if (!sessionRow) {
    // If sessions table is somehow blank, seed fallback with default columns
    db.prepare(`
      INSERT INTO sessions (
        id, project, start_time, last_log_line, elapsed_seconds, is_paused, missed_pings, next_ping_in, last_active,
        today_focus_json, focus_depth, dead_time_count, topic_entropy, project_age_vs_progress_json, sparkline_json,
        last_reset_date, total_pings_json
      ) VALUES ('current', 'compiler', ?, 'Welcome to Cronlab.', 0, 1, 0, 60, null, '{}', 80, 0, 1.5, '{}', ?, ?, ?)
    `).run(
      new Date().toISOString(), 
      JSON.stringify(Array(24).fill(0)), 
      new Date().toDateString(), 
      JSON.stringify(Array(24).fill(0))
    );
    sessionRow = db.prepare("SELECT * FROM sessions WHERE id = 'current'").get() as any;
  }

  // Midnight reset check!
  const todayStr = new Date().toDateString();
  if (sessionRow.last_reset_date !== todayStr) {
    db.prepare(`
      UPDATE sessions SET
        dead_time_count = 0,
        today_focus_json = '{}',
        sparkline_json = ?,
        total_pings_json = ?,
        last_reset_date = ?
      WHERE id = 'current'
    `).run(JSON.stringify(Array(24).fill(0)), JSON.stringify(Array(24).fill(0)), todayStr);
    
    // Reload reset row
    sessionRow = db.prepare("SELECT * FROM sessions WHERE id = 'current'").get() as any;
  }

  const activeSession: ActiveSession = {
    project: sessionRow.project,
    startTime: sessionRow.start_time,
    lastLogLine: sessionRow.last_log_line,
    elapsedSeconds: sessionRow.elapsed_seconds,
    isPaused: sessionRow.is_paused === 1,
    missedPings: sessionRow.missed_pings,
    nextPingIn: sessionRow.next_ping_in,
    lastActive: sessionRow.last_active || undefined,
    lastResetDate: sessionRow.last_reset_date || undefined,
  };

  const metrics: Metrics = {
    todayFocus: JSON.parse(sessionRow.today_focus_json || "{}"),
    focusDepth: sessionRow.focus_depth,
    deadTimeCount: sessionRow.dead_time_count,
    topicEntropy: sessionRow.topic_entropy,
    projectAgeVsProgress: JSON.parse(sessionRow.project_age_vs_progress_json || "{}"),
    sparkline: JSON.parse(sessionRow.sparkline_json || "[]"),
    totalPings: JSON.parse(sessionRow.total_pings_json || "[]"),
  };

  return {
    projects,
    logs,
    resurfacedIdeas,
    activeSession,
    metrics,
  };
}

export function saveCompleteState(state: CronlabState) {
  db.transaction(() => {
    // 1. Update/sessions
    db.prepare(`
      INSERT OR REPLACE INTO sessions (
        id, project, start_time, last_log_line, elapsed_seconds, is_paused, missed_pings, next_ping_in, last_active,
        today_focus_json, focus_depth, dead_time_count, topic_entropy, project_age_vs_progress_json, sparkline_json,
        last_reset_date, total_pings_json
      ) VALUES (
        'current', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      state.activeSession.project,
      state.activeSession.startTime,
      state.activeSession.lastLogLine,
      state.activeSession.elapsedSeconds,
      state.activeSession.isPaused ? 1 : 0,
      state.activeSession.missedPings,
      state.activeSession.nextPingIn,
      state.activeSession.lastActive || null,
      JSON.stringify(state.metrics.todayFocus || {}),
      state.metrics.focusDepth,
      state.metrics.deadTimeCount,
      state.metrics.topicEntropy,
      JSON.stringify(state.metrics.projectAgeVsProgress || {}),
      JSON.stringify(state.metrics.sparkline || []),
      (state.activeSession as any).lastResetDate || new Date().toDateString(),
      JSON.stringify(state.metrics.totalPings || [])
    );

    // 2. Track project IDs to remove deleted/obsolete projects if any
    const projectIds = state.projects.map((p) => p.id);
    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM projects WHERE id NOT IN (${placeholders})`).run(...projectIds);
      db.prepare(`DELETE FROM checklist_items WHERE project_id NOT IN (${placeholders})`).run(...projectIds);
    } else {
      db.prepare("DELETE FROM projects").run();
      db.prepare("DELETE FROM checklist_items").run();
    }

    const insertProject = db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, tag, status, percent_done, last_touched, velocity, mood, date_started, age)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of state.projects) {
      insertProject.run(p.id, p.name, p.tag, p.status, p.percentDone, p.lastTouched, p.velocity, p.mood, p.dateStarted, p.age);
      
      // Delete existing checklist items for this project or do clean update
      db.prepare("DELETE FROM checklist_items WHERE project_id = ?").run(p.id);
      
      if (Array.isArray(p.checklist) && p.checklist.length > 0) {
        const insertChecklist = db.prepare(`
          INSERT INTO checklist_items (id, project_id, text, done, completed_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const item of p.checklist) {
          insertChecklist.run(item.id, p.id, item.text, item.done ? 1 : 0, item.completedAt || null);
        }
      }
    }

    // 3. Update logs
    const logIds = state.logs.map((l) => l.id);
    if (logIds.length > 0) {
      const placeholders = logIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM logs WHERE id NOT IN (${placeholders})`).run(...logIds);
    } else {
      db.prepare("DELETE FROM logs").run();
    }

    if (state.logs.length > 0) {
      const insertLog = db.prepare(`
        INSERT OR REPLACE INTO logs (id, timestamp, raw_text, project, mood, intentions_json, ideas_json, session_start)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of state.logs) {
        insertLog.run(l.id, l.timestamp, l.rawText, l.project, l.mood, JSON.stringify(l.intentions || []), JSON.stringify(l.ideas || []), (l as any).sessionStart || null);
      }
    }

    // 4. Update resurfaced ideas
    const ideaIds = state.resurfacedIdeas.map((i) => i.id);
    if (ideaIds.length > 0) {
      const placeholders = ideaIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM resurfaced_ideas WHERE id NOT IN (${placeholders})`).run(...ideaIds);
    } else {
      db.prepare("DELETE FROM resurfaced_ideas").run();
    }

    if (state.resurfacedIdeas.length > 0) {
      const insertIdea = db.prepare(`
        INSERT OR REPLACE INTO resurfaced_ideas (id, timestamp, raw_text, project, age_days, status, deferred_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of state.resurfacedIdeas) {
        insertIdea.run(r.id, r.timestamp, r.rawText, r.project, r.ageDays, r.status, r.deferredCount);
      }
    }
  })();
}

export function resetState() {
  db.transaction(() => {
    db.exec("DELETE FROM logs");
    db.exec("DELETE FROM checklist_items");
    db.exec("DELETE FROM projects");
    db.exec("DELETE FROM resurfaced_ideas");
    db.exec("DELETE FROM sessions");
    
    // Seed default projects
    const insertProj = db.prepare(`
      INSERT INTO projects (id, name, tag, status, percent_done, last_touched, velocity, mood, date_started, age)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertChecklist = db.prepare(`
      INSERT INTO checklist_items (id, project_id, text, done, completed_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertProj.run("compiler", "COMPILER Core System", "compiler", "ACTIVE", 0, new Date().toISOString(), "flat", "calm", new Date().toISOString().split("T")[0], "0 days");
    insertChecklist.run("chk-comp-1", "compiler", "Draft project scope goals", 0, null);
    insertChecklist.run("chk-comp-2", "compiler", "Establish main build loop", 0, null);
    
    db.prepare(`
      INSERT OR REPLACE INTO sessions (
        id, project, start_time, last_log_line, elapsed_seconds, is_paused, missed_pings, next_ping_in, last_active,
        today_focus_json, focus_depth, dead_time_count, topic_entropy, project_age_vs_progress_json, sparkline_json
      ) VALUES (
        'current', 'compiler', ?, 'Workspace initialized. Ready to record.', 0, 1, 0, 60, null, 
        '{"compiler": 0}', 80, 0, 1.0, 
        '{"compiler":{"age":1,"progress":0}}', 
        ?
      )
    `).run(new Date().toISOString(), JSON.stringify(Array(24).fill(0)));
  })();
}

// Ensure database state exists on module load
initDB();
