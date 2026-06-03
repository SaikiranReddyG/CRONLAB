import React, { useEffect, useState, useRef } from "react";
import { FolderV2, BlockV2 } from "./types";
import { 
  ArrowLeft, 
  Target, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  PlusCircle, 
  MessageSquare, 
  ChevronsRight, 
  Sparkles, 
  Check, 
  Plus,
  Square,
  CheckSquare,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FolderViewV2Props {
  folderId: string;
  onBackToLauncher: () => void;
  onFolderCompleted: () => void;
  
  // Phase 6 Global Focus Session Sync
  activeSession: {
    blockId: string;
    blockName: string;
    folderId: string;
    folderName: string;
    seconds: number;
    isPaused: boolean;
    logsWritten: number;
    tasksCompleted: number;
    foldersTouched: string[];
  } | null;
  onStartSession: (blockId: string, blockName: string, folderId: string, folderName: string) => void;
  onEndSession: () => void;
  onTogglePauseSession: () => void;
  onAbortSession: () => void;
  onLogWritten: () => void;
  onTaskCompleted: (isDone: boolean) => void;
  onActiveBlockChange: (blockId: string | null, blockName: string | null) => void;
}

interface FullFolderDetails extends FolderV2 {
  blocks: BlockV2[];
}

export default function FolderViewV2({ 
  folderId, 
  onBackToLauncher, 
  onFolderCompleted,
  activeSession,
  onStartSession,
  onEndSession,
  onTogglePauseSession,
  onAbortSession,
  onLogWritten,
  onTaskCompleted,
  onActiveBlockChange
}: FolderViewV2Props) {
  const [folder, setFolder] = useState<FullFolderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Phase 4 & 5 States
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockGoal, setNewBlockGoal] = useState("");
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);

  // Phase 5 Task States
  const [taskInputTexts, setTaskInputTexts] = useState<Record<string, string>>({});

  // Bottom Input Log States
  const [logInputText, setLogInputText] = useState("");
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Phase 6 Focus Session Mappings derived from global activeSession:
  const isFocusSessionActive = activeSession !== null && activeSession.blockId === selectedBlockId;
  const sessionSeconds = activeSession ? activeSession.seconds : 0;
  const isSessionPaused = activeSession ? activeSession.isPaused : false;

  // Sync active block selection back to parents for global topbar status representation
  useEffect(() => {
    if (folder && selectedBlockId) {
      const blk = folder.blocks?.find(b => b.id === selectedBlockId);
      if (blk) {
        onActiveBlockChange(selectedBlockId, blk.name);
      } else {
        onActiveBlockChange(null, null);
      }
    } else {
      onActiveBlockChange(null, null);
    }
  }, [selectedBlockId, folder?.id]);

  // Toggle a Task done/undone
  const handleTaskToggle = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card selection/focus state changes
    try {
      const taskObj = folder?.blocks?.flatMap(b => b.tasks || []).find(t => t.id === taskId);
      const isMarkingDone = taskObj ? taskObj.done === 0 : false;

      const res = await fetch(`/api/v2/tasks/${taskId}/toggle`, {
        method: "PATCH",
      });
      if (res.ok) {
        await fetchFolderDetails(false);
        onTaskCompleted(isMarkingDone);
      } else {
        alert("Failed to toggle task status");
      }
    } catch (err) {
      console.error("Error toggling task:", err);
    }
  };

  // Add a Task to a specific block card
  const handleTaskSubmit = async (blockId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = taskInputTexts[blockId]?.trim();
    if (!text) return;

    try {
      const res = await fetch("/api/v2/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_id: blockId,
          text
        })
      });

      if (res.ok) {
        setTaskInputTexts(prev => ({ ...prev, [blockId]: "" }));
        await fetchFolderDetails(false);
      } else {
        alert("Failed to append task item");
      }
    } catch (err) {
      console.error("Error creating task:", err);
    }
  };

  const fetchFolderDetails = async (makeDefaultActive: boolean = false) => {
    try {
      if (makeDefaultActive) setLoading(true);
      setError(null);
      const res = await fetch(`/api/v2/folders/${folderId}`);
      if (!res.ok) {
        throw new Error("Unable to retrieve details for this workspace folder.");
      }
      const data = (await res.json()) as FullFolderDetails;
      setFolder(data);

      // Auto-set the active block to the scratchpad if none selected or if matching fresh load
      if (data.blocks && data.blocks.length > 0) {
        if (makeDefaultActive || !selectedBlockId || !data.blocks.some(b => b.id === selectedBlockId)) {
          const scratchpad = data.blocks.find(b => b.is_scratchpad === 1);
          if (scratchpad) {
            setSelectedBlockId(scratchpad.id);
          } else {
            setSelectedBlockId(data.blocks[0].id);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load details");
    } finally {
      if (makeDefaultActive) setLoading(false);
    }
  };

  // Re-fetch on folder change
  useEffect(() => {
    fetchFolderDetails(true);
  }, [folderId]);

  // Handle local storage draft autosave on type (debounced)
  useEffect(() => {
    if (!folderId || !selectedBlockId) return;

    // Load existing draft
    const draftKey = `cronlab_v2_draft_${folderId}_${selectedBlockId}`;
    const savedDraft = localStorage.getItem(draftKey);
    setLogInputText(savedDraft || "");

    // Focus input on selection change
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

  }, [folderId, selectedBlockId]);

  // Debounce saving text to local storage
  useEffect(() => {
    if (!folderId || !selectedBlockId) return;
    const draftKey = `cronlab_v2_draft_${folderId}_${selectedBlockId}`;

    const handler = setTimeout(() => {
      if (logInputText.trim() === "") {
        localStorage.removeItem(draftKey);
      } else {
        localStorage.setItem(draftKey, logInputText);
      }
    }, 400); // 400ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [logInputText, folderId, selectedBlockId]);

  // Submit log
  const handleLogSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!logInputText.trim() || !selectedBlockId) return;

    try {
      setIsSubmittingLog(true);
      const textToSubmit = logInputText.trim();

      const res = await fetch("/api/v2/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder_id: folderId,
          block_id: selectedBlockId,
          text: textToSubmit
        })
      });

      if (!res.ok) {
        throw new Error("Failed to post log entry");
      }

      // Success
      setLogInputText("");
      const draftKey = `cronlab_v2_draft_${folderId}_${selectedBlockId}`;
      localStorage.removeItem(draftKey);

      // Trigger the metric accumulator
      onLogWritten();

      // Reload silently (without full loader jitter) to display instantly
      await fetchFolderDetails(false);

      // Re-focus input
      inputRef.current?.focus();
    } catch (err) {
      console.error("Error creating log:", err);
      alert("Failed to submit log entry. Please try again.");
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Submit Block creation
  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockName.trim()) return;

    try {
      setIsSubmittingBlock(true);
      const res = await fetch("/api/v2/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder_id: folderId,
          name: newBlockName.trim(),
          goal: newBlockGoal.trim() || undefined
        })
      });

      if (!res.ok) {
        throw new Error("Could not create blocks.");
      }

      const createdBlock = await res.json();
      
      // Reset inputs & hide form
      setNewBlockName("");
      setNewBlockGoal("");
      setShowAddBlock(false);

      // Silent reload and active current block
      await fetchFolderDetails(false);
      setSelectedBlockId(createdBlock.id);

    } catch (err: any) {
      alert("Error adding block milestone: " + err.message);
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  // Recorders for session milestones duration spent
  const handleEndSession = async () => {
    onEndSession();
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#11151a] text-[#8a9199]">
        <RefreshCw className="animate-spin text-[#9ee5d8] mb-3" size={24} />
        <span className="font-mono text-xs uppercase tracking-widest">Hydrating Workspace Logs...</span>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#11151a] text-[#8a9199]">
        <AlertCircle className="text-red-400 mb-3" size={32} />
        <p className="text-sm font-semibold text-[#e8e8e8]">{error || "Workspace not found"}</p>
        <button
          onClick={onBackToLauncher}
          className="mt-4 px-4 py-2 bg-[#1a1f26] hover:bg-[#202730] text-[#e8e8e8] font-mono text-xs border border-[#2b3543]/40 rounded uppercase transition-colors"
        >
          Return to Launcher
        </button>
      </div>
    );
  }

  // Find the details of the currently selected/active block
  const activeBlockDetails = folder.blocks?.find(b => b.id === selectedBlockId);

  // Separate Scratchpad block and milestone blocks if needed
  const scratchpadBlock = folder.blocks?.find((b) => b.is_scratchpad === 1);
  const milestoneBlocks = folder.blocks?.filter((b) => b.is_scratchpad !== 1) || [];

  // Focus Session Immersive Render Override
  if (isFocusSessionActive && activeBlockDetails) {
    const formatTimer = (secs: number) => {
      const m = Math.floor(secs / 60).toString().padStart(2, "0");
      const s = (secs % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    };

    return (
      <div className="flex-1 flex flex-col h-full bg-[#0d1013] text-[#e8e8e8] relative overflow-hidden" id="immersive-focus-view">
        
        {/* Top Cinematic Header Row */}
        <div className="border-b border-[#2b3543]/20 bg-[#11151a] px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#9ee5d8] animate-ping" />
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-[#8a9199] block font-bold leading-none">
                ACTIVE FOCUS WAVE WORKSPACE
              </span>
              <h2 className="text-base font-bold text-[#e8e8e8] tracking-tight mt-0.5">
                {activeBlockDetails.name}
              </h2>
            </div>
          </div>

          {/* Huge Monospace Glowing Timer Display */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1">
              <span className="text-3xl font-extrabold font-mono tracking-wider text-[#9ee5d8] drop-shadow-[0_0_10px_rgba(158,229,216,0.25)]">
                {formatTimer(sessionSeconds)}
              </span>
              <span className="text-[10px] font-mono text-[#8a9199]/70 uppercase select-none font-bold">
                {isSessionPaused ? "paused" : "running"}
              </span>
            </div>

            {/* Action controls row */}
            <div className="flex items-center gap-2">
              <button
                onClick={onTogglePauseSession}
                className={`px-3 py-1.5 border font-mono text-[10px] rounded uppercase font-bold tracking-wider transition-all cursor-pointer ${
                  isSessionPaused 
                    ? "border-[#9ee5d8] text-[#9ee5d8] hover:bg-[#9ee5d8]/10" 
                    : "border-[#8a9199]/40 text-[#8a9199] hover:text-white"
                }`}
              >
                {isSessionPaused ? "Resume" : "Pause"}
              </button>

              <button
                onClick={() => {
                  if (confirm("Are you sure you want to discard this focus wave session? Elapsed time will be discarded.")) {
                    onAbortSession();
                  }
                }}
                className="px-3 py-1.5 border border-red-500/40 hover:border-red-500 text-red-400 font-mono text-[10px] rounded uppercase font-bold tracking-wider transition-all cursor-pointer"
              >
                Abort
              </button>

              <button
                onClick={handleEndSession}
                className="px-4 py-1.5 bg-[#9ee5d8] hover:bg-[#b5f0e5] text-[#11151a] font-mono text-[10px] rounded uppercase font-extrabold tracking-wider transition-all cursor-pointer"
              >
                Complete & Log Duration
              </button>
            </div>
          </div>
        </div>

        {/* Focused Main Content Grid */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden h-full">
          
          {/* Left panel: Task Checklist inside Active Block only */}
          <div className="col-span-5 border-r border-[#2b3543]/15 overflow-y-auto p-6 bg-[#0e1216]">
            <div className="mb-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#8a9199] font-extrabold block">
                Focal Checklist / Task Matrix
              </span>
              <p className="text-xs text-[#8a9199]/70 leading-relaxed mt-0.5">
                Check off items as you make progress. Updates publish instantly.
              </p>
            </div>

            <div className="space-y-4 mt-4">
              {activeBlockDetails.tasks && activeBlockDetails.tasks.length > 0 ? (
                <div className="space-y-2">
                  {activeBlockDetails.tasks.map((task) => (
                    <div 
                      key={task.id}
                      className="p-3 bg-[#161a20]/75 border border-[#2b3543]/20 hover:border-[#2b3543]/50 rounded-lg flex items-center gap-3 cursor-pointer transition-all"
                      onClick={(e) => handleTaskToggle(task.id, e)}
                    >
                      {task.done === 1 ? (
                        <CheckSquare size={15} className="text-[#9ee5d8] shrink-0" />
                      ) : (
                        <Square size={15} className="text-[#8a9199]/50 hover:text-[#9ee5d8] shrink-0" />
                      )}
                      <span className={`text-sm break-all ${task.done === 1 ? "line-through text-[#8a9199]/30 font-medium" : "text-[#e8e8e8]/85"}`}>
                        {task.text}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded bg-[#161a20]/40 text-center border border-dashed border-[#2b3543]/20 text-xs text-[#8a9199]/50 italic">
                  No tasks assigned to this focal block. Include one below!
                </div>
              )}

              {/* Add task inline form during session */}
              <form 
                onSubmit={(e) => handleTaskSubmit(activeBlockDetails.id, e)}
                className="mt-4 flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Insert checklist point during session..."
                  value={taskInputTexts[activeBlockDetails.id] || ""}
                  onChange={(e) => setTaskInputTexts(prev => ({ ...prev, [activeBlockDetails.id]: e.target.value }))}
                  className="bg-[#11151a] border border-[#2b3543]/50 focus:border-[#9ee5d8] text-xs px-3 py-2 rounded outline-none placeholder-[#8a9199]/40 text-[#e8e8e8] flex-1 font-sans transition-colors"
                />
                <button 
                  type="submit"
                  disabled={!taskInputTexts[activeBlockDetails.id]?.trim()}
                  className="px-3 py-2 bg-[#1a1f26] border border-[#2b3543]/45 hover:bg-[#9ee5d8] hover:text-[#11151a] text-[#818a94] disabled:opacity-30 font-mono text-xs rounded transition-all uppercase tracking-wider shrink-0 cursor-pointer"
                >
                  Append
                </button>
              </form>
            </div>
          </div>

          {/* Right panel: Live Logs workspace track */}
          <div className="col-span-7 bg-[#0d1013] overflow-y-auto p-6 flex flex-col justify-between h-full pb-32">
            <div>
              <div className="mb-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8a9199] font-extrabold block">
                  Focal Activity Logs Feed
                </span>
                <p className="text-xs text-[#8a9199]/70 leading-relaxed mt-0.5">
                  Record logs directly below to stream your progress as you work.
                </p>
              </div>

              {/* Logs output lists */}
              <div className="space-y-2 mt-4 overflow-y-auto max-h-[70vh]">
                {activeBlockDetails.logs && activeBlockDetails.logs.length > 0 ? (
                  <div className="space-y-2">
                    {activeBlockDetails.logs.map((log) => (
                      <div 
                        key={log.id} 
                        className="p-3 bg-[#161a20]/20 border border-[#2b3543]/10 hover:border-[#2b3543]/20 rounded-lg text-xs leading-relaxed transition-all flex items-start gap-2"
                      >
                        <span className="font-mono text-[9px] text-[#8a9199]/40 select-none mt-0.5 shrink-0">
                          [{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
                        </span>
                        <span className="text-[#8a9199] hover:text-[#e8e8e8] transition-colors font-sans break-all">
                          {log.text}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs font-mono text-[#8a9199]/40 italic block py-4 text-center select-none border border-dashed border-[#2b3543]/10">
                    No logs initialized in this focal workspace block. Enter below!
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Dedicated Immersive focused prompt input bar */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[#11151a] border-t border-[#2b3543]/30 px-8 flex items-center justify-between z-10">
          <form onSubmit={handleLogSubmit} className="w-full flex items-center gap-4 max-w-5xl mx-auto">
            
            <div className="shrink-0 min-w-[125px] select-none">
              <span className="text-[8px] font-mono uppercase tracking-widest text-[#8a9199] block font-bold">
                STREAMING TARGET
              </span>
              <span className="text-xs text-[#9ee5d8] font-bold truncate block mt-0.5">
                {activeBlockDetails.name}
              </span>
            </div>

            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={logInputText}
                onChange={(e) => setLogInputText(e.target.value)}
                disabled={isSubmittingLog}
                placeholder={`Type progress log with zero syntax, then hit [Enter]...`}
                className="w-full bg-[#0d1013] border border-[#2b3543]/60 focus:border-[#9ee5d8] text-sm text-[#e8e8e8] pl-4 pr-24 py-3 rounded outline-none font-sans transition-colors placeholder-[#8a9199]/30"
                id="v2-immersive-prompt-input"
              />
              {logInputText.trim().length > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[#8a9199]/60 select-none bg-[#0d1013] border border-[#2b3543]/30 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest">
                  saving draft
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmittingLog || !logInputText.trim()}
              className="flex items-center gap-2 px-5 py-3 bg-[#9ee5d8] hover:bg-[#b5f0e5] disabled:bg-[#9ee5d8]/20 disabled:text-[#8a9199]/50 text-[#11151a] font-extrabold text-xs rounded transition-all uppercase tracking-widest shrink-0 cursor-pointer"
            >
              {isSubmittingLog ? (
                <RefreshCw className="animate-spin" size={13} />
              ) : (
                <ChevronsRight size={14} className="animate-pulse" />
              )}
              Log Entry
            </button>
          </form>
        </div>

      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#11151a] text-[#e8e8e8] relative overflow-hidden" id={`v2-folderview-${folder.id}`}>
      
      {/* Scrollable Container with Padding for bottom input */}
      <div className="flex-1 overflow-y-auto px-8 pt-8 pb-32">
        
        {/* Navigation row */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onBackToLauncher}
            className="group flex items-center gap-2 text-xs font-mono text-[#8a9199] hover:text-white transition-colors uppercase tracking-wider"
            id="folderview-back-btn"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Launcher
          </button>

          {folder.completed === 0 && (
            <button
              onClick={onFolderCompleted}
              className="px-4 py-1.5 border border-[#9ee5d8]/30 hover:border-[#9ee5d8] text-[#9ee5d8] hover:bg-[#9ee5d8]/5 font-semibold text-xs rounded transition-all uppercase tracking-wider shrink-0"
              id="folderview-complete-btn"
            >
              Mark Complete
            </button>
          )}
        </div>

        {/* Folder Header Banner */}
        <div className="mb-8 border-b border-[#2b3543]/15 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-0.5 font-mono text-[9px] rounded uppercase select-none ${
              folder.completed === 1 
                ? "bg-[#2b3543]/40 text-[#8a9199]" 
                : "bg-[#9ee5d8]/10 text-[#9ee5d8] border border-[#9ee5d8]/20"
            }`}>
              {folder.completed === 1 ? "Completed" : "Active Workspace"}
            </span>
            <span className="text-[10px] font-mono text-[#8a9199] flex items-center gap-1 select-none">
              <Clock size={10} />
              Created {new Date(folder.created_at).toLocaleDateString()}
            </span>
          </div>

          <h1 className="text-3xl font-extrabold text-[#e8e8e8] tracking-tight">{folder.name}</h1>
          
          {/* End goal description */}
          <div className="mt-4 flex items-start gap-3 bg-[#1a1f26]/80 border border-[#2b3543]/15 p-4 rounded-lg max-w-4xl">
            <Target size={16} className="text-[#9ee5d8] shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-[#8a9199] block font-bold select-none">
                Core Objective / End Goal Target
              </span>
              <p className="text-sm text-[#e8e8e8] italic mt-0.5 leading-relaxed">
                "{folder.end_goal}"
              </p>
            </div>
          </div>
        </div>

        {/* Blocks Workspace Grid */}
        <div className="max-w-4xl space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8a9199] flex items-center gap-2">
              <Layers size={13} className="text-[#9ee5d8]" />
              Blocks & Milestone Focus Cards ({folder.blocks?.length || 0})
            </h2>
            <span className="text-[9px] font-mono text-[#8a9199]/50 select-none">CLICK CARD TO SET ACTIVE LOG FOCUS</span>
          </div>

          {/* 1. Render Pinned Scratchpad */}
          {scratchpadBlock && (
            <div 
              onClick={() => setSelectedBlockId(scratchpadBlock.id)}
              className={`p-5 bg-[#1a1f26]/40 border rounded-lg transition-all cursor-pointer relative group flex flex-col justify-between ${
                selectedBlockId === scratchpadBlock.id 
                  ? "border-[#9ee5d8] shadow-[0_0_15px_rgba(158,229,216,0.04)] bg-[#1a1f26]/80" 
                  : "border-dashed border-[#2b3543] hover:border-[#8a9199]/40"
              }`}
              id={`v2-block-card-${scratchpadBlock.id}`}
            >
              <div>
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sparkles size={13} className="text-[#9ee5d8]" />
                    <h3 className="text-sm font-semibold text-[#e8e8e8] tracking-tight font-sans">
                      {scratchpadBlock.name}
                    </h3>
                    <span className="px-1.5 py-0.5 text-[8px] font-mono bg-[#9ee5d8]/10 text-[#9ee5d8] rounded font-bold uppercase tracking-wider select-none">
                      Pinned Scratchpad
                    </span>
                    {scratchpadBlock.total_duration_seconds && scratchpadBlock.total_duration_seconds > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[#f0a500] font-mono text-[9px] bg-[#f0a500]/5 border border-[#f0a500]/15 px-1.5 py-0.5 rounded select-none">
                        <Clock size={10} className="text-[#f0a500]" />
                        ⏱️ Focused: {Math.floor(scratchpadBlock.total_duration_seconds / 60)}m {scratchpadBlock.total_duration_seconds % 60}s
                      </span>
                    ) : null}
                  </div>

                  {selectedBlockId === scratchpadBlock.id ? (
                    <span className="flex items-center gap-1 text-[9px] font-mono text-[#9ee5d8] font-bold select-none uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9ee5d8] animate-ping"></span>
                      Active Focus
                    </span>
                  ) : (
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-[#8a9199] uppercase font-semibold">
                      Select Space
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#8a9199]/85 italic leading-relaxed">
                  Repository for general ideas, fleeting concepts, and logs unassigned to specific project phases.
                </p>

                {/* Tasks checklist section */}
                <div className="mt-4 space-y-2 border-t border-[#2b3543]/20 pt-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#8a9199]/60 font-bold block mb-2 select-none">
                    Scratch Checklist
                  </span>
                  
                  {scratchpadBlock.tasks && scratchpadBlock.tasks.length > 0 ? (
                    <div className="space-y-1.5">
                      {scratchpadBlock.tasks.map((task) => (
                        <div 
                          key={task.id}
                          className="flex items-center gap-2.5 text-xs text-[#8a9199] hover:text-[#e8e8e8] transition-colors leading-relaxed"
                          onClick={(e) => handleTaskToggle(task.id, e)}
                        >
                          {task.done === 1 ? (
                            <CheckSquare size={13} className="text-[#9ee5d8] shrink-0" />
                          ) : (
                            <Square size={13} className="text-[#8a9199]/50 hover:text-[#9ee5d8] shrink-0" />
                          )}
                          <span className={`break-all ${task.done === 1 ? "line-through text-[#8a9199]/40" : "text-[#e8e8e8]/85"}`}>
                            {task.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-[#8a9199]/30 select-none italic block mb-1">
                      No scratch items added.
                    </span>
                  )}

                  {/* Add task inline form */}
                  <form 
                    onSubmit={(e) => handleTaskSubmit(scratchpadBlock.id, e)} 
                    className="mt-3 flex items-center gap-2 max-w-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      placeholder="Add checkout item to scratchpad..."
                      value={taskInputTexts[scratchpadBlock.id] || ""}
                      onChange={(e) => setTaskInputTexts(prev => ({ ...prev, [scratchpadBlock.id]: e.target.value }))}
                      className="bg-[#11151a] border border-[#2b3543]/45 focus:border-[#9ee5d8] text-xs px-2.5 py-1.5 rounded outline-none placeholder-[#8a9199]/30 text-[#e8e8e8] flex-1 font-sans transition-colors"
                    />
                    <button 
                      type="submit" 
                      disabled={!taskInputTexts[scratchpadBlock.id]?.trim()}
                      className="p-1.5 bg-[#2b3543]/30 disabled:opacity-40 hover:bg-[#9ee5d8] text-[#8a9199] hover:text-[#11151a] transition-all rounded shrink-0"
                      title="Add Scratch item"
                    >
                      <Plus size={12} />
                    </button>
                  </form>
                </div>

                {/* Logs within Scratchpad */}
                <div className="mt-4 space-y-2 border-t border-[#2b3543]/20 pt-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#8a9199]/60 font-bold block mb-2 select-none">
                    Historical Logs
                  </span>
                  {scratchpadBlock.logs && scratchpadBlock.logs.length > 0 ? (
                    <div className="space-y-1.5">
                      {scratchpadBlock.logs.map((log) => (
                        <div key={log.id} className="text-xs flex items-start gap-2 text-[#8a9199] hover:text-[#e8e8e8] transition-colors leading-relaxed font-sans">
                          <span className="font-mono text-[9px] text-[#8a9199]/40 mt-0.5 select-none shrink-0">
                            [{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
                          </span>
                          <span className="break-all">{log.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-[#8a9199]/40 uppercase tracking-wider select-none block italic">
                      No logs in scratchpad. Select focus and enter log in prompt bar.
                    </span>
                  )}
                </div>

                {selectedBlockId === scratchpadBlock.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (folder) {
                        onStartSession(scratchpadBlock.id, scratchpadBlock.name, folder.id, folder.name);
                      }
                    }}
                    className="mt-4 px-4 py-2 bg-[#9ee5d8] hover:bg-[#b5f0e5] text-[#11151a] font-bold text-xs rounded transition-all flex items-center gap-1.5 uppercase tracking-widest cursor-pointer w-fit"
                  >
                    <Activity size={12} className="animate-pulse" />
                    Start Focus Session
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 2. Render normal Milestones */}
          <div className="grid grid-cols-1 gap-4">
            {milestoneBlocks.map((block) => {
              const isSelected = selectedBlockId === block.id;
              return (
                <div 
                  key={block.id} 
                  onClick={() => setSelectedBlockId(block.id)}
                  className={`p-5 bg-[#1a1f26] border rounded-lg transition-all cursor-pointer relative group flex flex-col justify-between ${
                    isSelected 
                      ? "border-[#9ee5d8] shadow-[0_0_15px_rgba(158,229,216,0.04)]" 
                      : "border-[#2b3543]/55 hover:border-[#8a9199]/30"
                  }`}
                  id={`v2-block-card-${block.id}`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#e8e8e8] tracking-tight flex items-center gap-2 flex-wrap">
                          {block.name}
                          {block.total_duration_seconds && block.total_duration_seconds > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[#f0a500] font-mono text-[9px] bg-[#f0a500]/5 border border-[#f0a500]/15 px-1.5 py-0.5 rounded select-none">
                              <Clock size={10} className="text-[#f0a500]" />
                              ⏱️ Focused: {Math.floor(block.total_duration_seconds / 60)}m {block.total_duration_seconds % 60}s
                            </span>
                          ) : null}
                        </h3>
                        {block.goal && (
                          <p className="text-xs text-[#8a9199] mt-0.5 leading-relaxed italic">
                            Goal: {block.goal}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {isSelected ? (
                          <span className="flex items-center gap-1.5 text-[9px] font-mono text-[#9ee5d8] font-bold select-none uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#9ee5d8] animate-ping"></span>
                            ACTIVE FOCUS
                          </span>
                        ) : (
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-[#8a9199] uppercase select-none font-semibold">
                            Select Focus
                          </span>
                        )}
                        <span className="font-mono text-[9px] text-[#8a9199]/30 select-none font-semibold">
                          POS #{block.position}
                        </span>
                      </div>
                    </div>

                    {/* Milestone checkable items list */}
                    <div className="mt-4 space-y-2 border-t border-[#2b3543]/20 pt-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#8a9199]/60 font-bold block mb-2 select-none">
                        Tasks Checklist
                      </span>
                      {block.tasks && block.tasks.length > 0 ? (
                        <div className="space-y-1.5">
                          {block.tasks.map((task) => (
                            <div 
                              key={task.id}
                              className="flex items-center gap-2.5 text-xs text-[#8a9199] hover:text-[#e8e8e8] transition-colors leading-relaxed"
                              onClick={(e) => handleTaskToggle(task.id, e)}
                            >
                              {task.done === 1 ? (
                                <CheckSquare size={13} className="text-[#9ee5d8] shrink-0" />
                              ) : (
                                <Square size={13} className="text-[#8a9199]/50 hover:text-[#9ee5d8] shrink-0" />
                              )}
                              <span className={`break-all ${task.done === 1 ? "line-through text-[#8a9199]/40" : "text-[#e8e8e8]/85"}`}>
                                {task.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-[#8a9199]/30 select-none block italic mb-1">
                          No tasks configured. Create one below.
                        </span>
                      )}

                      {/* Add task inline form */}
                      <form 
                        onSubmit={(e) => handleTaskSubmit(block.id, e)} 
                        className="mt-3 flex items-center gap-2 max-w-md"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          placeholder="Add checklist task..."
                          value={taskInputTexts[block.id] || ""}
                          onChange={(e) => setTaskInputTexts(prev => ({ ...prev, [block.id]: e.target.value }))}
                          className="bg-[#11151a] border border-[#2b3543]/45 focus:border-[#9ee5d8] text-xs px-2.5 py-1.5 rounded outline-none placeholder-[#8a9199]/30 text-[#e8e8e8] flex-1 font-sans transition-colors"
                        />
                        <button 
                          type="submit" 
                          disabled={!taskInputTexts[block.id]?.trim()}
                          className="p-1.5 bg-[#2b3543]/30 disabled:opacity-40 hover:bg-[#9ee5d8] text-[#8a9199] hover:text-[#11151a] transition-all rounded shrink-0"
                          title="Add Task item"
                        >
                          <Plus size={12} />
                        </button>
                      </form>
                    </div>

                    {/* Logs listed chronologically */}
                    <div className="mt-4 space-y-2 border-t border-[#2b3543]/20 pt-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#8a9199]/60 font-bold block mb-2 select-none">
                        Historical Logs
                      </span>
                      {block.logs && block.logs.length > 0 ? (
                        <div className="space-y-1.5">
                          {block.logs.map((log) => (
                            <div key={log.id} className="text-xs flex items-start gap-2 text-[#8a9199] hover:text-[#e8e8e8] transition-colors leading-relaxed">
                              <span className="font-mono text-[9px] text-[#8a9199]/40 mt-0.5 select-none shrink-0">
                                [{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
                              </span>
                              <span className="break-all">{log.text}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-[#8a9199]/40 uppercase tracking-widest select-none block italic">
                          No logs recorded in this milestone block.
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (folder) {
                            onStartSession(block.id, block.name, folder.id, folder.name);
                          }
                        }}
                        className="mt-4 px-4 py-2 bg-[#9ee5d8] hover:bg-[#b5f0e5] text-[#11151a] font-bold text-xs rounded transition-all flex items-center gap-1.5 uppercase tracking-widest cursor-pointer w-fit"
                      >
                        <Activity size={12} className="animate-pulse" />
                        Start Focus Session
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* "+ New Block" collapse button / Form */}
          <div className="pt-2">
            {!showAddBlock ? (
              <button
                onClick={() => setShowAddBlock(true)}
                className="flex items-center gap-2 px-4 py-2 border border-[#2b3543]/70 hover:border-[#9ee5d8]/40 hover:bg-[#1a1f26]/20 transition-all font-mono text-xs rounded text-[#8a9199] hover:text-[#9ee5d8] uppercase tracking-wider"
                id="folderview-add-block-btn"
              >
                <Plus size={14} />
                Create Milestone Block
              </button>
            ) : (
              <motion.form 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleBlockSubmit}
                className="bg-[#1a1f26] border border-[#2b3543]/50 p-5 rounded-lg space-y-4 max-w-lg"
              >
                <div className="text-xs font-mono uppercase tracking-widest text-[#9ee5d8] font-bold flex items-center justify-between select-none">
                  <span>New Milestone Specifications</span>
                  <span className="text-[#8a9199]/30">Auto-increment sorting</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono text-[#8a9199] uppercase tracking-wider font-bold block">
                    Milestone Block Name
                  </label>
                  <input
                    type="text"
                    value={newBlockName}
                    onChange={(e) => setNewBlockName(e.target.value)}
                    required
                    placeholder="e.g. Backend Schema, API validations, CSS Polish"
                    className="w-full bg-[#11151a] border border-[#2b3543]/50 focus:border-[#9ee5d8] text-sm text-[#e8e8e8] px-3 py-2 rounded outline-none font-sans transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono text-[#8a9199] uppercase tracking-wider font-bold block">
                    Goal/Objective (Optional)
                  </label>
                  <input
                    type="text"
                    value={newBlockGoal}
                    onChange={(e) => setNewBlockGoal(e.target.value)}
                    placeholder="e.g. Implement the 4 schema v2 tables securely"
                    className="w-full bg-[#11151a] border border-[#2b3543]/50 focus:border-[#9ee5d8] text-sm text-[#e8e8e8] px-3 py-2 rounded outline-none font-sans transition-colors"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBlock(false);
                      setNewBlockName("");
                      setNewBlockGoal("");
                    }}
                    className="px-3.5 py-1.5 bg-transparent border border-[#2b3543] hover:bg-[#2b3543]/40 text-xs text-[#8a9199] rounded font-mono uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingBlock || !newBlockName.trim()}
                    className="px-4 py-1.5 bg-[#9ee5d8] hover:bg-[#b5f0e5] disabled:bg-[#9ee5d8]/30 text-[#11151a] font-bold text-xs rounded font-sans uppercase tracking-wider"
                  >
                    {isSubmittingBlock ? "Assembling Block..." : "Create Block"}
                  </button>
                </div>
              </motion.form>
            )}
          </div>
        </div>
      </div>

      {/* Floating Bottom Log Prompt Input Bar */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-24 bg-[#1a1f26] border-t border-[#2b3543]/30 px-8 flex items-center justify-between"
        id="v2-bottom-log-prompt-bar"
      >
        <form onSubmit={handleLogSubmit} className="w-full flex items-center gap-4 max-w-5xl mx-auto">
          
          {/* Active target block signifier */}
          <div className="shrink-0 text-left min-w-[140px] max-w-[200px] border-r border-[#2b3543]/20 pr-4 select-none">
            <span className="text-[9px] font-mono uppercase tracking-widest text-[#8a9199] block font-bold">
              LOG TARGET FOCUS
            </span>
            <span className="text-xs text-[#9ee5d8] font-bold truncate block mt-0.5">
              {activeBlockDetails ? activeBlockDetails.name : "Select block"}
            </span>
          </div>

          {/* Main Input Text container */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={logInputText}
              onChange={(e) => setLogInputText(e.target.value)}
              disabled={isSubmittingLog || !selectedBlockId}
              placeholder={
                selectedBlockId 
                  ? `Write log in "${activeBlockDetails?.name || ""}" and press [Enter]...`
                  : "Please select/focus a block above to register logs..."
              }
              className="w-full bg-[#11151a] border border-[#2b3543]/60 focus:border-[#9ee5d8] text-sm text-[#e8e8e8] pl-4 pr-24 py-3 rounded outline-none font-sans transition-colors placeholder-[#8a9199]/40"
              id="v2-log-prompt-input"
            />
            {logInputText.trim().length > 0 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[#8a9199]/60 select-none bg-[#11151a] border border-[#2b3543]/30 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest">
                saving draft
              </span>
            )}
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={isSubmittingLog || !logInputText.trim() || !selectedBlockId}
            className="flex items-center gap-2 px-5 py-3 bg-[#9ee5d8] hover:bg-[#b5f0e5] disabled:bg-[#9ee5d8]/20 disabled:text-[#8a9199]/50 text-[#11151a] font-extrabold text-xs rounded transition-all uppercase tracking-widest shrink-0"
            id="v2-submit-log-btn"
          >
            {isSubmittingLog ? (
              <RefreshCw className="animate-spin" size={13} />
            ) : (
              <ChevronsRight size={14} className="animate-pulse" />
            )}
            Log Work
          </button>

        </form>
      </div>

    </div>
  );
}
