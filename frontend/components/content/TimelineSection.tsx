import type { TimelineContent } from "@/lib/types";

export function TimelineSection({ content }: { content: TimelineContent }) {
  return (
    <ol className="space-y-5 border-l border-border pl-5">
      {content.events.map((event, i) => (
        <li key={i} className="relative">
          <span
            className="absolute top-1 h-2 w-2 rounded-full bg-accent"
            style={{ left: "-25px" }}
            aria-hidden
          />
          <div className="text-xs font-medium text-muted">{event.date}</div>
          <div className="font-serif text-base font-semibold leading-6 text-foreground">{event.label}</div>
          {event.description ? (
            <p className="mt-0.5 font-serif text-[0.9375rem] leading-6 text-foreground-secondary">
              {event.description}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
