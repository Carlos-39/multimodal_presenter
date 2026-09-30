"""Núcleo común del experimento Hito 7 (RAG vs GraphRAG). NO es código de producción.

Centraliza: carga de claves, cliente Anthropic (con truststore para el SSL de Windows),
tabla de precios + cálculo de USD, versiones congeladas, render/segmentado de páginas PDF
(pypdfium2 + pypdf) y el registro JSONL trazable de cada corrida.
"""

from __future__ import annotations

import io
import json
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from importlib.metadata import version
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium
import truststore
from anthropic import AsyncAnthropic
from pypdf import PdfReader, PdfWriter

truststore.inject_into_ssl()  # almacén de certificados del sistema (SSL de Windows, ver 5f)

# La consola de Windows (cp1252) no codifica acentos/flechas del reporte; utf-8/replace lo evita.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
except (AttributeError, ValueError):
    pass

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(__file__).resolve().parent / "data"
RUNS_DIR = DATA_DIR / "runs"

# Modelos (IDs congelados).
SONNET = "claude-sonnet-5"
HAIKU = "claude-haiku-4-5-20251001"
VOYAGE_MULTIMODAL = "voyage-multimodal-3.5"
VOYAGE_TEXT = "voyage-3.5-lite"

# Precios USD por 1M tokens (aproximados; el USD reportado es ESTIMADO, no la factura exacta).
PRICING: dict[str, dict[str, float]] = {
    SONNET: {"in": 3.0, "out": 15.0, "cache_write": 3.75, "cache_read": 0.30},
    HAIKU: {"in": 1.0, "out": 5.0, "cache_write": 1.25, "cache_read": 0.10},
    "voyage": {"in": 0.12, "out": 0.0, "cache_write": 0.0, "cache_read": 0.0},
}


def _load_env() -> None:
    """Carga backend/.env en os.environ (claves que no estén ya definidas)."""
    env = BACKEND_DIR / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


_load_env()


def anthropic_client() -> AsyncAnthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("Falta ANTHROPIC_API_KEY en backend/.env")
    return AsyncAnthropic(api_key=key)


def require_voyage_key() -> str:
    key = os.environ.get("VOYAGE_API_KEY")
    if not key:
        raise RuntimeError("Falta VOYAGE_API_KEY en backend/.env")
    return key


@dataclass
class Usage:
    """Uso acumulable de un modelo, con su costo estimado."""

    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0
    cache_write_input_tokens: int = 0

    def add_anthropic(self, u: Any) -> None:
        self.input_tokens += getattr(u, "input_tokens", 0) or 0
        self.output_tokens += getattr(u, "output_tokens", 0) or 0
        self.cache_read_input_tokens += getattr(u, "cache_read_input_tokens", 0) or 0
        self.cache_write_input_tokens += getattr(u, "cache_creation_input_tokens", 0) or 0

    @property
    def usd(self) -> float:
        p = PRICING.get(self.model, {"in": 0, "out": 0, "cache_write": 0, "cache_read": 0})
        return round(
            (
                self.input_tokens * p["in"]
                + self.output_tokens * p["out"]
                + self.cache_read_input_tokens * p["cache_read"]
                + self.cache_write_input_tokens * p["cache_write"]
            )
            / 1_000_000,
            6,
        )


@dataclass
class RunRecord:
    """Una corrida (una pregunta × una condición). Se serializa a JSONL, todo trazable."""

    doc_id: str
    question_id: str
    category: str
    condition: str
    rep: int
    answer: str
    retrieved_pages: list[int]
    evidence_pages: list[int]
    query_usd: float
    latency_s: float
    usage: dict[str, Any]
    model_ids: dict[str, str] = field(default_factory=lambda: {"generator": SONNET})
    ts: float = field(default_factory=time.time)


def lib_versions() -> dict[str, str]:
    out = {}
    for pkg in ("lightrag-hku", "voyageai", "pypdfium2", "pypdf", "anthropic", "pydantic-ai-slim"):
        try:
            out[pkg] = version(pkg)
        except Exception:  # noqa: BLE001
            out[pkg] = "?"
    return out


def append_jsonl(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(
            json.dumps(
                asdict(obj) if hasattr(obj, "__dataclass_fields__") else obj, ensure_ascii=False
            )
            + "\n"
        )


# ── PDF: render de páginas a imagen y extracción de subconjuntos nativos ──
def page_count(pdf_bytes: bytes) -> int:
    return len(PdfReader(io.BytesIO(pdf_bytes)).pages)


def render_page_png(pdf_bytes: bytes, page_index: int, scale: float = 2.0) -> bytes:
    """Renderiza una página (0-based) a PNG con pypdfium2 (permisivo, sin AGPL)."""
    doc = pdfium.PdfDocument(pdf_bytes)
    try:
        bitmap = doc[page_index].render(scale=scale)
        pil = bitmap.to_pil()
        buffer = io.BytesIO()
        pil.save(buffer, format="PNG")
        return buffer.getvalue()
    finally:
        doc.close()


def subset_pdf(pdf_bytes: bytes, pages_1based: list[int]) -> bytes:
    """Extrae páginas (1-based) a un PDF nuevo — para enviar páginas NATIVAS al generador."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    for p in pages_1based:
        if 1 <= p <= len(reader.pages):
            writer.add_page(reader.pages[p - 1])
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()
