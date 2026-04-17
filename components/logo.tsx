import { cn } from "@/lib/utils";

function NudgraIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Circle outline */}
      <circle
        cx="24"
        cy="24"
        r="21.5"
        stroke="currentColor"
        strokeWidth="2.8"
      />
      {/* Chevron arrow — the "nudge" */}
      <polyline
        points="18.5,13.5 29.5,24 18.5,34.5"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function NudgraLogo({
  size = "default",
  className,
}: {
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "gap-1.5",
    default: "gap-2",
    lg: "gap-2.5",
  };

  const iconSizes = {
    sm: "size-5",
    default: "size-6",
    lg: "size-8",
  };

  const textSizes = {
    sm: "text-base",
    default: "text-lg",
    lg: "text-2xl",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center",
        sizeClasses[size],
        className,
      )}
    >
      <NudgraIcon className={cn(iconSizes[size], "text-primary shrink-0")} />
      <span
        className={cn(
          textSizes[size],
          "font-medium tracking-tight text-foreground",
        )}
      >
        nudgra
      </span>
    </span>
  );
}

export function NudgraIconOnly({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return <NudgraIcon className={cn("text-primary", className)} {...props} />;
}
