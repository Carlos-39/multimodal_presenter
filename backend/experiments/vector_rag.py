"""Condición 2 — RAG vectorial multimodal por página (Hito 7).

Cada página se embebe como IMAGEN con Voyage `voyage-multimodal-3.5` (nada de texto aplanado).
En consulta, se embebe la pregunta y se recuperan las top-k páginas por similitud coseno (NumPy;
la escala no justifica un vector store dedicado). Esas páginas nativas van al generador Sonnet.
"""

from __future__ import annotations

import asyncio
import io

import numpy as np
import voyageai
from PIL import Image

from .common import VOYAGE_MULTIMODAL, page_count, render_page_png, require_voyage_key


def _cosine_topk(query: np.ndarray, matrix: np.ndarray, k: int) -> list[int]:
    q = query / (np.linalg.norm(query) + 1e-9)
    m = matrix / (np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-9)
    scores = m @ q
    return [int(i) for i in np.argsort(-scores)[:k]]


class VoyagePageIndex:
    """Índice de páginas embebidas como imagen. `retrieve` devuelve páginas 1-based."""

    def __init__(self) -> None:
        require_voyage_key()
        self._client = voyageai.Client()
        self._page_vectors: np.ndarray | None = None
        self.index_tokens = 0

    async def index(self, pdf_bytes: bytes) -> None:
        n = page_count(pdf_bytes)
        images = [
            Image.open(io.BytesIO(render_page_png(pdf_bytes, i))).convert("RGB") for i in range(n)
        ]
        vectors: list[list[float]] = []
        for start in range(0, n, 4):  # lotes pequeños (las imágenes pesan)
            batch = images[start : start + 4]
            result = await asyncio.to_thread(
                self._client.multimodal_embed,
                inputs=[[img] for img in batch],
                model=VOYAGE_MULTIMODAL,
                input_type="document",
            )
            vectors.extend(result.embeddings)
            self.index_tokens += getattr(result, "total_tokens", 0) or 0
        self._page_vectors = np.array(vectors, dtype=np.float32)

    def save(self, path) -> None:
        import numpy as _np

        if self._page_vectors is not None:
            _np.save(str(path), self._page_vectors)

    def load(self, path) -> None:
        import numpy as _np

        self._page_vectors = _np.load(str(path))

    async def retrieve(self, question: str, k: int) -> list[int]:
        if self._page_vectors is None:
            raise RuntimeError("Índice vacío: llama a index() o load() primero.")
        result = await asyncio.to_thread(
            self._client.multimodal_embed,
            inputs=[[question]],
            model=VOYAGE_MULTIMODAL,
            input_type="query",
        )
        self.index_tokens += getattr(result, "total_tokens", 0) or 0
        query_vec = np.array(result.embeddings[0], dtype=np.float32)
        idxs = _cosine_topk(query_vec, self._page_vectors, k)
        return sorted(i + 1 for i in idxs)  # 1-based
