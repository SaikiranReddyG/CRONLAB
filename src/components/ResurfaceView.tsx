import React from "react";
import { Sparkles, Calendar, Archive, Trash, Check, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { ResurfacedIdea, Project } from "../types";

interface ResurfaceViewProps {
  ideas: ResurfacedIdea[];
  projects: Project[];
  onIdeaAction: (id: string, action: "PROMOTE" | "BURY" | "LATER") => Promise<void>;
}

export default function ResurfaceView({ ideas, projects, onIdeaAction }: ResurfaceViewProps) {
  // Filter active resurfaced items
  const activeIdeas = ideas.filter((idx) => idx.status === "active" || idx.status === "later");

  const getProjectName = (projId: string) => {
    const proj = projects.find((p) => p.id === projId);
    return proj ? proj.name : `#${projId}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0a0a0a] select-none text-brand-text" id="cronlab-resurface-tab">
      
      {/* 1. Introductory header description */}
      <div className="border border-[#1a1a1a] bg-[#111111] p-5 rounded-none relative overflow-hidden">
        {/* Kontemplative decorative canvas backdrop */}
        <div className="absolute inset-x-0 bottom-0 top-0 bg-[radial-gradient(#ffffff01_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
        
        <div className="flex items-start gap-3.5 z-10 relative">
          <Sparkles className="w-5 h-5 text-brand-amber animate-pulse mt-1" />
          <div className="space-y-1">
            <h1 className="text-xl font-sans font-bold text-[#ffffff]">IDEATION RESURFACING COGNITION BLOCK</h1>
            <p className="text-xs font-mono text-white/40 leading-relaxed max-w-2xl select-text">
              Cronlab acts as an archaeological memory parser. It extracts raw developer concept seeds entered during flow states and surfaces them here. Promote seeds directly to standard workflow checklists, defer, or archive them.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Grid list of ideas card outputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="resurface-ideas-grid">
        {activeIdeas.length > 0 ? (
          activeIdeas.map((idea) => {
            const daysAgo = idea.ageDays === 0 ? "today" : `${idea.ageDays} days ago`;
            const projName = getProjectName(idea.project);
            
            return (
              <div 
                key={idea.id} 
                className="bg-[#111111] border border-[#1a1a1a] hover:border-[#222222] p-5 rounded-none flex flex-col justify-between space-y-4 transition-all duration-150"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono ">
                    <div className="flex items-center gap-1 bg-[#0a0a0a] text-brand-amber border border-[#1a1a1a] px-2 py-0.5 rounded-none">
                      <span>SCOPE:</span>
                      <span className="font-bold select-text">{projName}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-white/40">
                      <Calendar className="w-3.5 h-3.5 text-white/30" />
                      <span className="capitalize">{daysAgo}</span>
                    </div>
                  </div>

                  {/* Monospaced quote log */}
                  <blockquote className="border-l-2 border-brand-amber/40 pl-4 py-1 italic font-mono text-xs text-brand-text/90 leading-relaxed select-text">
                    “{idea.rawText}”
                  </blockquote>
                </div>

                {/* Tracking stats / action items */}
                <div className="border-t border-[#1a1a1a] pt-3.5 flex items-center justify-between">
                  <div className="font-mono text-[9px] text-white/30">
                    {idea.deferredCount > 0 ? (
                      <span className="text-brand-amber/70 font-bold bg-[#0a0a0a] border border-brand-amber/15 px-1.5 py-0.5 rounded-none">
                        DEFERRED {idea.deferredCount} TIME{idea.deferredCount > 1 ? "S" : ""}
                      </span>
                    ) : (
                      <span className="text-white/20 uppercase">FRESH COGNITION SEED</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <button
                      onClick={() => onIdeaAction(idea.id, "BURY")}
                      className="px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/5 border border-red-500/20 hover:border-red-500/40 rounded-none transition-all flex items-center gap-1 cursor-pointer"
                      title="Archive conceptual block permanently"
                    >
                      <Trash className="w-3 h-3" />
                      <span>BURY</span>
                    </button>
                    
                    <button
                      onClick={() => onIdeaAction(idea.id, "LATER")}
                      className="px-2.5 py-1 text-white/50 hover:text-white hover:bg-white/5 border border-[#1a1a1a] hover:border-white/30 rounded-none transition-all flex items-center gap-1 cursor-pointer"
                      title="Defer cognition cycle"
                    >
                      <Clock className="w-3 h-3" />
                      <span>LATER</span>
                    </button>

                    <button
                      onClick={() => onIdeaAction(idea.id, "PROMOTE")}
                      className="px-3 py-1 bg-[#0a0a0a] hover:bg-brand-amber/10 text-brand-amber border border-[#f0a500] rounded-none font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Escalate from seed to checklist milestone task!"
                    >
                      <Check className="w-3 h-3 text-brand-amber font-extrabold" />
                      <span>PROMOTE</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 h-72 flex flex-col items-center justify-center text-center text-white/20 p-6 border border-dashed border-[#1a1a1a] rounded-none font-mono">
            <AlertCircle className="w-6 h-6 mb-2 opacity-50 text-brand-amber animate-pulse" />
            <span className="text-xs uppercase font-bold tracking-widest text-brand-amber">ARCHAEOLOGICAL SHELF EMPTY</span>
            <p className="text-[10px] text-white/30 mt-1 pl-12 pr-12 max-w-sm">
              All harvested ideation seeds have been successfully processed, promoted, or buried. Enter more logs containing the `+idea` command tag to reload the shelf.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
