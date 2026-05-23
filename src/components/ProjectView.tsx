import React, { useState } from "react";
import { ListTodo, Terminal, Clock, Eye, Activity, Plus, Play, Pause, AlertTriangle, CheckSquare, Square } from "lucide-react";
import { Project, LogEntry, ActiveSession } from "../types";

interface ProjectViewProps {
  project: Project;
  logs: LogEntry[];
  activeSession: ActiveSession;
  onToggleChecklist: (projectId: string, itemId: string, done: boolean) => Promise<void>;
  onToggleSessionState: (action: "pause" | "resume") => Promise<void>;
  onSwitchProject: (id: string) => Promise<void>;
  onLogLine: (line: string) => Promise<void>;
  onAddChecklistItem: (projectId: string, text: string) => Promise<void>;
}

export default function ProjectView({
  project,
  logs,
  activeSession,
  onToggleChecklist,
  onToggleSessionState,
  onSwitchProject,
  onLogLine,
  onAddChecklistItem,
}: ProjectViewProps) {
  const [newStepText, setNewStepText] = useState("");
  const isCurrentlyActive = activeSession.project === project.id;

  // Filter logs for this specific project
  const projectLogs = logs.filter((log) => log.project === project.id);

  const moodColors: Record<string, string> = {
    flow: "bg-emerald-400 text-emerald-900 border-emerald-500",
    calm: "bg-teal-400 text-teal-900 border-teal-500",
    stuck: "bg-amber-400 text-amber-900 border-amber-500 animate-pulse",
    tired: "bg-red-400 text-red-900 border-red-500",
    none: "bg-gray-500 text-white border-gray-600",
  };

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-brand-green/20 text-brand-green border-brand-green/30",
    PAUSED: "bg-amber-500/10 text-brand-amber border-brand-amber/20",
    IDEA: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };

  // Helper to stylize the tags within the raw developer's log line
  const renderLogMessageWithPills = (text: string) => {
    const tokens = text.split(/\s+/);
    return tokens.map((token, idx) => {
      if (token.startsWith("#")) {
        return (
          <span key={idx} className="bg-brand-amber/15 text-brand-amber border border-brand-amber/25 px-1 rounded text-[10px] lowercase font-mono mx-0.5">
            {token}
          </span>
        );
      }
      if (token.startsWith("~")) {
        return (
          <span key={idx} className="bg-emerald-400/10 text-emerald-400 border border-emerald-500/20 px-1 rounded text-[10px] lowercase font-mono mx-0.5">
            {token}
          </span>
        );
      }
      if (token.startsWith(">") || token === "next") {
        return (
          <span key={idx} className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 px-1 rounded text-[10px] font-mono mx-0.5">
            {token}
          </span>
        );
      }
      if (token.startsWith("+")) {
        return (
          <span key={idx} className="bg-purple-500/15 text-purple-300 border border-purple-500/20 px-1 rounded text-[10px] font-mono mx-0.5">
            {token}
          </span>
        );
      }
      return <span key={idx} className="mr-1 inline-block select-text">{token}</span>;
    });
  };

  const handleAddStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepText || !newStepText.trim()) return;

    onAddChecklistItem(project.id, newStepText);
    setNewStepText("");
  };

  // Format ISO timestamps to clean ledger view values
  const formatTimestamp = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const seconds = String(d.getSeconds()).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    } catch {
      return "00:00:00";
    }
  };

  const formatFullDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "May 23";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0a0a0a] select-none text-brand-text" id={`project-tab-${project.id}`}>
      
      {/* 1. Rich Header and statistics banner */}
      <div className="bg-[#111111] border border-[#1a1a1a] p-5 rounded-none relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff01_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>

        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2.5 font-mono">
            <span className="text-xs text-brand-amber font-semibold">#{project.tag}</span>
            <span className={`px-2 py-0.5 rounded-none border text-[10px] font-bold ${statusColors[project.status] || "border-[#1a1a1a]"}`}>
              {project.status}
            </span>
            {isCurrentlyActive && (
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-amber opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-amber"></span>
              </span>
            )}
          </div>
          <h1 className="text-2xl font-sans font-extrabold text-[#ffffff] select-text">{project.name}</h1>
          <p className="font-mono text-[10px] text-white/30">
            LAUNCH RECORDED: {project.dateStarted} &bull; COMPOSITE AGE: {project.age}
          </p>
        </div>

        {/* Dynamic statistics blocks */}
        <div className="flex items-center gap-6 font-mono text-center shrink-0 z-10 bg-[#0a0a0a] p-4 border border-[#1a1a1a] rounded-none">
          <div className="space-y-0.5">
            <span className="text-[9px] text-white/40 block uppercase">Progress</span>
            <div className="text-lg font-bold text-brand-amber select-text">{project.percentDone}%</div>
          </div>
          <div className="h-6 w-px bg-[#1a1a1a]"></div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-white/40 block uppercase">Velocity</span>
            <div className="text-sm font-bold text-white flex items-center justify-center gap-1">
              <span>{project.velocity === "up" ? "▲" : project.velocity === "down" ? "▼" : "■"}</span>
              <span className="text-[10px] uppercase font-semibold">{project.velocity}</span>
            </div>
          </div>
          <div className="h-6 w-px bg-[#1a1a1a]"></div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-white/40 block uppercase">Active Mood</span>
            <div className={`px-2 py-0.5 text-[9px] font-bold border rounded-none uppercase ${moodColors[project.mood] || moodColors.none}`}>
              {project.mood !== "none" ? project.mood : "stable"}
            </div>
          </div>
          <div className="h-6 w-px bg-[#1a1a1a]"></div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-white/40 block uppercase">Session</span>
            {isCurrentlyActive ? (
              <span className="text-[10px] text-brand-green font-bold animate-pulse">RECORDING</span>
            ) : (
              <button 
                onClick={() => onSwitchProject(project.id)}
                className="text-[9px] text-brand-amber underline hover:text-white transition-colors block font-semibold cursor-pointer"
              >
                RESTORE RECORD
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Structured log input & loop check splits */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Side: interactive checklist steps (3 Cols) */}
        <div className="lg:col-span-3 bg-[#111111] border border-[#1a1a1a] rounded-none p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center text-[10px] font-mono text-white/40 border-b border-[#1a1a1a] pb-2.5">
              <span className="flex items-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5 text-brand-amber" />
                <span>INTERACTIVE WORK TRACK PROGRESS ({project.checklist.length} ITEMS DEPLOYED)</span>
              </span>
              <span className="text-brand-amber font-semibold">{project.percentDone}% DONE</span>
            </div>

            {/* Quick add step checklist input */}
            <form onSubmit={handleAddStepSubmit} className="flex gap-2">
              <input 
                type="text"
                placeholder="Declare new scope checkpoint step..."
                className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] focus:border-brand-amber/30 text-xs font-mono px-3 py-2 text-brand-text outline-none rounded-none"
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
              />
              <button 
                type="submit"
                disabled={!newStepText.trim()}
                className="px-3 bg-brand-amber/10 hover:bg-brand-amber/20 text-brand-amber border border-brand-amber/20 text-xs font-mono rounded-none flex items-center justify-center gap-1 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-bold"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">ADD</span>
              </button>
            </form>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {project.checklist.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => onToggleChecklist(project.id, item.id, !item.done)}
                  className={`flex items-start gap-3.5 px-3.5 py-2.5 bg-[#0a0a0a] hover:bg-[#151515] border border-[#1a1a1a] hover:border-brand-amber/25 rounded-none cursor-pointer transition-all ${
                    item.done ? "opacity-45" : "opacity-100"
                  }`}
                >
                  <button className="text-brand-amber shrink-0 mt-0.5 cursor-pointer">
                    {item.done ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4 text-white/30" />
                    )}
                  </button>
                  <span className={`font-mono text-xs select-text ${item.done ? "line-through text-white/40" : "text-brand-text"}`}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[9px] font-mono text-white/20 border-t border-[#1a1a1a] pt-3.5 mt-3">
            * Dynamic velocity rates update on checklist complete signals. Add &gt;next to logs to queue check targets automatically.
          </p>
        </div>

        {/* Right Side: Chronological log terminal feed (2 Cols) */}
        <div className="lg:col-span-2 bg-[#111111] border border-[#1a1a1a] rounded-none p-5 flex flex-col justify-between" id="project-terminal-logs">
          <div className="space-y-4">
            <div className="flex justify-between items-center text-[10px] font-mono text-white/40 border-b border-[#1a1a1a] pb-2.5">
              <span className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-brand-amber animate-pulse" />
                <span>DEV LEDGER LOG STREAMS</span>
              </span>
              <span className="text-white/30 underline uppercase select-all">#{project.tag}.log</span>
            </div>

            {/* Scrollable Feed Container */}
            <div className="space-y-3.5 max-h-[390px] overflow-y-auto pr-1">
              {projectLogs.length > 0 ? (
                projectLogs.map((log) => (
                  <div key={log.id} className="font-mono text-[11px] leading-relaxed border-b border-[#1a1a1a] pb-2">
                    <div className="flex items-center gap-1.5 text-white/30 text-[9px] mb-1">
                      <Clock className="w-3 h-3 text-brand-amber/54" />
                      <span className="font-bold text-white/40">{formatFullDate(log.timestamp)}</span>
                      <span>@</span>
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>
                    {/* Render message and translate tags to badges */}
                    <div className="text-brand-text/90 pl-3 border-l border-brand-amber/20">
                      {renderLogMessageWithPills(log.rawText)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center text-white/20 p-4 border border-dashed border-[#1a1a1a] rounded-none">
                  <Terminal className="w-5 h-5 mb-1.5 text-white/10" />
                  <span className="text-[10px] font-mono uppercase">FEED STATUS: EMPTY</span>
                  <span className="text-[9px] text-white/30 mt-1 pl-4 pr-4">
                    Enter any terminal command string targeting Hash #{project.tag} at bottom to stream entries.
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#1a1a1a] pt-3 mt-4 text-[9px] font-mono text-[#444444] flex items-center justify-between">
            <span>TERMINAL CONNECTION: SECURE</span>
            <span className="text-brand-amber flex items-center gap-1">
              <span className="w-1.2 h-1.2 bg-brand-amber rounded-full"></span>
              <span>COMPILATION: GREEN</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
