import { parseTextBlocks } from "@/lib/textBlocks";
import type { TextContent } from "@/lib/types";

export function TextSection({ content }: { content: TextContent }) {
  // Párrafos y, si el texto trae una enumeración escrita con guiones o números, listas.
  const blocks = parseTextBlocks(content.text);
  return (
    <div className="max-w-[68ch] space-y-4 font-serif text-base leading-[1.65] text-foreground">
      {blocks.map((block, i) => {
        if (block.kind === "paragraph") return <p key={i}>{block.text}</p>;
        const List = block.ordered ? "ol" : "ul";
        return (
          <List
            key={i}
            className={`space-y-1.5 pl-5 marker:text-muted ${block.ordered ? "list-decimal" : "list-disc"}`}
          >
            {block.items.map((item, j) => (
              <li key={j} className="pl-1">
                {item}
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
