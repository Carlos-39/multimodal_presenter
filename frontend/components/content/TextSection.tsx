import type { TextContent } from "@/lib/types";

export function TextSection({ content }: { content: TextContent }) {
  const paragraphs = content.text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
