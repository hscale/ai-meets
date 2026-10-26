import React from "react";

interface AudioVisualizerProps {
  level: number; // 0.0 to 1.0
  active: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ level, active }) => {
  const bars = 8;
  const scaled = Math.min(Math.max(level * 40, 0), 1);

  return (
    <div className="flex items-center gap-1 h-5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = (i + 1) / bars;
        const isLit = active && scaled >= threshold;
        const height = active ? Math.max(3, Math.min(14, scaled * 14 * (1 - Math.abs(i - 3.5) / 5))) : 3;

        return (
          <div
            key={i}
            className={`w-0.5 rounded-full transition-all duration-75 ${
              isLit
                ? i >= 6
                  ? "bg-rose-400"
                  : i >= 4
                  ? "bg-amber-400"
                  : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                : "bg-zinc-700/60"
            }`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};
