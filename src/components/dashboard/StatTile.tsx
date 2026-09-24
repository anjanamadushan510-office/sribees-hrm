import React from "react";
import { cn } from "../../utils/cn";

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "attention";
  icon?: React.ReactNode;
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border px-4 py-3.5",
        tone === "attention"
          ? "border-warn/30 bg-warn-soft"
          : "border-line bg-surface",
      )}
    >
      <span className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-ink-soft">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-semibold tracking-tight text-ink">
        {value}
      </span>
      {hint ? <span className="text-[12px] text-ink-soft">{hint}</span> : null}
    </div>
  );
}
