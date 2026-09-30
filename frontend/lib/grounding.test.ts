import { describe, expect, it } from "vitest";
import { isAnchored, UNANCHORED_NOTICE } from "./grounding";

describe("isAnchored", () => {
  it("verified y unverified son anclables (se ofrece ver fuente)", () => {
    expect(isAnchored("verified")).toBe(true);
    expect(isAnchored("unverified")).toBe(true);
  });

  it("not_found NO es anclable (se muestra aviso, no botón de fuente)", () => {
    expect(isAnchored("not_found")).toBe(false);
  });

  it("el aviso es honesto: no afirma fabricación", () => {
    expect(UNANCHORED_NOTICE.toLowerCase()).not.toContain("fabric");
    expect(UNANCHORED_NOTICE).toMatch(/no se pudo anclar/i);
  });
});
