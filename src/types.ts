export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  completedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  tag: string;
  status: "ACTIVE" | "PAUSED" | "IDEA";
  percentDone: number;
  lastTouched: string;
  velocity: "up" | "down" | "flat";
  mood: "flow" | "calm" | "stuck" | "tired" | "none";
  dateStarted: string;
  age: string;
  checklist: ChecklistItem[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  rawText: string;
  project: string;
  mood: "flow" | "calm" | "stuck" | "tired" | "none";
  intentions: string[];
  ideas: string[];
}

export interface ResurfacedIdea {
  id: string;
  timestamp: string;
  rawText: string;
  project: string;
  ageDays: number;
  status: "active" | "promoted" | "buried" | "later";
  deferredCount: number;
}

export interface ActiveSession {
  project: string; // project ID or tag
  startTime: string; // ISO string
  lastLogLine: string;
  elapsedSeconds: number;
  isPaused: boolean;
  missedPings: number;
  nextPingIn: number; // seconds countdown
  lastActive?: string;
}

export interface Metrics {
  todayFocus: Record<string, number>; // Project tag -> minutes
  focusDepth: number; // e.g. 84
  deadTimeCount: number; // miss counts or dead minutes
  topicEntropy: number; // e.g. 1.8
  projectAgeVsProgress: Record<string, { age: number; progress: number }>;
  sparkline: number[]; // Pings processed per hour (24 values)
}

export interface CronlabState {
  projects: Project[];
  logs: LogEntry[];
  resurfacedIdeas: ResurfacedIdea[];
  activeSession: ActiveSession;
  metrics: Metrics;
}
