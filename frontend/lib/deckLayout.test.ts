import { describe, expect, it } from "vitest";
import { slideLayout } from "./deckLayout";
import type { GeneratedIllustration } from "./types";

const IMAGE: GeneratedIllustration = {
  kind: "generated_illustration",
  image_url: "data:image/png;base64,AA==",
  alt: "a",
  label: "l",
};

describe("slideLayout", () => {
  it("una slide con ilustración va a dos columnas, tenga o no viñetas", () => {
    expect(slideLayout({ bullets: [], illustration: IMAGE })).toBe("media");
    expect(slideLayout({ bullets: ["a", "b"], illustration: IMAGE })).toBe("media");
  });

  it("una slide con viñetas y sin imagen es una enumeración", () => {
    expect(slideLayout({ bullets: ["a"], illustration: null })).toBe("list");
  });

  it("una idea central (o solo el título) es una declaración", () => {
    expect(slideLayout({ bullets: [], illustration: null })).toBe("statement");
  });
});
