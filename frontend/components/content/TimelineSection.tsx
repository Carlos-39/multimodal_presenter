import type { TimelineContent } from "@/lib/types";

export function TimelineSection({ content }: { content: TimelineContent }) {
  return (
    <ol className="space-y-4 border-l border-border pl-5">
      {content.events.map((event, i) => (
        <li key={i} className="relative">
          <span
            className="absolute top-1 h-2 w-2 rounded-full bg-accent"
            style={{ left: "-25px" }}
            aria-hidden
          />
          <div className="text-xs font-medium text-muted">{event.date}</div>
          <div className="text-sm font-medium text-foreground">{event.label}</div>
          {event.description ? (
            <p className="mt-0.5 text-sm text-muted">{event.description}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
