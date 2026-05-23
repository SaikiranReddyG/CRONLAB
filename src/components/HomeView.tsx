import React, { useState } from "react";
import { Play, Pause, Flame, Target, Compass, Sparkles, Activity, CheckSquare, Square, ChevronRight, Loader2 } from "lucide-react";
import { CronlabState, Project } from "../types";

interface HomeViewProps {
  state: CronlabState;
  onSelectProjectTab: (id: string) => void;
  onToggleChecklist: (projectId: string, itemId: string, done: boolean) => Promise<void>;
  onToggleSessionState: (action: "pause" | "resume") => Promise<void>;
  onStateReset: () => Promise<void>;
  onRespondPing: () => Promise<void>;
}

export default function HomeView({
  state,
  onSelectProjectTab,
  onToggleChecklist,
  onToggleSessionState,
  onStateReset,
  onRespondPing,
}: HomeViewProps) {
  const { projects, activeSession, metrics } = state;
  const [togglingIds, setTogglingIds] = useState<string[]>([]);

  const handleToggle = async (projId: string, itemId: string, done: boolean) => {
    if (togglingIds.includes(itemId)) return;
    setTogglingIds(prev => [...prev, itemId]);
    try {
      await onToggleChecklist(projId, itemId, done);
    } finally {
      setTogglingIds(prev => prev.filter(id => id !== itemId));
    }
  };

  // Resolve active project objects
  const activeProj = projects.find((p) => p.id === activeSession.project) || projects[0];

  // Cooling effect helper (returns opacity class if project hasn't been touched in >= 3 days)
  const getProjectCoolingClass = (lastTouchedStr: string) => {
    try {
      const now = new Date(); // Use new Date() dynamically
      const touchedDate = new Date(lastTouchedStr);
      const diffMs = now.getTime() - touchedDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 3) {
        return "opacity-40 hover:opacity-100 transition-opacity duration-300 border-dashed border-red-500/20";
      }
    } catch (e) {
      console.error(e);
    }
    return "opacity-100 border-solid border-[#1a1a1a]";
  };

  // Convert seconds to readable elapsed state
  const formatTime = (secCount: number) => {
    const hrs = Math.floor(secCount / 3600);
    const mins = Math.floor((secCount % 3600) / 60);
    const secs = secCount % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Resolve project specific mood colors
  const moodColors: Record<string, string> = {
    flow: "bg-emerald-400 text-emerald-950 border-emerald-500",
    calm: "bg-teal-400 text-teal-950 border-teal-500",
    stuck: "bg-amber-500 text-amber-950 border-amber-600 animate-pulse",
    tired: "bg-red-400 text-red-950 border-red-500",
    none: "bg-gray-500 text-gray-250 border-gray-600",
  };

  // Fetch morning brief >next intentions from the last session's logs only
  const latestLogWithSession = state.logs.find(l => l.sessionStart);
  const latestSessionStart = latestLogWithSession ? latestLogWithSession.sessionStart : null;

  const lastSessionLogs = latestSessionStart
    ? state.logs.filter(l => l.sessionStart === latestSessionStart)
    : state.logs.slice(0, 5); // Fallback to last 5 logs if no session started yet

  const recentIntentions = lastSessionLogs
    .flatMap((l) => l.intentions || [])
    .filter((v, i, self) => self.indexOf(v) === i)
    .slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0a0a0a] select-none" id="cronlab-home-tab">
      
      {/* Composed Top Section: Zone 1 & Zone 2 split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Zone 1 — Active Session (glowing cockpit console) */}
        <div 
          className={`lg:col-span-3 bg-[#111111] border p-5 flex flex-col justify-between relative overflow-hidden rounded-none ${
            activeSession.isPaused ? "border-[#1a1a1a]" : "border-[#f0a500] shadow-[0_0_12px_rgba(240,165,0,0.06)]"
          }`}
          id="home-active-session"
        >
          {/* Subtle diagnostic grids in bg */}
          <div className="absolute inset-0 bg-[radial-gradient(#f0a50003_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-amber opacity-20"></div>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-brand-amber animate-pulse">●</span>
                <span className="text-[10px] text-brand-amber tracking-widest font-bold uppercase">
                  ACTIVE FOCUS LOOP TRACKER
                </span>
              </div>
              <h2 className="text-xl font-sans font-extrabold text-brand-text mt-1 select-text tracking-tight uppercase">
                {activeProj ? activeProj.name : "N/A"}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {activeSession.isPaused ? (
                <button
                  onClick={() => onToggleSessionState("resume")}
                  className="px-3 py-1 bg-[#111111] hover:bg-brand-green/20 text-brand-green border border-[#1a1a1a] hover:border-brand-green/30 text-[10px] font-mono font-bold rounded-none flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>RESUME WORK</span>
                </button>
              ) : (
                <button
                  onClick={() => onToggleSessionState("pause")}
                  className="px-3 py-1 bg-[#111111] hover:bg-red-500/10 text-red-400 border border-[#1a1a1a] hover:border-red-500/20 text-[10px] font-mono font-bold rounded-none flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Pause className="w-3 h-3 fill-current" />
                  <span>PAUSE TICKER</span>
                </button>
              )}
            </div>
          </div>

          <div className="my-5 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-mono font-extrabold text-brand-text tracking-tight tabular-nums select-text">
              {formatTime(activeSession.elapsedSeconds)}
            </span>
            <span className="font-mono text-xs text-white/30 lowercase">elapsed</span>
          </div>

          {/* Countdown & warning banner alerts */}
          <div className="space-y-3.5 border-t border-[#1a1a1a] pt-4">
            <div className="flex justify-between items-center text-[10px] font-mono text-white/40" id="diagnostic-header">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-brand-amber/60" />
                <span>HEARTBEAT DIAGNOSTIC SIGNAL (PING COUNTDOWN)</span>
              </span>
              <span className="text-brand-amber font-bold">T-MINUS {activeSession.nextPingIn}S</span>
            </div>

            {/* Simulated Countdown Progress bar */}
            <div className="w-full bg-[#1a1a1a] h-1 rounded-none overflow-hidden">
              <div 
                className="h-full bg-brand-amber transition-all duration-1000"
                style={{ width: `${(activeSession.nextPingIn / 60) * 100}%` }}
              ></div>
            </div>

            {activeSession.isPaused && (
              <div className="bg-[#111111] border border-orange-500/20 px-3 py-2 text-[10px] font-mono text-orange-400 flex items-center justify-between rounded-none">
                <span className="flex items-center gap-1.5 font-bold">
                  <Flame className="w-3.5 h-3.5 animate-bounce" />
                  <span>ALERT: TRACKER IDLE — {activeSession.missedPings} PINGS REPORTED AS UNANSWERED</span>
                </span>
                <span className="text-[9px] text-white/40">DRIFT DETECTED</span>
              </div>
            )}

            {!activeSession.isPaused && activeSession.missedPings === 0 && (
              <div className="bg-[#111111] border border-[#4a7c59]/20 px-3 py-2 text-[10px] font-mono text-brand-green flex items-center gap-2 rounded-none">
                <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                <span>STATE CAPABILITY STABLE &mdash; PERSISTING DIRECT STREAM LOGS TO DISK</span>
              </div>
            )}

            {!activeSession.isPaused && activeSession.missedPings > 0 && (
              <div className="bg-[#1a130c] border border-amber-500/30 px-3 py-2 text-[10px] font-mono text-amber-400 flex items-center justify-between gap-2 rounded-none animate-pulse">
                <span className="flex items-center gap-1.5 font-bold">
                  <Flame className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span>ALERT SIGNAL: REACHABILITY CHECK &mdash; {activeSession.missedPings}/3 UNANSWERED PINGS</span>
                </span>
                <button
                  onClick={onRespondPing}
                  className="px-2 py-0.5 bg-brand-amber text-black text-[9px] font-mono font-extrabold rounded-none cursor-pointer hover:bg-white transition-colors"
                >
                  ACKNOWLEDGE
                </button>
              </div>
            )}

            {/* Last entered log line block */}
            <div className="bg-[#0a0a0a] p-3 rounded-none border border-[#1a1a1a] font-mono text-xs text-brand-text/80">
              <span className="text-white/40 text-[9px] uppercase tracking-widest block mb-1">Last structured signal entered:</span>
              <span className="italic select-text">“{activeSession.lastLogLine || "Await fresh log entry signal..."}”</span>
            </div>
          </div>
        </div>

        {/* Zone 2 — Morning Brief (smaller context console) */}
        <div className="lg:col-span-2 bg-[#111111] border border-[#1a1a1a] rounded-none p-5 flex flex-col justify-between" id="home-morning-brief">
          <div>
            <div className="flex items-center gap-2 border-b border-[#1a1a1a] pb-2.5">
              <span className="text-white/40 uppercase font-mono tracking-widest text-[10px]">
                TODAY'S INTENTION MAP (MORNING BRIEF)
              </span>
            </div>
            <p className="text-[10px] font-mono text-white/30 mt-3 italic">
              Compiled from your latest daily log lines containing the &gt;next prefix:
            </p>
          </div>

          <div className="my-4 space-y-2 flex-grow">
            {recentIntentions.length > 0 ? (
              recentIntentions.map((int, i) => (
                <div 
                  key={i}
                  className="bg-[#0a0a0a] border border-[#1a1a1a] px-3 py-2 rounded-none font-mono text-xs flex items-center gap-2 text-brand-text/80 hover:border-brand-amber/20 transition-colors"
                >
                  <span className="text-brand-amber font-mono font-bold">&gt;next</span>
                  <span className="select-text">{int}</span>
                </div>
              ))
            ) : (
              <div className="h-28 flex flex-col items-center justify-center text-center text-white/20 border border-dashed border-[#1a1a1a] rounded-none p-4 font-mono">
                <Target className="w-5 h-5 mb-1 opacity-50" />
                <span className="text-[10px]">No active goals flagged yet.</span>
                <span className="text-[9px] mt-0.5 opacity-50">Log items using &gt;next syntax to populate.</span>
              </div>
            )}
          </div>

          <div className="border-t border-[#1a1a1a] pt-3 flex items-center justify-between text-[10px] font-mono text-white/35">
            <span>VELOCITY RATIO COMPILATION: GREEN</span>
            <button 
              onClick={onStateReset}
              className="text-[9px] text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 bg-[#0a0a0a] px-2 py-0.5 rounded-none tracking-normal cursor-pointer font-mono transition-all"
            >
              RESET HISTORY DATA
            </button>
          </div>
        </div>
      </div>

      {/* Zone 3 — Project Pulse (horizontal ribbon width scroll) */}
      <div id="home-project-pulse" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-brand-amber/54" />
            <span>PROJECT VELOCITY PULSE &mdash; INTERACTION DECK</span>
          </span>
          <span className="text-[9px] font-mono text-brand-amber/60 italic">Cards inactive for 3+ days will automatically cool down inside the deck</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {projects.map((proj) => {
            const isSelected = activeSession.project === proj.id;
            const coolingClass = getProjectCoolingClass(proj.lastTouched);
            const relativeDate = new Date(proj.lastTouched).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return (
              <div
                key={proj.id}
                onClick={() => onSelectProjectTab(proj.id)}
                className={`bg-[#111111] p-4 border relative overflow-hidden flex flex-col justify-between cursor-pointer group hover:bg-[#151515] transition-all duration-200 rounded-none ${
                  isSelected ? "border-[#f0a500] bg-brand-amber/5 shadow-sm" : "border-[#1a1a1a] " + coolingClass
                }`}
              >
                {/* Mood Tag mini corner block */}
                <div className={`absolute top-0 right-0 px-2 py-0.5 text-[8px] font-mono flex items-center gap-1 tracking-wider uppercase border-l border-b border-[#1a1a1a] rounded-none ${moodColors[proj.mood] || moodColors.none}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0"></span>
                  <span>{proj.mood !== "none" ? proj.mood : "stable"}</span>
                </div>

                <div>
                  <span className="font-mono text-[9px] text-white/40 block">#{proj.tag}</span>
                  <h3 className="text-sm font-bold text-white group-hover:text-brand-amber transition-colors mt-0.5 truncate select-text">
                    {proj.name}
                  </h3>
                </div>

                <div className="my-4">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-brand-amber font-mono font-bold text-lg select-text">{proj.percentDone}%</span>
                    <span className="font-mono text-[9px] text-white/30 uppercase">CHECKLIST COMPLETE</span>
                  </div>
                  {/* Micro task meter */}
                  <div className="w-full h-1 bg-[#1a1a1a] rounded-none overflow-hidden">
                    <div 
                      className="h-full bg-brand-amber rounded-none"
                      style={{ width: `${proj.percentDone}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-2.5 font-mono text-[9px]">
                  <div className="flex items-center gap-1 text-white/40 text-left">
                    <span>TOUCH:</span>
                    <span className="text-white/80 tabular-nums">{relativeDate}</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-brand-amber">
                    <span>{proj.velocity === "up" ? "▲" : proj.velocity === "down" ? "▼" : "■"}</span>
                    <span className="text-[8px] uppercase font-bold">{proj.velocity}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Composed Bottom Section: Zone 4 & Zone 5 split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Zone 4 — Checklist Progress */}
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-none p-5 flex flex-col justify-between" id="home-checklist">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-white/40 tracking-wider">
                ACTIVE CHECKLIST DEPLOYMENT ({activeProj ? activeProj.name : "N/A"})
              </span>
              <span className="font-mono text-[10px] bg-[#0a0a0a] border border-[#1a1a1a] text-brand-amber px-2 py-0.5 rounded-none font-bold">
                {activeProj ? activeProj.checklist.filter(c => c.done).length : 0} / {activeProj ? activeProj.checklist.length : 0} STEPS
              </span>
            </div>
            
            {/* Custom static checklist level indicator */}
            <div className="w-full bg-[#1a1a1a] h-1 rounded-none mt-2.5 overflow-hidden">
              <div 
                className="h-full bg-brand-amber rounded-none"
                style={{ width: activeProj ? `${activeProj.percentDone}%` : "0%" }}
              ></div>
            </div>
          </div>

          <div className="my-5 space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {activeProj && activeProj.checklist.length > 0 ? (
              activeProj.checklist.map((item) => {
                const isToggling = togglingIds.includes(item.id);
                return (
                  <div 
                    key={item.id}
                    onClick={() => !isToggling && handleToggle(activeProj.id, item.id, !item.done)}
                    className={`flex items-center gap-3 px-3 py-2 bg-[#0a0a0a] hover:bg-[#151515] border border-[#1a1a1a] hover:border-brand-amber/25 rounded-none transition-all ${
                      item.done ? "opacity-45" : "opacity-100"
                    } ${isToggling ? "opacity-30 pointer-events-none select-none" : "cursor-pointer"}`}
                  >
                    <button className="text-brand-amber shrink-0 cursor-pointer" disabled={isToggling}>
                      {isToggling ? (
                        <Loader2 className="w-4 h-4 animate-spin text-brand-amber" />
                      ) : item.done ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4 text-white/30" />
                      )}
                    </button>
                    <span className={`font-mono text-xs select-text ${item.done ? "line-through text-white/40" : "text-brand-text"}`}>
                      {item.text}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-white/20 font-mono text-xs border border-dashed border-[#1a1a1a] rounded-none">
                No checkpoints loaded. Use inputs to build steps!
              </div>
            )}
          </div>

          <div className="border-t border-[#1a1a1a] pt-3.5 flex items-center justify-between text-[10px] font-mono text-brand-amber/60">
            <span>CHECKING TILES PERFORMS ATOMIC STATE REWRITE</span>
            <button className="flex items-center gap-0.5 hover:text-brand-amber text-white/40 transition-colors cursor-pointer" onClick={() => onSelectProjectTab(activeProj?.id || "compiler")}>
              <span>EXPAND WORKSPACE VIEW</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Zone 5 — Metrics Panel */}
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-none p-5 flex flex-col justify-between" id="home-analytics">
          <div>
            <span className="font-mono text-[10px] text-white/40 tracking-wider block">
              REAL-TIME PROCESS METRICS ENGINE — DIAGNOSTICS DECK
            </span>
            <div className="border-b border-[#1a1a1a] pb-2 mt-1"></div>
          </div>

          {/* Metrics grids block */}
          <div className="grid grid-cols-2 gap-4 my-4 font-mono">
            {/* Column Left: Live numbers */}
            <div className="space-y-4">
              <div className="bg-[#0a0a0a] p-3 rounded-none border border-[#1a1a1a]">
                <span className="text-[9px] text-white/40 uppercase">Focus Depth Score</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl font-bold text-white select-text">{metrics.focusDepth}%</span>
                  <span className="text-[8px] text-brand-green">STABLE</span>
                </div>
                <div className="w-full h-1 bg-[#1a1a1a] rounded-none mt-2.5 overflow-hidden">
                  <div className="h-full bg-brand-green rounded-none" style={{ width: `${metrics.focusDepth}%` }}></div>
                </div>
              </div>

              <div className="bg-[#0a0a0a] p-3 rounded-none border border-[#1a1a1a]">
                <span className="text-[9px] text-white/40 uppercase">Topic Entropy Rate</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl font-bold text-brand-amber select-text">{metrics.topicEntropy || "2.1"} H(X)</span>
                  <span className="text-[8px] text-brand-amber font-bold">HIGH FOCUS</span>
                </div>
                <p className="text-[8px] text-white/30 mt-1 lines-clamp-1">Dispersion index across workspaces</p>
              </div>
            </div>

            {/* Column Right: Live distribution */}
            <div className="space-y-4">
              <div className="bg-[#0a0a0a] p-3 rounded-none border border-[#1a1a1a]">
                <span className="text-[9px] text-white/40 uppercase">Dead Idle Time Counts</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl font-bold text-orange-400 select-text">{metrics.deadTimeCount || "0"}</span>
                  <span className="text-[8px] text-orange-400 font-bold">MISSED PINGS</span>
                </div>
                <p className="text-[8px] text-white/30 mt-1">Time drifting outside intent window</p>
              </div>

              <div className="bg-[#0a0a0a] px-3 py-2.5 rounded-none border border-[#1a1a1a] space-y-2">
                <span className="text-[9px] text-white/40 uppercase block">TODAY WORK DISTRIBUTION</span>
                {projects.slice(0, 3).map((p) => {
                  const minutes = metrics.todayFocus[p.id] || 0;
                  const totalFocus = Object.values(metrics.todayFocus).reduce((a, b) => a + b, 0) || 1;
                  const pct = Math.min(100, Math.round((minutes / totalFocus) * 100));
                  return (
                    <div key={p.id} className="space-y-1">
                      <div className="flex justify-between text-[8px] text-white/50 font-mono">
                        <span className="truncate max-w-[80px]">#{p.tag}</span>
                        <span>{minutes}M ({pct}%)</span>
                      </div>
                      <div className="w-full h-0.5 bg-[#1a1a1a]">
                        <div className="h-full bg-brand-amber/70" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Energy Curve - Sparkline graphs */}
          <div className="border-t border-[#1a1a1a] pt-4 space-y-1.5">
            <div className="flex justify-between items-center text-[9px] font-mono text-white/40">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-brand-amber/54" />
                <span>ACTIVE ENERGY CURVE TODAY (PING DYNAMICS BY HOUR)</span>
              </span>
              <span className="bg-brand-amber/15 text-brand-amber border border-brand-amber/20 px-1.5 py-0.5 text-[8px] font-bold rounded-none">LIVE STREAM</span>
            </div>

            {/* Sparkline canvas graph built with small bars aligned horizontally */}
            <div className="bg-[#0a0a0a] p-2.5 rounded-none border border-[#1a1a1a] flex items-end justify-between h-14 w-full px-4 relative" id="sparkline-container">
              {metrics.sparkline && metrics.sparkline.map((val, idx) => {
                const totalVal = metrics.totalPings ? (metrics.totalPings[idx] || 0) : 0;
                
                const maxTotal = Math.max(...(metrics.totalPings || []), 1);
                const maxConfirmed = Math.max(...metrics.sparkline, 1);
                
                const totalHeightPct = (totalVal / maxTotal) * 90;
                const activeHeightPct = (val / maxConfirmed) * 90;
                
                const ratio = totalVal > 0 ? Math.round((val / totalVal) * 100) : 0;
                
                return (
                  <div 
                    key={idx} 
                    className="group relative h-full flex-grow mx-[1.5px] flex items-end justify-center"
                  >
                    {/* Underlying total pings (dim ambient presence) */}
                    <div 
                      className="w-full bg-white/5 rounded-none transition-all duration-300 absolute"
                      style={{ 
                        height: `${Math.max(5, totalHeightPct)}%`,
                        opacity: 0.25
                      }}
                    ></div>
                    {/* Confirmed pings (solid focus bar) */}
                    <div 
                      className={`w-full rounded-none transition-all duration-300 z-10 ${
                        idx === new Date().getHours() 
                          ? "bg-brand-amber animate-pulse" 
                          : ratio >= 75 ? "bg-brand-green/85 hover:bg-brand-green" 
                          : ratio > 0 ? "bg-brand-amber/60 hover:bg-brand-amber" : "bg-white/5"
                      }`}
                      style={{ 
                        height: `${Math.max(5, activeHeightPct)}%`
                      }}
                    ></div>
                    {/* Tooltip on hovering spark points */}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-[7px] text-brand-amber px-1.5 py-0.5 rounded-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-brand-amber/30 font-mono">
                      Hr {String(idx).padStart(2, '0')}: Confirmed {val}/{totalVal} ({ratio}%)
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[8px] font-mono text-white/20 px-1">
              <span>00:00 UTC</span>
              <span>12:00 MID</span>
              <span>23:59 UTC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
