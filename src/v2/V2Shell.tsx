import React, { useState, useEffect } from "react";
import { FolderV2 } from "./types";
import Launcher from "./Launcher";
import FolderViewV2 from "./FolderViewV2";
import { 
  Folder, 
  FolderClosed, 
  FolderPlus, 
  Layout, 
  Home, 
  X, 
  Plus, 
  CheckCircle, 
  Settings, 
  Loader2,
  Clock,
  Play,
  Pause,
  Activity,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function V2Shell() {
  const [folders, setFolders] = useState<FolderV2[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderEndGoal, setNewFolderEndGoal] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Phase 6 Study Focus Sessions state
  const [activeSession, setActiveSession] = useState<{
    blockId: string;
    blockName: string;
    folderId: string;
    folderName: string;
    seconds: number;
    isPaused: boolean;
    logsWritten: number;
    tasksCompleted: number;
    foldersTouched: string[];
  } | null>(null);

  const [currentFocusedBlock, setCurrentFocusedBlock] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [finishedSessionSummary, setFinishedSessionSummary] = useState<{
    blockName: string;
    folderName: string;
    durationSeconds: number;
    logsWrittenCount: number;
    tasksCompletedCount: number;
    foldersTouchedNames: string[];
  } | null>(null);

  // Focus hour ticker
  useEffect(() => {
    let interval: any = null;
    if (activeSession && !activeSession.isPaused) {
      interval = setInterval(() => {
        setActiveSession((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            seconds: prev.seconds + 1,
          };
        });
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSession === null, activeSession?.isPaused]);

  const handleStartSession = (blockId: string, blockName: string, folderId: string, folderName: string) => {
    setActiveSession({
      blockId,
      blockName,
      folderId,
      folderName,
      seconds: 0,
      isPaused: false,
      logsWritten: 0,
      tasksCompleted: 0,
      foldersTouched: [folderName],
    });
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      const res = await fetch("/api/v2/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_id: activeSession.blockId,
          duration_seconds: activeSession.seconds,
        }),
      });

      if (!res.ok) {
        throw new Error("Unable to save focal metrics to databases.");
      }

      setFinishedSessionSummary({
        blockName: activeSession.blockName,
        folderName: activeSession.folderName,
        durationSeconds: activeSession.seconds,
        logsWrittenCount: activeSession.logsWritten,
        tasksCompletedCount: activeSession.tasksCompleted,
        foldersTouchedNames: Array.from(new Set(activeSession.foldersTouched)),
      });

      setActiveSession(null);
      await fetchFolders();
    } catch (err: any) {
      alert("Error saving study focus session: " + err.message);
    }
  };

  const handleTogglePause = () => {
    setActiveSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        isPaused: !prev.isPaused
      };
    });
  };

  const handleAbortSession = () => {
    setActiveSession(null);
  };

  const handleLogWritten = () => {
    if (activeSession) {
      const folderObj = folders.find(f => f.id === activeFolderId);
      const fName = folderObj?.name || "Workspace";
      setActiveSession(prev => {
        if (!prev) return null;
        const foldersTouched = prev.foldersTouched.includes(fName)
          ? prev.foldersTouched
          : [...prev.foldersTouched, fName];
        return {
          ...prev,
          logsWritten: prev.logsWritten + 1,
          foldersTouched
        };
      });
    }
  };

  const handleTaskCompleted = (isCompleted: boolean) => {
    if (activeSession && isCompleted) {
      const folderObj = folders.find(f => f.id === activeFolderId);
      const fName = folderObj?.name || "Workspace";
      setActiveSession(prev => {
        if (!prev) return null;
        const foldersTouched = prev.foldersTouched.includes(fName)
          ? prev.foldersTouched
          : [...prev.foldersTouched, fName];
        return {
          ...prev,
          tasksCompleted: prev.tasksCompleted + 1,
          foldersTouched
        };
      });
    }
  };

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v2/folders");
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setFolders(data);
        } catch (e) {
          console.error("Failed to parse folders JSON:", text);
        }
      }
    } catch (err) {
      console.error("[v2 Shell] Error fetching folders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !newFolderEndGoal.trim()) {
      setErrorMsg("Please fill out both the folder name and the core end goal.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const res = await fetch("/api/v2/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName.trim(),
          end_goal: newFolderEndGoal.trim(),
        }),
      });

      const responseText = await res.text();

      if (!res.ok) {
        let errMsg = "Failed to create folder";
        try {
          const errData = JSON.parse(responseText);
          errMsg = errData.error || errMsg;
        } catch (e) {
          if (responseText) {
            errMsg = responseText.slice(0, 150);
          }
        }
        throw new Error(errMsg);
      }

      let createdFolder;
      try {
        createdFolder = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(`Invalid response format from server: ${responseText.slice(0, 150) || "empty response"}`);
      }

      await fetchFolders();

      // Clean form inputs
      setNewFolderName("");
      setNewFolderEndGoal("");
      setIsModalOpen(false);

      // Instantly open the newly created folder
      if (createdFolder && createdFolder.id) {
        setActiveFolderId(createdFolder.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkFolderCompleted = async () => {
    if (!activeFolderId) return;
    if (!window.confirm("Are you sure you want to mark this workspace completed? It will move to the Completed archives.")) {
      return;
    }

    try {
      const res = await fetch(`/api/v2/folders/${activeFolderId}/complete`, {
        method: "PATCH",
      });

      if (res.ok) {
        await fetchFolders();
        setActiveFolderId(null); // Back to launcher
      } else {
        alert("Could not mark folder completed.");
      }
    } catch (err) {
      console.error("Error completing folder:", err);
    }
  };

  const activeFolders = folders.filter((f) => f.completed === 0);
  const completedFolders = folders.filter((f) => f.completed === 1);

  return (
    <div className="flex h-screen w-full bg-[#11151a] text-[#e8e8e8] font-sans overflow-hidden" id="v2-root-shell">
      
      {/* 1. Sidebar */}
      <aside className="w-64 bg-[#1a1f26] border-r border-[#2b3543]/20 flex flex-col shrink-0 select-none" id="v2-sidebar">
        
        {/* Brand Header */}
        <div className="h-16 border-b border-[#2b3543]/20 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layout className="text-[#9ee5d8]" size={18} />
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#e8e8e8] font-bold">
              CRONLAB <span className="text-[#9ee5d8]">V2</span>
            </span>
          </div>
          <span className="w-2 h-2 rounded-full bg-[#9ee5d8] animate-pulse"></span>
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          
          {/* Quick Home action */}
          <div>
            <button
              onClick={() => setActiveFolderId(null)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-mono uppercase tracking-wider rounded transition-all text-left font-bold ${
                activeFolderId === null
                  ? "bg-[#9ee5d8]/10 text-[#9ee5d8]"
                  : "text-[#8a9199] hover:text-white hover:bg-[#11151a]/40"
              }`}
            >
              <Home size={14} />
              Launcher Home
            </button>
          </div>

          {/* Active Workspaces List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 text-[10px] font-mono uppercase tracking-widest text-[#8a9199]/70">
              <span>Workspaces ({activeFolders.length})</span>
              <button
                onClick={() => setIsModalOpen(true)}
                className="hover:text-[#9ee5d8] p-0.5 transition-colors"
                title="Create a new workspace"
                id="sidebar-create-folder-btn"
              >
                <Plus size={12} />
              </button>
            </div>

            <div className="space-y-1">
              {loading ? (
                <div className="px-3 py-2 text-xs text-[#8a9199] font-mono">Loading...</div>
              ) : activeFolders.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[#8a9199]/40 italic font-mono">No active spaces</div>
              ) : (
                activeFolders.map((f) => {
                  const isSelected = activeFolderId === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setActiveFolderId(f.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-sans rounded transition-all text-left truncate ${
                        isSelected
                          ? "bg-[#9ee5d8]/10 text-white border-l-2 border-[#9ee5d8] pl-2.5 font-semibold"
                          : "text-[#8a9199] hover:text-[#e8e8e8] hover:bg-[#11151a]/30"
                      }`}
                    >
                      <Folder size={12} className={isSelected ? "text-[#9ee5d8]" : "text-[#8a9199]"} />
                      <span className="truncate">{f.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Completed Workspaces List */}
          {completedFolders.length > 0 && (
            <div className="space-y-2">
              <div className="px-3 text-[10px] font-mono uppercase tracking-widest text-[#8a9199]/50">
                Archived Done ({completedFolders.length})
              </div>
              <div className="space-y-1">
                {completedFolders.map((f) => {
                  const isSelected = activeFolderId === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setActiveFolderId(f.id)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-sans rounded transition-all text-left truncate italic ${
                        isSelected
                          ? "bg-[#2b3543]/20 text-[#8a9199] border-l-2 border-[#8a9199]/50 pl-2.5"
                          : "text-[#8a9199]/60 hover:text-[#8a9199]"
                      }`}
                    >
                      <CheckCircle size={10} className="text-[#8a9199]/50 shrink-0" />
                      <span className="truncate line-through">{f.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Global actions at the bottom */}
        <div className="p-4 border-t border-[#2b3543]/20 space-y-2">
          
          {/* Core system status line */}
          <div className="px-3 text-[9px] font-mono text-[#8a9199]/40 flex items-center justify-between select-none">
            <span>CORE STATUS: ACTIVE</span>
            <span>V2.0.1</span>
          </div>
        </div>
      </aside>

      {/* 2. Right Workspace Section */}
      <section className="flex-1 flex flex-col overflow-hidden" id="v2-workspace-right-pane">
        
        {/* Workspace Top Header Bar */}
        <header className="h-16 bg-[#1a1f26] border-b border-[#2b3543]/20 px-8 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[#8a9199] uppercase tracking-widest select-none">
              Active Environment:
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 bg-[#9ee5d8]/10 text-[#9ee5d8] font-mono rounded uppercase tracking-wider">
              {activeFolderId ? "Focused Workspace" : "Global Systems Launcher"}
            </span>
          </div>

          {/* Unified Global Study Session Panel */}
          <div className="flex items-center gap-4">
            {activeSession ? (
              <div className="flex items-center bg-[#11151a] border border-[#2b3543]/40 rounded px-3 py-1.5 gap-4">
                <div className="flex items-center gap-2">
                  <Activity className="text-[#9ee5d8] animate-pulse" size={13} />
                  <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-[#9ee5d8]">
                    Focus:
                  </span>
                  <span className="text-xs font-bold text-white max-w-[120px] truncate">
                    {activeSession.blockName}
                  </span>
                </div>

                <div className="flex items-center gap-1 font-mono text-xs font-extrabold text-[#9ee5d8]">
                  {(() => {
                    const m = Math.floor(activeSession.seconds / 60).toString().padStart(2, "0");
                    const s = (activeSession.seconds % 60).toString().padStart(2, "0");
                    return `${m}:${s}`;
                  })()}
                </div>

                <div className="flex items-center gap-1.5 border-l border-[#2b3543]/30 pl-3">
                  <button
                    onClick={handleTogglePause}
                    className="p-1 hover:text-[#9ee5d8] text-[#8a9199] transition-colors cursor-pointer"
                    title={activeSession.isPaused ? "Resume Session" : "Pause Session"}
                  >
                    {activeSession.isPaused ? <Play size={12} /> : <Pause size={12} />}
                  </button>
                  <button
                    onClick={handleEndSession}
                    className="px-2 py-0.5 bg-[#9ee5d8] hover:bg-[#b5f0e5] text-[#11151a] font-mono font-bold text-[9px] uppercase tracking-wider rounded transition-all cursor-pointer"
                    title="Complete Focus wave"
                  >
                    End Session
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (currentFocusedBlock && activeFolderId) {
                    const activeFolder = folders.find(f => f.id === activeFolderId);
                    handleStartSession(currentFocusedBlock.id, currentFocusedBlock.name, activeFolderId, activeFolder?.name || "Workspace");
                  } else {
                    alert("Please select a workspace folder and select an active milestone block to start a focus session.");
                  }
                }}
                disabled={!activeFolderId || !currentFocusedBlock}
                className={`flex items-center gap-1.5 px-3 py-1.5 bg-[#9ee5d8]/10 hover:bg-[#9ee5d8] text-[#9ee5d8] hover:text-[#11151a] disabled:opacity-30 disabled:hover:bg-[#9ee5d8]/10 disabled:hover:text-[#9ee5d8] border border-[#9ee5d8]/30 hover:border-transparent rounded font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${
                  activeFolderId && currentFocusedBlock ? "cursor-pointer" : "cursor-not-allowed"
                }`}
                title={
                  !activeFolderId 
                    ? "Select an active folder to begin" 
                    : !currentFocusedBlock 
                    ? "Select a milestone block card to begin" 
                    : "Activate focus timer on selected block"
                }
              >
                <Clock size={11} className="animate-pulse" />
                Start Session
              </button>
            )}

            <div className="flex items-center gap-6 font-mono text-[10px] text-[#8a9199] border-l border-[#2b3543]/20 pl-4">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9ee5d8]"></span>
                <span>COMPILER ONLINE</span>
              </div>
              <span className="hidden lg:inline select-all text-[#8a9199]/60">DB: cronlab-v2.db</span>
            </div>
          </div>
        </header>

        {/* Dynamic Display Render */}
        <main className="flex-1 flex flex-col min-h-0 bg-[#11151a]">
          <AnimatePresence mode="wait">
            {activeFolderId ? (
              <motion.div
                key={`folder-${activeFolderId}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col min-h-0"
              >
                <FolderViewV2
                  folderId={activeFolderId}
                  onBackToLauncher={() => setActiveFolderId(null)}
                  onFolderCompleted={handleMarkFolderCompleted}
                  activeSession={activeSession}
                  onStartSession={handleStartSession}
                  onEndSession={handleEndSession}
                  onTogglePauseSession={handleTogglePause}
                  onAbortSession={handleAbortSession}
                  onLogWritten={handleLogWritten}
                  onTaskCompleted={handleTaskCompleted}
                  onActiveBlockChange={(blockId, blockName) => {
                    if (blockId && blockName) {
                      setCurrentFocusedBlock({ id: blockId, name: blockName });
                    } else {
                      setCurrentFocusedBlock(null);
                    }
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="launcher"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col min-h-0"
              >
                <Launcher
                  folders={folders}
                  onSelectFolder={(id) => setActiveFolderId(id)}
                  onOpenFolderModal={() => setIsModalOpen(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </section>

      {/* 3. New Folder Modal Dialog */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 font-sans" id="create-folder-modal-overlay">
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#1a1f26] border border-[#2b3543]/40 rounded-lg shadow-2xl p-6"
            >
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#2b3543]/15 pb-4 mb-4">
                <h3 className="font-sans text-base font-bold text-[#e6e6e6] tracking-tight">
                  Launch New Workspace Folder
                </h3>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setErrorMsg("");
                  }}
                  className="text-[#8a9199] hover:text-white p-1 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form container */}
              <form onSubmit={handleCreateFolder} className="space-y-4">
                
                {errorMsg && (
                  <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-300 text-xs rounded select-none">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-[#8a9199] uppercase tracking-wider font-bold block">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g. Compiler Redesign, Phase 1 Rebuild"
                    maxLength={50}
                    required
                    className="w-full bg-[#11151a] border border-[#2b3543]/40 focus:border-[#9ee5d8] text-sm text-[#e8e8e8] px-3 py-2 rounded outline-none font-sans placeholder-[#8a9199]/40 transition-colors"
                    id="new-folder-name-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-[#8a9199] uppercase tracking-wider font-bold block">
                    One-Line Ultimate End Goal
                  </label>
                  <input
                    type="text"
                    value={newFolderEndGoal}
                    onChange={(e) => setNewFolderEndGoal(e.target.value)}
                    placeholder="e.g. Deploy 7 robust compiled API routes in 48 hours"
                    maxLength={140}
                    required
                    className="w-full bg-[#11151a] border border-[#2b3543]/40 focus:border-[#9ee5d8] text-sm text-[#e8e8e8] px-3 py-2 rounded outline-none font-sans placeholder-[#8a9199]/40 transition-colors"
                    id="new-folder-goal-input"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2b3543]/15 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setErrorMsg("");
                    }}
                    className="px-4 py-2 bg-transparent hover:bg-[#2b3543]/20 border border-[#2b3543]/50 text-xs font-semibold rounded text-[#8a9199] hover:text-white transition-all uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[#9ee5d8] hover:bg-[#b5f0e5] disabled:bg-[#9ee5d8]/40 text-[#11151a] font-bold text-xs rounded transition-all uppercase tracking-wider"
                    id="new-folder-submit-btn"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Launching...
                      </>
                    ) : (
                      "Launch Workspace"
                    )}
                  </button>
                </div>

              </form>

            </motion.div>

          </div>
        )}
      </AnimatePresence>

      {/* Focus Session Summary Modal */}
      <AnimatePresence>
        {finishedSessionSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 font-sans" id="session-summary-modal-overlay">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-md bg-[#161a20] border-2 border-[#9ee5d8]/40 rounded-xl p-8 shadow-2xl relative overflow-hidden"
              id="v2-session-summary-dialog"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Sparkles size={120} className="text-[#9ee5d8]" />
              </div>

              <div className="text-center space-y-2 mb-6 animate-pulse-slow">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[#9ee5d8]/10 rounded-full border border-[#9ee5d8]/30 mb-2">
                  <Activity size={24} className="text-[#9ee5d8]" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Focus Wave Complete!
                </h3>
                <p className="text-xs text-[#8a9199]">
                  Excellent job targeting your milestone. Time was logged successfully.
                </p>
              </div>

              <div className="border-t border-b border-[#2b3543]/30 py-4 my-4 space-y-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[#8a9199]/70 block font-bold">
                    Focal Milestone Targeted
                  </span>
                  <span className="text-sm font-bold text-[#e6e6e6] block">
                    {finishedSessionSummary.blockName}
                  </span>
                  <span className="text-xs text-[#8a9199]/70 block">
                    Workspace Project: {finishedSessionSummary.folderName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[#1a1f26] border border-[#2b3543]/20 rounded-lg">
                    <span className="text-[8px] font-mono uppercase tracking-wider text-[#8a9199]/85 block font-bold">
                      FOCUSED DURATION
                    </span>
                    <span className="text-base font-extrabold font-mono text-[#9ee5d8] mt-0.5 block">
                      {Math.floor(finishedSessionSummary.durationSeconds / 60)}m {finishedSessionSummary.durationSeconds % 60}s
                    </span>
                  </div>

                  <div className="p-3 bg-[#1a1f26] border border-[#2b3543]/20 rounded-lg">
                    <span className="text-[8px] font-mono uppercase tracking-wider text-[#8a9199]/85 block font-bold">
                      LOG ENTRIES FILED
                    </span>
                    <span className="text-base font-extrabold font-mono text-[#9ee5d8] mt-0.5 block">
                      {finishedSessionSummary.logsWrittenCount} logs
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#8a9199]/80 px-1">
                    <span>Checklist Items Finished:</span>
                    <span className="font-mono font-bold text-white">
                      {finishedSessionSummary.tasksCompletedCount} items
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 text-xs text-[#8a9199]/80 border-t border-[#2b3543]/15 pt-2 px-1">
                    <span className="text-[9px] font-mono text-[#8a9199]/50 uppercase tracking-widest block font-bold">
                      Workspaces Touched during Wave:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {finishedSessionSummary.foldersTouchedNames.map((n, i) => (
                        <span key={i} className="px-2 py-0.5 bg-[#9ee5d8]/10 text-[#9ee5d8] font-mono text-[9px] rounded font-bold uppercase select-none">
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setFinishedSessionSummary(null)}
                  className="w-full py-3 bg-[#9ee5d8] hover:bg-[#b5f0e5] text-[#11151a] text-center text-xs font-bold font-mono tracking-widest uppercase rounded-lg transition-all cursor-pointer"
                  id="v2-summary-modal-dismiss-btn"
                >
                  Dismiss & Return
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
