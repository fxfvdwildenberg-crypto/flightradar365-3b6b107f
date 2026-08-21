import { cn } from "@/lib/utils";

/**
 * The ATC365 wordmark — pure type, no plate or background, so it sits cleanly
 * on any surface.
 */
export function Logo({ className, alt = "ATC365" }: { className?: string; alt?: string }) {
  return (
    <span
      aria-label={alt}
      className={cn(
        "flex shrink-0 select-none items-center font-display text-2xl leading-none font-bold tracking-console text-primary",
        className,
      )}
    >
      ATC<span className="text-foreground">365</span>
    </span>
  );
}
