import React, { useState, useEffect, useRef } from "react";
import { ChevronRight, Sparkles, Terminal } from "lucide-react";

interface BottomInputProps {
  onLogLine: (line: string) => Promise<void>;
  projects: { id: string; name: string; tag: string }[];
}

interface AutocompleteItem {
  key: string;
  label: string;
  desc?: string;
}

export default function BottomInput({ onLogLine, projects }: BottomInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [triggerChar, setTriggerChar] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRipple, setShowRipple] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Focus input on '/' or 'ctr+k'
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === "k") || (e.key === "/" && document.activeElement !== inputRef.current)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, []);

  const moodsList: AutocompleteItem[] = [
    { key: "flow", label: "flow", desc: "Immersion state, peak focus" },
    { key: "calm", label: "calm", desc: "Steady progress, low friction" },
    { key: "stuck", label: "stuck", desc: "Technical block or debugging struggle" },
    { key: "tired", label: "tired", desc: "Energy depletion, low cognitive load" },
  ];

  const prefixSuggestions: Record<string, AutocompleteItem[]> = {
    "#": projects.map((p) => ({ key: p.tag, label: p.tag, desc: p.name })),
    "~": moodsList,
    ">": [
      { key: "next", label: "next", desc: "Append immediate intention" },
      { key: "todo", label: "todo", desc: "Add task milestone" },
    ],
    "+": [
      { key: "idea", label: "idea", desc: "Resurfacing ideation block" },
    ],
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Get current cursor placement context
    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursor);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    const matchChar = ["#", "~", ">", "+"].find((char) => lastWord.startsWith(char));

    if (matchChar) {
      setTriggerChar(matchChar);
      const searchStr = lastWord.slice(1).toLowerCase();
      const allPrefixes = prefixSuggestions[matchChar] || [];
      const filtered = allPrefixes.filter(
        (item) => item.key.toLowerCase().includes(searchStr) || (item.desc && item.desc.toLowerCase().includes(searchStr))
      );
      setSuggestions(filtered);
      setDropdownOpen(filtered.length > 0);
      setHighlightIdx(0);
    } else {
      setDropdownOpen(false);
      setTriggerChar(null);
    }
  };

  const selectSuggestion = (item: AutocompleteItem) => {
    if (!triggerChar) return;
    const cursor = inputRef.current?.selectionStart || 0;
    const textBefore = inputValue.slice(0, cursor);
    const textAfter = inputValue.slice(cursor);

    const words = textBefore.split(/\s+/);
    // Replace the last word (containing the trigger char) with complete tag
    words[words.length - 1] = `${triggerChar}${item.key}`;
    const newTextBefore = words.join(" ") + " ";

    setInputValue(newTextBefore + textAfter);
    setDropdownOpen(false);
    setTriggerChar(null);
    
    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
      // Adjust cursor position to end of insertion
      const newPos = newTextBefore.length;
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (dropdownOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (suggestions[highlightIdx]) {
          selectSuggestion(suggestions[highlightIdx]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDropdownOpen(false);
        setTriggerChar(null);
      }
    } else {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitLine();
      }
    }
  };

  const submitLine = async () => {
    if (!inputValue || !inputValue.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onLogLine(inputValue);
      
      // Heartbeat pulse animation
      setShowRipple(true);
      setTimeout(() => setShowRipple(false), 800);
      setInputValue("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative border-t border-[#1a1a1a] bg-[#0a0a0a] px-6 py-4 flex flex-col shrink-0 select-none rounded-none" id="cronlab-bottom-input">
      {/* Ripple Animation wave emanates from input on enter */}
      {showRipple && (
        <span className="absolute inset-0 bg-brand-amber/5 pointer-events-none transition-all duration-700 animate-out fade-out zoom-out w-full h-full border border-brand-amber/30 rounded-none"></span>
      )}

      {/* Autocomplete Overlay */}
      {dropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-6 right-6 mb-2 bg-[#111111] border border-[#111111] md:border-[#1a1a1a] shadow-2xl overflow-hidden max-h-56 z-50 font-mono rounded-none"
        >
          <div className="bg-[#111111] px-4 py-2 border-b border-[#1a1a1a] flex justify-between items-center text-[10px]">
            <span className="text-brand-amber font-semibold tracking-wider uppercase">
              CRONLAB COMPLETION ENGINE: PRESS ENTER TO AUTO-COMPLETE
            </span>
            <span className="opacity-40">
              {suggestions.length} MATCHES FOR '{triggerChar}'
            </span>
          </div>
          <div className="overflow-y-auto max-h-44 bg-[#0a0a0a]">
            {suggestions.map((item, idx) => (
              <div
                key={item.key}
                onClick={() => selectSuggestion(item)}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={`px-4 py-2.5 text-xs flex items-center justify-between cursor-pointer border-l-2 transition-all duration-150 rounded-none ${
                  idx === highlightIdx
                    ? "bg-[#111111] border-brand-amber text-brand-amber"
                    : "bg-transparent border-transparent text-brand-text/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">
                    {triggerChar}
                    {item.key}
                  </span>
                  {item.desc && <span className="opacity-40 text-[10px]">&mdash; {item.desc}</span>}
                </div>
                {idx === highlightIdx && (
                  <span className="text-[9px] bg-brand-amber/20 text-brand-amber px-1.5 py-0.5 border border-brand-amber/30 font-bold rounded-none">
                    ENTER
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actual command entry input */}
      <div className="relative flex items-center bg-[#111111] border border-[#1a1a1a] focus-within:border-brand-amber transition-colors duration-200 rounded-none">
        <div className="px-3.5 text-brand-amber flex items-center gap-1.5 pl-4 shrink-0">
          <Terminal className="w-4 h-4" />
          <span className="text-sm font-bold">❯</span>
        </div>
        
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent border-none outline-none py-3 pl-1 pr-16 text-sm text-brand-text font-mono placeholder:opacity-20 select-text"
          placeholder="log a line... #project ~mood >next +idea"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          disabled={isSubmitting}
        />

        <div className="absolute right-3.5 flex items-center gap-2">
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-[#f0a500] border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <button
              onClick={submitLine}
              disabled={!inputValue.trim()}
              className="px-3 py-1 text-[10px] font-mono font-bold text-brand-amber border border-brand-amber/20 hover:border-brand-amber hover:bg-brand-amber/10 rounded-none transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
            >
              <span>LOG</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1.5 text-[9px] font-mono text-white/30 px-1">
        <div className="flex items-center gap-3.5">
          <span>SHORTCUTS: <kbd className="bg-white/5 border border-[#1a1a1a] px-1 rounded-none text-[8px]">ctrl+1..7</kbd> TAB SWITCH</span>
          <span><kbd className="bg-white/5 border border-[#1a1a1a] px-1 rounded-none text-[8px]">ctrl+k</kbd> FOCUS TERMINAL</span>
        </div>
        <div className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-brand-amber/40 animate-pulse" />
          <span className="uppercase tracking-wider">AI EMBEDDED INTENT EXTRACTION RECOGNIZES #PROJECTS, ~MOODS, &gt;NEXT PATHS &amp; +IDEAS</span>
        </div>
      </div>
    </div>
  );
}
