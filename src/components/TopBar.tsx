import React, { useState, useEffect } from "react";
import { Clock, Terminal, Activity } from "lucide-react";
import { ActiveSession } from "../types";

interface TopBarProps {
  activeSession: ActiveSession;
  projectName: string;
}

export default function TopBar({ activeSession, projectName }: TopBarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format date-time nicely like a military or developer clock
  const formatTime = (d: Date) => {
    const hrs = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const secs = String(d.getSeconds()).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  const formatElapsed = (secCount: number) => {
    const hrs = Math.floor(secCount / 3600);
    const mins = Math.floor((secCount % 3600) / 60);
    const secs = secCount % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <header className="flex items-center justify-between px-6 py-2 border-b border-[#1a1a1a] bg-[#0a0a0a] text-[10px] tracking-widest opacity-85 select-none shrink-0" id="cronlab-header">
      {/* Wordmark */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Terminal className="w-3.5 h-3.5 text-brand-amber animate-pulse" />
          <span className="absolute -top-0.5 -right-0.5 flex h-1 w-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-amber opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1 w-1 bg-brand-amber"></span>
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 font-mono">
          <span className="font-bold text-brand-text text-xs hover:text-[#f0a500] transition-colors duration-200 uppercase">
            CRONLAB
          </span>
          <span className="text-[8px] text-brand-green bg-[#111] px-1.5 py-0.5 border border-[#1a1a1a] uppercase">
            v1.0.4
          </span>
        </div>
      </div>

      {/* Military Date + Clock Ticker */}
      <div className="flex items-center gap-6 text-brand-text opacity-90 font-mono text-[10px]">
        <div className="flex items-center gap-2 bg-[#111] px-3 py-1 border border-[#1a1a1a]">
          <Clock className="w-3 h-3 text-[#f0a500]/80" />
          <span className="opacity-40">{formatDate(time)}</span>
          <span className="opacity-40">/</span>
          <span className="text-[#f0a500] font-bold tabular-nums">
            {formatTime(time)}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-[#4a7c59]">●</span>
          <span className="opacity-50">LOCAL: ONLINE</span>
        </div>
      </div>

      {/* Active Session Status */}
      <div className="flex items-center gap-3">
        <div className="border border-[#1a1a1a] bg-[#111] px-3 py-1 flex items-center gap-2 font-mono text-[10px]">
          <Activity className="w-3 h-3 text-[#f0a500] animate-pulse" />
          <span className="opacity-40 uppercase">
            Focal Point:
          </span>
          <span className="font-bold text-[#f0a500] uppercase">
            {projectName || "N/A"}
          </span>
          <span className="opacity-25">|</span>
          <span className="font-bold text-brand-text tabular-nums">
            {activeSession.isPaused ? "PAUSED" : formatElapsed(activeSession.elapsedSeconds)}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${activeSession.isPaused ? 'bg-orange-500' : 'bg-brand-green animate-ping'}`}></span>
        </div>
      </div>
    </header>
  );
}
