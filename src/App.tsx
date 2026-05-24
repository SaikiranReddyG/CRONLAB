import React, { useState, useEffect } from "react";
import { CronlabState, Project, ResurfacedIdea, ActiveSession } from "./types";
import TopBar from "./components/TopBar";
import BottomInput from "./components/BottomInput";
import HomeView from "./components/HomeView";
import ProjectView from "./components/ProjectView";
import ResurfaceView from "./components/ResurfaceView";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  const [state, setState] = useState<CronlabState | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0); // 0 = HOME, 1-5 = PROJECTS, 6 = RESURFACE
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "ws_online" | "polling_fallback">("connecting");

  // Local active session countdown and elapsed clock tick simulator between periodic backend state syncs
  useEffect(() => {
    if (!state) return;
    const session = state.activeSession;
    if (session.isPaused) return;

    const interval = setInterval(() => {
      setState((prev) => {
        if (!prev) return null;
        if (prev.activeSession.isPaused) return prev;
        
        const elapsed = prev.activeSession.elapsedSeconds + 1;
        let nextPing = prev.activeSession.nextPingIn;
        let missed = prev.activeSession.missedPings;
        let isAwaitingResponse = !!prev.activeSession.isAwaitingResponse;
        let awaitingRemaining = prev.activeSession.awaitingResponseRemaining ?? 0;
        let isPaused = prev.activeSession.isPaused;

        if (isAwaitingResponse) {
          if (awaitingRemaining > 1) {
            awaitingRemaining -= 1;
          } else {
            // Grace wait expired!
            isAwaitingResponse = false;
            awaitingRemaining = 0;
            missed += 1;
            nextPing = 60;
            if (missed >= 3) {
              isPaused = true;
            }
          }
        } else {
          if (nextPing > 1) {
            nextPing -= 1;
          } else {
            // Normal timer completed. Shift to awaiting response wait window
            nextPing = 0;
            isAwaitingResponse = true;
            awaitingRemaining = 15;
          }
        }
        
        return {
          ...prev,
          activeSession: {
            ...prev.activeSession,
            elapsedSeconds: elapsed,
            nextPingIn: nextPing,
            missedPings: missed,
            isAwaitingResponse,
            awaitingResponseRemaining: awaitingRemaining,
            isPaused: isPaused,
          }
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state?.activeSession?.isPaused, state?.activeSession?.isAwaitingResponse]);

  // Fetch initial state via HTTP REST API
  const fetchState = async () => {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data: CronlabState = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error("[REST] Failed to fetch state metrics:", err);
    }
  };

  useEffect(() => {
    fetchState();

    // Setup real-time communications channel (WebSockets)
    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const setupWSConnection = () => {
      try {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${proto}//${window.location.host}/ws`;
        
        console.log(`[WS] Connecting to host ${wsUrl}`);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[WS] Secure socket connection established.");
          setConnectionStatus("ws_online");
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "STATE_UPDATE" && data.state) {
              setState(data.state);
            }
          } catch (e) {
            console.error("[WS] Message parse error: ", e);
          }
        };

        ws.onclose = () => {
          console.warn("[WS] Socket disconnected. Reverting to persistent polling fallback.");
          setupPollingFallback();
        };

        ws.onerror = () => {
          console.error("[WS] Network connection error. Running polling sequence.");
          setupPollingFallback();
        };
      } catch (e) {
        console.error("[WS] Initial socket configuration failed:", e);
        setupPollingFallback();
      }
    };

    const setupPollingFallback = () => {
      if (connectionStatus === "polling_fallback" || pollInterval) return;
      setConnectionStatus("polling_fallback");
      console.log("[POLLING] Fallback listener activated. Syncing once per 1000ms.");
      pollInterval = setInterval(() => {
        fetchState();
      }, 1000);
    };

    setupWSConnection();

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Dynamic Keyboard listener for tab swaps (ctrl+1 to ctrl+7)
  useEffect(() => {
    const handleTabKeys = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key >= "1" && e.key <= "7") {
        e.preventDefault();
        const keyNum = parseInt(e.key, 10);
        if (keyNum === 1) {
          setActiveTabIndex(0);
          console.log("[KEYBOARD] Tab switched to HOME");
        } else if (keyNum === 7) {
          if (state) {
            const resurfaceIdx = state.projects.length + 1;
            setActiveTabIndex(resurfaceIdx);
            console.log(`[KEYBOARD] Tab switched to RESURFACE (index: ${resurfaceIdx})`);
          }
        } else {
          // Keys 2 to 6 map to project indices
          const targetIdx = keyNum - 1;
          if (state && targetIdx <= state.projects.length) {
            setActiveTabIndex(targetIdx);
            console.log(`[KEYBOARD] Tab switched to project index: ${targetIdx}`);
          }
        }
      }
    };
    window.addEventListener("keydown", handleTabKeys);
    return () => {
      window.removeEventListener("keydown", handleTabKeys);
    };
  }, [state?.projects?.length]);

  if (!state) {
    return (
      <div className="min-h-screen bg-[#0d0f0e] scanlines flex flex-col items-center justify-center font-mono text-xs select-none">
        <div className="space-y-4 text-center">
          <div className="w-8 h-8 border-2 border-brand-amber border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-brand-amber animate-pulse font-bold tracking-widest uppercase">
            LOADING CRONLAB SYSTEM CORE...
          </div>
          <p className="text-white/20 text-[9px]">LAUNCHING INTERNAL SQLITE METRIC VECTORS</p>
        </div>
      </div>
    );
  }

  const { projects, logs, resurfacedIdeas, activeSession } = state;
  const resurfaceTabIndex = projects.length + 1;

  // Swell active project tracking naming
  const activeProj = projects.find((p) => p.id === activeSession.project);
  const activeProjectLabel = activeProj ? activeProj.tag : "none";

  // State rewrite dispatch HTTP helper endpoints
  const handleLogLineSubmit = async (line: string) => {
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: line }),
      });
      if (res.ok) {
        const data = await res.json();
        // Instantly reload local fallback state parameters
        await fetchState();
      }
    } catch (err) {
      console.error("[API] Failed to parse and deploy log line:", err);
    }
  };

  const handleToggleChecklist = async (projectId: string, itemId: string, done: boolean) => {
    try {
      const res = await fetch("/api/checklist/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, itemId, done }),
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("[API] Failed to toggle checkpoint item status:", err);
    }
  };

  const handleToggleSessionState = async (action: "pause" | "resume") => {
    try {
      const res = await fetch("/api/session/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("[API] Failed to toggle focus ticking state:", err);
    }
  };

  const handleRespondPing = async () => {
    try {
      const res = await fetch("/api/session/ping/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("[API] Failed to respond to signal ping check:", err);
    }
  };

  const handleAddChecklistItem = async (projectId: string, text: string) => {
    try {
      const res = await fetch("/api/checklist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, text }),
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("[API] Failed to add checklist item directly:", err);
    }
  };

  const handleSwitchProject = async (projectId: string) => {
    try {
      const res = await fetch("/api/session/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch", project: projectId }),
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("[API] Failed to switch project focus:", err);
    }
  };

  const handleIdeaAction = async (ideaId: string, action: "PROMOTE" | "BURY" | "LATER") => {
    try {
      const res = await fetch("/api/ideas/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, action }),
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("[API] Failed to process resurfaced ideation target:", err);
    }
  };

  const handleStateReset = async () => {
    if (!window.confirm("CRITICAL WARNING: This compiles atomic wipe. Are you absolutely sure you want to initialize complete state reset?")) {
      return;
    }
    try {
      const res = await fetch("/api/state/reset", { method: "POST" });
      if (res.ok) {
        await fetchState();
        setActiveTabIndex(0);
      }
    } catch (err) {
      console.error("[API] State reset failure:", err);
    }
  };

  // Nav swappers from Home cards
  const handleNavToProjectTab = (projId: string) => {
    const idx = projects.findIndex((p) => p.id === projId);
    if (idx !== -1) {
      setActiveTabIndex(idx + 1); // offset index by 1 (Home index is 0)
    }
  };

  // Compose Tabs labels
  const tabHeaders = [
    "HOME",
    ...projects.map((p) => `#${p.tag}`),
    "RESURFACE",
  ];

  const renderMainContent = () => {
    if (activeTabIndex === 0) {
      return (
        <ErrorBoundary fallbackTitle="HOME DASHBOARD UNCHECKED LIFE-CYCLE DEGRADATION">
          <HomeView
            state={state}
            onSelectProjectTab={handleNavToProjectTab}
            onToggleChecklist={handleToggleChecklist}
            onToggleSessionState={handleToggleSessionState}
            onStateReset={handleStateReset}
            onRespondPing={handleRespondPing}
          />
        </ErrorBoundary>
      );
    }
    if (activeTabIndex >= 1 && activeTabIndex <= projects.length) {
      const selectedProj = projects[activeTabIndex - 1];
      if (selectedProj) {
        return (
          <ErrorBoundary fallbackTitle={`PROJECT WORK LEDGER DEGRADED (${selectedProj.tag.toUpperCase()})`}>
            <ProjectView
              project={selectedProj}
              logs={logs}
              activeSession={activeSession}
              onToggleChecklist={handleToggleChecklist}
              onToggleSessionState={handleToggleSessionState}
              onSwitchProject={handleSwitchProject}
              onLogLine={handleLogLineSubmit}
              onAddChecklistItem={handleAddChecklistItem}
            />
          </ErrorBoundary>
        );
      }
    }
    if (activeTabIndex === resurfaceTabIndex) {
      return (
        <ErrorBoundary fallbackTitle="RESURFACE MODULE RETRIEVAL BLOCKED">
          <ResurfaceView
            ideas={resurfacedIdeas}
            projects={projects}
            onIdeaAction={handleIdeaAction}
          />
        </ErrorBoundary>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0a0a] text-[#e8e6e0]" id="cronlab-app-container">
      {/* 1. System Header banner */}
      <TopBar 
        activeSession={activeSession} 
        projectName={activeProjectLabel} 
      />

      {/* 2. Micro tab bar layout */}
      <nav className="border-b border-[#1a1a1a] bg-[#0a0a0a] flex items-center h-10 shrink-0 font-mono select-none" id="cronlab-tab-bar">
        <div className="flex-1 flex h-full overflow-x-auto">
          {tabHeaders.map((tabLabel, idx) => {
            const isActive = idx === activeTabIndex;
            return (
              <button
                key={idx}
                onClick={() => setActiveTabIndex(idx)}
                className={`px-6 h-full flex items-center border-r border-[#1a1a1a] text-xs transition-all cursor-pointer uppercase whitespace-nowrap relative rounded-none ${
                  isActive
                    ? "border-b-2 border-b-brand-amber text-brand-amber bg-[#111111] font-bold"
                    : "text-white opacity-50 hover:opacity-100"
                }`}
              >
                {tabLabel}
                {/* Visual marker notification badge for the RESURFACE tab if active/later ideas are preloaded */}
                {tabLabel === "RESURFACE" && resurfacedIdeas.filter(f => f.status === "active" || f.status === "later").length > 0 && (
                  <span className="ml-1.5 px-1 py-[1px] bg-brand-amber/20 text-brand-amber text-[8px] border border-brand-amber/30 rounded-none font-bold">
                    {resurfacedIdeas.filter(f => f.status === "active" || f.status === "later").length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Real-time status lights indicators */}
        <div className="hidden sm:flex items-center gap-4 px-6 text-[10px] text-white/40 border-l border-[#1a1a1a] self-stretch h-full">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === "ws_online" ? "bg-brand-green animate-pulse" : "bg-brand-amber"}`}></span>
            <span className="uppercase text-[9px] font-mono leading-none">
              {connectionStatus === "connecting" ? "CONNECTING..." : connectionStatus === "ws_online" ? "WS: LIVE" : "POLL fallback"}
            </span>
          </div>
        </div>
      </nav>

      {/* 3. Main Body Scroll Tab Coordinates */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        {/* Floating Reachability Prompt Overlay */}
        {!activeSession.isPaused && activeSession.isAwaitingResponse && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
            <div className="bg-[#1c120c] border-2 border-brand-amber text-brand-amber p-4 shadow-[0_0_50px_rgba(230,172,0,0.2)] flex flex-col gap-3 font-mono ring-2 ring-black/50">
              <div className="flex items-center justify-between border-b border-brand-amber/20 pb-2">
                <span className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider animate-pulse">
                  <span className="inline-block w-2.5 h-2.5 bg-brand-amber rounded-full"></span>
                  <span>REACHABILITY PILOT CHECK</span>
                </span>
                <span className="text-[10px] text-brand-amber font-extrabold uppercase animate-pulse">
                  {activeSession.awaitingResponseRemaining ?? 15}S REMAINING
                </span>
              </div>
              <div className="text-xs text-[#e8e6e0]">
                Are you still actively focused on <span className="text-white font-bold">#{activeProjectLabel}</span>?
                <div className="mt-1 text-[10px] text-brand-amber/80">
                  Failing to respond in time will count as a task miss ({activeSession.missedPings}/3).
                </div>
              </div>
              <button
                onClick={handleRespondPing}
                type="button"
                className="w-full py-2 bg-brand-amber text-black hover:bg-white text-xs font-bold uppercase transition-colors cursor-pointer rounded-none tracking-widest font-mono font-extrabold"
              >
                I AM ACTIVE (ACK)
              </button>
            </div>
          </div>
        )}
        {renderMainContent()}
      </main>

      {/* 4. Console Bottom Bar Input */}
      <BottomInput 
        onLogLine={handleLogLineSubmit} 
        projects={projects} 
      />
    </div>
  );
}
