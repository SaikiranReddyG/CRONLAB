import React from "react";
import { FolderV2 } from "./types";
import { Folder, Clock, Target, ArrowRight, FolderPlus, MessageSquare } from "lucide-react";
import { motion } from "motion/react";

interface LauncherProps {
  folders: FolderV2[];
  onSelectFolder: (id: string) => void;
  onOpenFolderModal: () => void;
}

export default function Launcher({ folders, onSelectFolder, onOpenFolderModal }: LauncherProps) {
  const activeFolders = folders.filter((f) => f.completed === 0);
  const completedFolders = folders.filter((f) => f.completed === 1);

  // Helper to format date nice and minimal
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "Unknown";
      
      // Calculate relative time if under 24h
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-[#11151a] text-[#e8e8e8]" id="v1-launcher-container">
      {/* Title block */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sans tracking-tight text-[#e8e8e8]">
            Workspaces <span className="text-[#9ee5d8] text-xs font-mono ml-2 tracking-widest uppercase">System Launcher</span>
          </h1>
          <p className="text-sm text-[#8a9199] mt-1">Select an active folder to focus or review progress logs</p>
        </div>
        <button
          onClick={onOpenFolderModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#9ee5d8] text-[#11151a] hover:bg-[#b5f0e5] font-semibold text-xs rounded transition-colors uppercase tracking-wider"
          id="launcher-create-folder-btn"
        >
          <FolderPlus size={14} />
          New Folder
        </button>
      </div>

      {activeFolders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col items-center justify-center p-8 bg-[#1a1f26] border border-[#2b3543]/40 rounded-lg text-center max-w-2xl mx-auto my-12"
          id="launcher-empty-state"
        >
          <div className="w-16 h-16 rounded-full bg-[#11151a] border border-[#2b3543] flex items-center justify-center text-[#9ee5d8] mb-4">
            <Folder size={28} />
          </div>
          <h3 className="font-sans text-lg font-semibold text-[#e8e8e8]">No Active Folders</h3>
          <p className="text-sm text-[#8a9199] max-w-md mt-2 leading-relaxed">
            Folders house your blocks, tasks, and historical session logs. Create a folder with an ultimate end goal to start tracking.
          </p>
          <button
            onClick={onOpenFolderModal}
            className="mt-6 px-5 py-2.5 bg-[#9ee5d8] text-[#11151a] hover:bg-[#b5f0e5] font-semibold text-xs rounded transition-colors uppercase tracking-widest"
          >
            Create Your First Folder
          </button>
        </motion.div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8a9199] mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9ee5d8]"></span>
              Active Folders ({activeFolders.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeFolders.map((folder, index) => (
                <motion.div
                  key={folder.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelectFolder(folder.id)}
                  className="group relative bg-[#1a1f26] hover:bg-[#202730] border border-[#2b3543]/40 hover:border-[#9ee5d8]/30 p-5 rounded-lg transition-all cursor-pointer flex flex-col justify-between h-56"
                  id={`launcher-folder-${folder.id}`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="p-2 bg-[#11151a] rounded text-[#9ee5d8] group-hover:bg-[#9ee5d8] group-hover:text-[#11151a] transition-all">
                        <Folder size={18} />
                      </div>
                      <span className="text-[10px] font-mono text-[#8a9199] flex items-center gap-1">
                        <Clock size={10} />
                        {formatTime(folder.last_touched)}
                      </span>
                    </div>

                    {/* Meta info */}
                    <h3 className="font-sans text-base font-semibold text-[#e8e8e8] group-hover:text-white transition-colors truncate">
                      {folder.name}
                    </h3>

                    {/* End Goal one-liner */}
                    <div className="flex items-start gap-1.5 mt-2 bg-[#11151a]/40 p-2 rounded text-xs select-none">
                      <Target size={12} className="text-[#9ee5d8]/80 shrink-0 mt-0.5" />
                      <p className="text-[#8a9199] line-clamp-2 italic leading-relaxed">
                        {folder.end_goal}
                      </p>
                    </div>
                  </div>

                  {/* Log Preview */}
                  <div className="mt-4 border-t border-[#2b3543]/20 pt-3 flex flex-col justify-end">
                    {folder.last_log ? (
                      <div className="flex items-start gap-1.5 text-xs text-[#8a9199]">
                        <MessageSquare size={11} className="shrink-0 mt-0.5 text-[#9ee5d8]/65" />
                        <span className="truncate italic">
                          "{folder.last_log}"
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-[#8a9199]/60 uppercase tracking-wider">
                        No logs recorded yet
                      </span>
                    )}
                    <span className="absolute bottom-4 right-4 text-[#9ee5d8] opacity-0 group-hover:opacity-100 transition-opacity p-1">
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {completedFolders.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8a9199] mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8a9199]/40"></span>
                Completed Workspaces ({completedFolders.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60 hover:opacity-90 transition-opacity">
                {completedFolders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => onSelectFolder(folder.id)}
                    className="bg-[#1a1f26]/60 border border-[#2b3543]/20 p-5 rounded-lg cursor-pointer hover:bg-[#1a1f26] transition-all flex flex-col justify-between h-48"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-2 py-0.5 bg-[#2b3543]/40 text-[#8a9199] font-mono text-[9px] rounded uppercase">
                          Done
                        </span>
                        <span className="text-[10px] font-mono text-[#8a9199]">
                          {folder.completed_at ? new Date(folder.completed_at).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <h3 className="font-sans text-sm font-semibold text-[#8a9199] line-through">
                        {folder.name}
                      </h3>
                      <p className="text-xs text-[#8a9199]/80 mt-1 line-clamp-2">
                        {folder.end_goal}
                      </p>
                    </div>
                    <div className="text-[10px] text-[#8a9199]/50 italic">
                      Completed successfully
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
