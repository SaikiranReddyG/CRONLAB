import cron from "node-cron";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { getCompleteState } from "./db";

const backupDir = path.join(process.cwd(), "backups");

// Make sure backups directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Local backup: nightly copy of SQLite file to /backups/ folder, keep last 30
export function startScheduler() {
  console.log("[SCHEDULER] Initializing Cronlab Automated Daemon Services...");

  // Run at midnight every day
  cron.schedule("0 0 * * *", () => {
    console.log("[SCHEDULER] Midnight Backup & Export job triggered...");
    
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const dbFile = path.join(process.cwd(), "database.db");
      const backupFile = path.join(backupDir, `database-${todayStr}.db`);

      // Copy SQLite database
      if (fs.existsSync(dbFile)) {
        fs.copyFileSync(dbFile, backupFile);
        console.log(`[SCHEDULER] Local backup successfully wrote to ${backupFile}`);
      }

      // Keep only last 30 local SQLite backups
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith("database-") && f.endsWith(".db"))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time); // newest first

      if (files.length > 30) {
        const toDelete = files.slice(30);
        for (const file of toDelete) {
          fs.unlinkSync(path.join(backupDir, file.name));
          console.log(`[SCHEDULER] Cleaned up old local backup: ${file.name}`);
        }
      }

      // JSON Summary export at midnight
      const summaryFile = path.join(backupDir, `summary-${todayStr}.json`);
      const currentState = getCompleteState();
      fs.writeFileSync(summaryFile, JSON.stringify(currentState, null, 2), "utf-8");
      console.log(`[SCHEDULER] Nightly JSON summary successfully wrote to ${summaryFile}`);

      // Google Drive nightly export using rclone setup
      // Command: rclone copy /app/backups/ gdrive:cronlab-backups/
      exec(`rclone copy "${backupDir}" gdrive:cronlab-backups`, (err, stdout, stderr) => {
        if (err) {
          console.warn("[SCHEDULER] Google Drive nightly export (rclone copy) warning. Please ensure rclone is configured with remote 'gdrive':", err.message);
        } else {
          console.log("[SCHEDULER] Google Drive nightly export sync via rclone successfully executed:", stdout);
        }
      });

    } catch (err) {
      console.error("[SCHEDULER] Midnight backup or export operations process failed:", err);
    }
  });

  console.log("[SCHEDULER] Ticker Scheduler loaded: Local (30 rollover) + GDrive export scheduled at 00:00.");
}
