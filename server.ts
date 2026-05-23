import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { CronlabState, LogEntry, Project, ResurfacedIdea } from "./src/types";
import { getCompleteState, saveCompleteState } from "./db";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Initialize WebSockets
const wss = new WebSocketServer({ noServer: true });

// Connections list for real-time broadcasts
const activeSockets = new Set<WebSocket>();
let lastActiveTime = Date.now();

function updateLastActive() {
  lastActiveTime = Date.now();
}

wss.on("connection", (ws) => {
  activeSockets.add(ws);
  updateLastActive();
  console.log(`[WS] Client connected. Total sockets: ${activeSockets.size}`);

  ws.on("message", () => {
    updateLastActive();
  });

  ws.on("close", () => {
    activeSockets.delete(ws);
    updateLastActive();
    console.log(`[WS] Client disconnected. Total sockets: ${activeSockets.size}`);
  });
});

// Handle custom websocket upgrade path /ws to avoid conflict with Vite WS connection
server.on("upgrade", (request, socket, head) => {
  const url = request.url || "";
  if (url.startsWith("/ws")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

// Broadcast state updates helper
function broadcastStateUpdate(state: CronlabState) {
  const payload = JSON.stringify({ type: "STATE_UPDATE", state });
  for (const client of activeSockets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Initialize Gemini SDK if API key is present
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("[GEMINI] Core successfully initialized.");
  } catch (err) {
    console.error("[GEMINI] Initialization failed:", err);
  }
} else {
  console.log("[GEMINI] Key missing. Using regex fallback mode.");
}

// Database helper definitions
function readDB(): CronlabState {
  try {
    return getCompleteState();
  } catch (err) {
    console.error("Error reading SQLite database, return fallback:", err);
    return {
      projects: [],
      logs: [],
      resurfacedIdeas: [],
      activeSession: {
        project: "compiler",
        startTime: new Date().toISOString(),
        lastLogLine: "Welcome to Cronlab.",
        elapsedSeconds: 0,
        isPaused: true,
        missedPings: 0,
        nextPingIn: 60,
      },
      metrics: {
        todayFocus: {},
        focusDepth: 80,
        deadTimeCount: 0,
        topicEntropy: 1.5,
        projectAgeVsProgress: {},
        sparkline: Array(24).fill(0),
      },
    };
  }
}

function writeDB(state: CronlabState, broadcast = true) {
  try {
    saveCompleteState(state);
    if (broadcast) {
      broadcastStateUpdate(state);
    }
  } catch (err) {
    console.error("Error writing to SQLite database:", err);
  }
}

// Express middlewares
app.use(express.json());
app.use((req, res, next) => {
  updateLastActive();
  next();
});

// Heartbeat ticking system loop (simulates ticker awareness)
setInterval(() => {
  const state = readDB();
  const session = state.activeSession;
  const originalIsPaused = session.isPaused;
  const originalMissedPings = session.missedPings;
  
  if (!session.isPaused && session.project) {
    // Only increment elapsed duration if the client is actively connected or showing recent activity (gaps handling)
    const hasActiveClients = activeSockets.size > 0;
    const isRecentActivity = (Date.now() - lastActiveTime) < 15000;
    
    if (hasActiveClients || isRecentActivity) {
      session.elapsedSeconds += 1;
      session.lastActive = new Date().toISOString();
    }
    
    // Update local focus time metric (1 minute = 60s)
    if (session.elapsedSeconds % 60 === 0 && (hasActiveClients || isRecentActivity)) {
      if (!state.metrics.todayFocus) {
        state.metrics.todayFocus = {};
      }
      state.metrics.todayFocus[session.project] = (state.metrics.todayFocus[session.project] || 0) + 1;
      
      // Accumulate standard sparkline values in the current hour (2026 logs)
      const hour = new Date().getUTCHours();
      if (!state.metrics.sparkline) {
        state.metrics.sparkline = Array(24).fill(0);
      }
      state.metrics.sparkline[hour] = (state.metrics.sparkline[hour] || 0) + 1;
    }

    // Ping countdown happens when active/not paused (ticking state)
    if (session.nextPingIn > 1) {
      session.nextPingIn -= 1;
    } else {
      // Ping fires!
      session.missedPings += 1;
      session.nextPingIn = 60; // reset for the next interval
      
      if (session.missedPings >= 3) {
        session.isPaused = true; // Auto-pause after 3 missed responses
        state.metrics.deadTimeCount = (state.metrics.deadTimeCount || 0) + 1;
      }
    }
  }

  const shouldBroadcast = session.isPaused !== originalIsPaused || session.missedPings !== originalMissedPings;
  writeDB(state, shouldBroadcast);
}, 1000);

// Parser Fallback helper using RegExp
function fallbackRegexParse(rawText: string): {
  projectTag: string;
  mood: "flow" | "calm" | "stuck" | "tired" | "none";
  intentions: string[];
  ideas: string[];
  cleanText: string;
} {
  // 1. Project extraction (e.g. #compiler)
  const projectMatch = rawText.match(/#([\w-]+)/);
  const projectTag = projectMatch ? projectMatch[1] : "";

  // 2. Mood extraction (e.g. ~flow)
  const moodMatch = rawText.match(/~([\w-]+)/);
  let mood: "flow" | "calm" | "stuck" | "tired" | "none" = "none";
  const matchedMood = moodMatch ? moodMatch[1].toLowerCase() : "";
  if (["flow", "calm", "stuck", "tired"].includes(matchedMood)) {
    mood = matchedMood as any;
  }

  // 3. Intentions parsing: texts starting with '>'
  const intentions: string[] = [];
  const nextMatch = rawText.match(/>next\s+([^+~#\n]+)/) || rawText.match(/>\s*([^+~#\n]+)/);
  const matchedText = nextMatch ? nextMatch[1] : "";
  if (matchedText && matchedText.trim()) {
    intentions.push(matchedText.trim());
  }

  // 4. Ideas parsing: texts starting with '+' or '+idea'
  const ideas: string[] = [];
  const ideaMatch = rawText.match(/\+idea\s+([^+~#>\n]+)/) || rawText.match(/\+\s*([^+~#>\n]+)/);
  if (ideaMatch && ideaMatch[1] && ideaMatch[1].trim()) {
    ideas.push(ideaMatch[1].trim());
  } else if (rawText.includes("+idea") || rawText.includes("+")) {
    const rawCleaned = rawText
      .replace(/#([\w-]+)/g, "")
      .replace(/~([\w-]+)/g, "")
      .replace(/>next\s+([^+~#\n]+)/g, "")
      .replace(/>\s*([^+~#\n]+)/g, "");
    const possible = rawCleaned.split("+")[1];
    if (possible && possible.trim()) {
      ideas.push(possible.trim());
    }
  }

  // 5. Clean text of all syntaxes
  let cleanText = rawText
    .replace(/#([\w-]+)/g, "")
    .replace(/~([\w-]+)/g, "")
    .replace(/>next\s+[^\+~#\n]+/g, "")
    .replace(/>\s*[^\+~#\n]+/g, "")
    .replace(/\+idea\s+[^\+~#>\n]+/g, "")
    .replace(/\+\s*[^\+~#>\n]+/g, "")
    .replace(/\+idea/g, "")
    .replace(/\+/g, "")
    .replace(/>/g, "")
    .replace(/~/g, "")
    .trim();

  return { projectTag, mood, intentions, ideas, cleanText: cleanText || rawText };
}

// Call Gemini to structure raw logs
async function geminiParseLog(rawText: string, projectsList: Project[]) {
  if (!aiClient) return null;

  const projectsSummary = projectsList.map(p => `'${p.id}' (Tag matches: #${p.tag})`).join(", ");

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Parse the following raw developer work log line:\n"${rawText}"`,
      config: {
        systemInstruction: `You are the Cronlab AI core. Your task is to extract highly structured semantic objects from a developer's raw natural language sentence log.
Available project IDs: [${projectsSummary}].
If they mention words related to a project, match it to that project.
If a hashtag like #compiler or #kernel is in the text, extract it as the project ID without the '#'.
If none matches, you may output a reasonable new project ID string in lowercase.
Mood choices: 'flow', 'calm', 'stuck', 'tired', or 'none'. Extract based on ~flow or emotional sentiment of struggle/success.
Intentions are future milestones or actionable tasks defined by '>' or '>next' or future goals in the text.
Ideas are creative innovations, side brainstorms, or thoughts prefixed by '+' or '+idea'.
For 'cleanText', return the log line written in a clean, human-readable prose suitable for a terminal list, entirely stripping syntactic markers like '#compiler', '~flow', '>', '+idea', '+', '~' and excess spaces.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            project: {
              type: Type.STRING,
              description: "The matched project ID from availability list, or a lowercase slug if new.",
            },
            mood: {
              type: Type.STRING,
              description: "One of 'flow', 'calm', 'stuck', 'tired', or 'none'.",
            },
            intentions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Extracted future milestones or intentions.",
            },
            ideas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Extracted ideas or creative points.",
            },
            cleanText: {
              type: Type.STRING,
              description: "A beautifully polished log line prose clearing raw command modifiers.",
            },
          },
          required: ["project", "mood", "intentions", "ideas", "cleanText"],
        },
      },
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      console.log("[GEMINI] Structured analysis parsed successfully: ", parsed);
      return parsed;
    }
  } catch (error) {
    console.error("[GEMINI] Failed to parse using Gemini, reverting to regex:", error);
  }
  return null;
}

// 1. Get State
app.get("/api/state", (req, res) => {
  const state = readDB();
  res.json(state);
});

// 2. Clear / Reset Log History
app.post("/api/state/reset", (req, res) => {
  const state = readDB();
  
  // Clean logs and pings state
  state.logs = [];
  state.activeSession = {
    project: "compiler",
    startTime: new Date().toISOString(),
    lastLogLine: "Workspace initialized. Ready to record.",
    elapsedSeconds: 0,
    isPaused: true,
    missedPings: 0,
    nextPingIn: 60,
  };
  state.metrics = {
    todayFocus: { "compiler": 0 },
    focusDepth: 80,
    deadTimeCount: 0,
    topicEntropy: 1.0,
    projectAgeVsProgress: {
      "compiler": { "age": 43, "progress": 53 },
      "kernel": { "age": 83, "progress": 33 },
      "analytics": { "age": 22, "progress": 66 },
      "portfolio": { "age": 8, "progress": 20 },
      "ai-terminal": { "age": 18, "progress": 40 }
    },
    sparkline: Array(24).fill(0),
  };
  
  writeDB(state);
  res.json({ status: "success", state });
});

// 3. Log a Line
app.post("/api/log", async (req, res) => {
  const { rawText } = req.body;
  if (!rawText || !rawText.trim()) {
    return res.status(400).json({ error: "Empty log content" });
  }

  const state = readDB();
  
  // Core Parsing (Gemini with Regex fallback)
  let analysis = await geminiParseLog(rawText, state.projects);
  
  if (!analysis) {
    const rx = fallbackRegexParse(rawText);
    analysis = {
      project: rx.projectTag,
      mood: rx.mood,
      intentions: rx.intentions,
      ideas: rx.ideas,
      cleanText: rx.cleanText,
    };
  }

  // Match or create Project
  let projId = analysis.project ? analysis.project.toLowerCase().trim() : state.activeSession.project;
  // If tag hashtag doesn't map to project ID, resolve it
  let targetProject = state.projects.find((p) => p.id === projId || p.tag === projId);
  
  if (!targetProject && projId) {
    // Dynamically insert an elegant project card since Cronlab is a living productivity client OS!
    const newProj: Project = {
      id: projId,
      name: projId.toUpperCase() + " Workspace",
      tag: projId,
      status: "ACTIVE",
      percentDone: 0,
      lastTouched: new Date().toISOString(),
      velocity: "up",
      mood: analysis.mood !== "none" ? analysis.mood : "calm",
      dateStarted: new Date().toISOString().split("T")[0],
      age: "0 days",
      checklist: [
        { id: `chk-${projId}-1`, text: `Establish main components for #${projId}`, done: false },
        { id: `chk-${projId}-2`, text: `Draft scope goals`, done: false },
      ],
    };
    state.projects.push(newProj);
    targetProject = newProj;
  }

  if (targetProject) {
    targetProject.lastTouched = new Date().toISOString();
    if (analysis.mood !== "none") {
      targetProject.mood = analysis.mood;
    }
    // Update focus project active state
    state.activeSession.project = targetProject.id;
  }

  // Create Log Entry
  const newLog: LogEntry = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    rawText: rawText,
    project: targetProject ? targetProject.id : state.activeSession.project,
    mood: analysis.mood,
    intentions: analysis.intentions,
    ideas: analysis.ideas,
  };

  state.logs.unshift(newLog);

  // Update Active Session state
  state.activeSession.lastLogLine = analysis.cleanText || rawText;
  state.activeSession.isPaused = false; // Awake session on entering logs!
  state.activeSession.nextPingIn = 60; // reset ping block
  state.activeSession.missedPings = 0;
  state.metrics.deadTimeCount = 0;

  // Track ideas in Resurface
  if (analysis.ideas && analysis.ideas.length > 0) {
    analysis.ideas.forEach((ideaText: string, idx: number) => {
      const newIdea: ResurfacedIdea = {
        id: `idea-${Date.now()}-${idx}`,
        timestamp: new Date().toISOString(),
        rawText: `Concept brainstorm: ${ideaText} (+idea from log)`,
        project: targetProject ? targetProject.id : state.activeSession.project,
        ageDays: 0,
        status: "active",
        deferredCount: 0,
      };
      state.resurfacedIdeas.unshift(newIdea);
    });
  }

  // Time-weighted Entropy Score calculation (entropy of time-decayed project counts to give tech aesthetic)
  const projectWeights: Record<string, number> = {};
  let totalWeight = 0;
  
  const now = Date.now();
  state.logs.forEach((l) => {
    const logTime = new Date(l.timestamp).getTime();
    const ageHours = (now - logTime) / (1000 * 60 * 60);
    // Exponential decay: log 12 hours old has weight e^-1 ≈ 0.36
    const weight = Math.exp(-ageHours / 12);
    projectWeights[l.project] = (projectWeights[l.project] || 0) + weight;
    totalWeight += weight;
  });

  let entropy = 0;
  if (totalWeight > 0) {
    Object.values(projectWeights).forEach((w) => {
      const p = w / totalWeight;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    });
  }
  state.metrics.topicEntropy = Number((entropy || 1.2).toFixed(2));
  state.metrics.focusDepth = Math.max(20, Math.min(100, 100 - state.activeSession.missedPings * 12));

  writeDB(state);
  res.json({ success: true, log: newLog, analysis });
});

function calculateProjectVelocity(project: Project): "up" | "down" | "flat" {
  const now = Date.now();
  const fifteenMinutesMs = 15 * 60 * 1000;
  
  const completedTimestamps = project.checklist
    .filter((item) => item.done && item.completedAt)
    .map((item) => new Date(item.completedAt!).getTime());
    
  if (completedTimestamps.length === 0) {
    return "flat";
  }
  
  const recentCount = completedTimestamps.filter((t) => (now - t) <= fifteenMinutesMs).length;
  const previousCount = completedTimestamps.filter((t) => (now - t) > fifteenMinutesMs && (now - t) <= (2 * fifteenMinutesMs)).length;
  
  if (recentCount > previousCount) {
    return "up";
  } else if (recentCount < previousCount && previousCount > 0) {
    return "down";
  } else {
    return "flat";
  }
}

// 4.3 Add Checklist Item directly
app.post("/api/checklist/add", (req, res) => {
  const { projectId, text } = req.body;
  if (!projectId || !text || !text.trim()) {
    return res.status(400).json({ error: "Missing projectId or text" });
  }

  const state = readDB();
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const newItem = {
    id: `chk-${Date.now()}`,
    text: text.trim(),
    done: false,
  };

  project.checklist.push(newItem);

  // Recalculate percentDone
  const total = project.checklist.length;
  const completed = project.checklist.filter((c) => c.done).length;
  project.percentDone = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Update velocity indicators dynamically
  project.velocity = calculateProjectVelocity(project);

  writeDB(state);
  res.json({ success: true, project, item: newItem });
});

// 4. Update Checklist item
app.post("/api/checklist/toggle", (req, res) => {
  const { projectId, itemId, done } = req.body;
  const state = readDB();
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const item = project.checklist.find((i) => i.id === itemId);
  if (item) {
    item.done = done;
    if (done) {
      item.completedAt = new Date().toISOString();
    } else {
      delete item.completedAt;
    }
    
    // Recalculate percentDone
    const total = project.checklist.length;
    const completed = project.checklist.filter((c) => c.done).length;
    project.percentDone = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Update velocity indicators dynamically
    project.velocity = calculateProjectVelocity(project);
    
    writeDB(state);
    res.json({ success: true, project });
  } else {
    res.status(404).json({ error: "Checklist item not found" });
  }
});

// 5. Manage Active Session status
app.post("/api/session/state", (req, res) => {
  const { action, project } = req.body;
  const state = readDB();
  
  if (action === "pause") {
    state.activeSession.isPaused = true;
  } else if (action === "resume") {
    state.activeSession.isPaused = false;
    state.activeSession.startTime = new Date().toISOString();
    state.activeSession.missedPings = 0;
    state.metrics.deadTimeCount = 0;
    state.activeSession.nextPingIn = 60; // Reset ticker countdown
  } else if (action === "switch") {
    if (project) {
      state.activeSession.project = project;
      state.activeSession.isPaused = false;
      state.activeSession.startTime = new Date().toISOString();
      state.activeSession.elapsedSeconds = 0;
      state.activeSession.nextPingIn = 60;
    }
  }

  writeDB(state);
  res.json({ success: true, activeSession: state.activeSession });
});

// 5.5 Respond to Reachability Check Ping
app.post("/api/session/ping/respond", (req, res) => {
  const state = readDB();
  state.activeSession.missedPings = 0;
  state.activeSession.nextPingIn = 60;
  writeDB(state);
  res.json({ success: true, activeSession: state.activeSession });
});

// 6. Resurface Tab actions (PROMOTE, BURY, LATER)
app.post("/api/ideas/action", (req, res) => {
  const { ideaId, action } = req.body;
  const state = readDB();
  const idea = state.resurfacedIdeas.find((i) => i.id === ideaId);
  if (!idea) {
    return res.status(404).json({ error: "Idea not found" });
  }

  if (action === "PROMOTE") {
    idea.status = "promoted";
    // Append to corresponding project's checklist!
    const project = state.projects.find((p) => p.id === idea.project);
    if (project) {
      project.checklist.unshift({
        id: `chk-promoted-${Date.now()}`,
        text: `Implement: ${idea.rawText}`,
        done: false,
      });
      // Recalc percentDone
      const total = project.checklist.length;
      const completed = project.checklist.filter((c) => c.done).length;
      project.percentDone = total > 0 ? Math.round((completed / total) * 100) : 0;
    }
  } else if (action === "BURY") {
    idea.status = "buried";
  } else if (action === "LATER") {
    idea.deferredCount += 1;
    idea.status = "later";
  }

  writeDB(state);
  res.json({ success: true, item: idea });
});

// Serve frontend assets in production / dev middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[OK] Server running on http://localhost:${PORT}`);
  });
}

startServer();
