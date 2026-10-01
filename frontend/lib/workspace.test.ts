import { describe, expect, it } from "vitest";
import {
  clampPanelWidth,
  CONTENT_MIN_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
  resolveWorkspace,
  WORKSPACE_MID,
  WORKSPACE_WIDE,
  type PanelId,
} from "./workspace";

const NARROW = WORKSPACE_MID - 1;
const MID = WORKSPACE_MID;
const WIDE = WORKSPACE_WIDE;

describe("resolveWorkspace", () => {
  it("sin paneles abiertos: todo oculto en cualquier ancho", () => {
    for (const w of [NARROW, MID, WIDE]) {
      expect(resolveWorkspace([], w)).toEqual({ source: "hidden", chat: "hidden" });
    }
  });

  it("un panel, ancho amplio: columna", () => {
    expect(resolveWorkspace(["source"], WIDE)).toEqual({ source: "column", chat: "hidden" });
  });

  it("un panel, ancho medio: columna", () => {
    expect(resolveWorkspace(["source"], MID)).toEqual({ source: "column", chat: "hidden" });
  });

  it("un panel, ancho angosto: overlay", () => {
    expect(resolveWorkspace(["source"], NARROW)).toEqual({ source: "overlay", chat: "hidden" });
  });

  it("dos paneles, ancho amplio: coexisten como columnas", () => {
    expect(resolveWorkspace(["source", "chat"], WIDE)).toEqual({
      source: "column",
      chat: "column",
    });
  });

  it("dos paneles, ancho medio: solo el más reciente como columna", () => {
    expect(resolveWorkspace(["source", "chat"], MID)).toEqual({
      source: "hidden",
      chat: "column",
    });
  });

  it("dos paneles, ancho angosto: solo el más reciente como overlay", () => {
    expect(resolveWorkspace(["source", "chat"], NARROW)).toEqual({
      source: "hidden",
      chat: "overlay",
    });
  });

  it("la recencia manda: el último abierto es el que se muestra en medio", () => {
    expect(resolveWorkspace(["chat", "source"], MID)).toEqual({
      source: "column",
      chat: "hidden",
    });
  });

  it("un id repetido cuenta como el más reciente (dedup por última aparición)", () => {
    const order: PanelId[] = ["source", "chat", "source"];
    // Reabrir 'source' lo vuelve el más reciente → en medio, 'source' es la columna.
    expect(resolveWorkspace(order, MID)).toEqual({ source: "column", chat: "hidden" });
  });

  it("el umbral es inclusivo (== MID ya permite columna; == WIDE ya permite dos)", () => {
    expect(resolveWorkspace(["source"], WORKSPACE_MID).source).toBe("column");
    expect(resolveWorkspace(["source", "chat"], WORKSPACE_WIDE)).toEqual({
      source: "column",
      chat: "column",
    });
  });
});

describe("clampPanelWidth", () => {
  it("respeta el ancho pedido cuando está dentro de los topes", () => {
    expect(clampPanelWidth("chat", 360, 1200)).toBe(360);
  });

  it("no baja del mínimo ni sube del máximo del panel", () => {
    expect(clampPanelWidth("chat", 10, 1200)).toBe(PANEL_MIN_WIDTH.chat);
    expect(clampPanelWidth("source", 5000, 3000)).toBe(PANEL_MAX_WIDTH.source);
  });

  it("deja al contenido su ancho mínimo aunque el panel pudiera crecer más", () => {
    const available = 900;
    expect(clampPanelWidth("source", 700, available)).toBe(available - CONTENT_MIN_WIDTH);
  });

  it("si no cabe ni el mínimo, conserva el mínimo del panel", () => {
    expect(clampPanelWidth("source", 400, 500)).toBe(PANEL_MIN_WIDTH.source);
  });
});
