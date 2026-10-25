import React from "react";

interface AudioVisualizerProps {
  level: number; // 0.0 to 1.0
  active: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ level, active }) => {
  const bars = 8;
  const scaled = Math.min(Math.max(level * 40, 0), 1);

  return (
    <div className="flex items-center gap-1 h-5 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/50">
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = (i + 1) / bars;
        const isLit = active && scaled >= threshold;
        const height = active ? Math.max(4, Math.min(16, scaled * 16 * (1 - Math.abs(i - 3.5) / 5))) : 4;

        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              isLit ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-slate-600"
            }`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};
