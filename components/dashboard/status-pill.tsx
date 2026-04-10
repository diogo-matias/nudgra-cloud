import { cn } from "@/lib/utils";

const statusClassMap = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  paused: "bg-amber-50 text-amber-700 ring-amber-200/70",
  inactive: "bg-slate-50 text-slate-500 ring-slate-200/70",
  window_closed: "bg-orange-50 text-orange-700 ring-orange-200/70",
  live: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  draft: "bg-slate-50 text-slate-500 ring-slate-200/70",
  completed: "bg-slate-50 text-slate-500 ring-slate-200/70",
  stopped: "bg-amber-50 text-amber-700 ring-amber-200/70",
} as const;

function formatLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function StatusPill({
  status,
  label,
  className,
}: {
  status: keyof typeof statusClassMap | string;
  label?: string;
  className?: string;
}) {
  const tone =
    status in statusClassMap
      ? statusClassMap[status as keyof typeof statusClassMap]
      : statusClassMap.inactive;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset",
        tone,
        className,
      )}
    >
      {label ?? formatLabel(status)}
    </span>
  );
}
