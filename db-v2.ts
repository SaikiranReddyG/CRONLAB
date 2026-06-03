import Database from "better-sqlite3";
import path from "path";
import { randomUUID } from "crypto";

const dbFile = path.join(process.cwd(), "cronlab-v2.db");
const db = new Database(dbFile);

// Enable WAL mode for high concurrency
db.pragma("journal_mode = WAL");

// Enable foreign key constraints
db.pragma("foreign_keys = ON");

// Initialize Schema Version Table
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`);

function getCurrentVersion(): number {
  try {
    const row = db.prepare("SELECT MAX(version) as ver FROM schema_version").get() as { ver: number | null };
    return row?.ver ?? 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Runs the schema migration if new or nested, and executes the
 * auto-scratchpad guarantee ensuring each folder possesses a scratchpad.
 */
export function initDB() {
  const currentVersion = getCurrentVersion();

  if (currentVersion < 1) {
    db.transaction(() => {
      // 1. Create table folders
      db.exec(`
        CREATE TABLE folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          end_goal TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          completed_at TEXT
        );
      `);

      // 2. Create table blocks
      db.exec(`
        CREATE TABLE blocks (
          id TEXT PRIMARY KEY,
          folder_id TEXT NOT NULL,
          name TEXT NOT NULL,
          goal TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          is_scratchpad INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
        );
      `);

      // 3. Create table tasks
      db.exec(`
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          block_id TEXT NOT NULL,
          text TEXT NOT NULL,
          done INTEGER NOT NULL DEFAULT 0,
          done_at TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
        );
      `);

      // 4. Create table logs
      db.exec(`
        CREATE TABLE logs (
          id TEXT PRIMARY KEY,
          folder_id TEXT NOT NULL,
          block_id TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
          FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
        );
      `);

      // Track schema version 1
      db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)").run(1, new Date().toISOString());
    })();

    console.log("[MIGRATION-V2] Schema Version 1 initialized successfully (cronlab-v2.db).");
  }

  // Auto-scratchpad guarantee:
  // For any folder that does not have an active scratchpad block, create one.
  try {
    const folders = db.prepare("SELECT id FROM folders").all() as { id: string }[];
    if (folders.length > 0) {
      db.transaction(() => {
        const checkScratchpad = db.prepare("SELECT COUNT(*) as count FROM blocks WHERE folder_id = ? AND is_scratchpad = 1");
        const insertScratchpad = db.prepare(`
          INSERT INTO blocks (id, folder_id, name, goal, position, is_scratchpad, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const folder of folders) {
          const row = checkScratchpad.get(folder.id) as { count: number };
          if (row.count === 0) {
            const scratchpadId = `scratch-${randomUUID()}`;
            const nowStr = new Date().toISOString();
            insertScratchpad.run(
              scratchpadId,
              folder.id,
              "Scratchpad",
              null,
              0,
              1,
              nowStr
            );
            console.log(`[SCRATCHPAD-GUARANTEE] Created auto scratchpad for folder: ${folder.id}`);
          }
        }
      })();
    }
  } catch (err) {
    console.error("[SCRATCHPAD-GUARANTEE] Error verifying/auto-seeding scratchpad blocks:", err);
  }
}

// Call initDB on startup/import
initDB();

export default db;
