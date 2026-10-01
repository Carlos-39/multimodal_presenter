import type { TextContent } from "@/lib/types";

export function TextSection({ content }: { content: TextContent }) {
  const paragraphs = content.text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  return (
    <div className="max-w-[68ch] space-y-4 font-serif text-base leading-[1.65] text-foreground">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
