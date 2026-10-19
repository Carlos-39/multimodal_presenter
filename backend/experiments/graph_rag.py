"""Condiciones 3 y 4: LightRAG naive (control) e hybrid (GraphRAG real) (Hito 7).

LightRAG en modo librería: LLM del grafo = Haiku (barato); embeddings de texto = Voyage. Se usa
SOLO para recuperar contexto (`only_need_context=True`); la respuesta la genera Sonnet con las
páginas NATIVAS. El contexto recuperado trae marcadores `[PÁGINA N]` → se mapea a páginas; si un
chunk perdió el marcador, se recupera por solapamiento con la transcripción por página (fallback).
"""

from __future__ import annotations

import asyncio
import re
from collections import Counter
from copy import deepcopy as _deepcopy

import numpy as np
import voyageai
from lightrag import LightRAG, QueryParam
from lightrag.addon_params import ObservableAddonParams
from lightrag.utils import EmbeddingFunc

from .common import HAIKU, VOYAGE_TEXT, Usage, anthropic_client, require_voyage_key

# HALLAZGO / workaround (declarar en el informe): LightRAG 1.5.7 crashea durante `ainsert` al hacer
# copy.deepcopy de `ObservableAddonParams` (subclase de dict que dispara `on_change` en cada
# __setitem__; al reconstruir la copia, dispara el callback sobre una instancia a medio construir →
# AttributeError '_addon_params'). Este __deepcopy__ devuelve una copia DESACOPLADA (sin observer),
# que es lo que se quiere para un snapshot de config.
if not hasattr(ObservableAddonParams, "__deepcopy__"):

    def _safe_addon_deepcopy(self, memo):  # type: ignore[no-untyped-def]
        new = ObservableAddonParams(on_change=None)
        for key, value in self.items():
            dict.__setitem__(new, key, _deepcopy(value, memo))
        return new

    ObservableAddonParams.__deepcopy__ = _safe_addon_deepcopy  # type: ignore[attr-defined]

_PAGE_RE = re.compile(r"\[PÁGINA (\d+)\]")


class GraphRAGIndex:
    def __init__(self, working_dir: str) -> None:
        require_voyage_key()
        voyage = voyageai.Client()
        self.llm_usage = Usage(model=HAIKU)  # costo de construir el grafo
        self._embed_meta = {"tokens": 0}
        self._per_page: dict[int, str] = {}

        # IMPORTANTE: LightRAG hace copy.deepcopy de su config (que incluye estas funciones). Un
        # MÉTODO LIGADO arrastraría `self` (con el cliente Voyage, que tiene un ContextVar no
        # copiable) y rompería. Se usan CLOSURES: copy.deepcopy trata las funciones como atómicas
        # (no copia sus celdas), así el deepcopy interno de LightRAG no toca objetos no copiables.
        llm_usage = self.llm_usage
        embed_meta = self._embed_meta

        async def llm_func(prompt, system_prompt=None, history_messages=None, **kwargs) -> str:
            client = anthropic_client()
            messages = [
                {"role": h.get("role", "user"), "content": h.get("content", "")}
                for h in history_messages or []
            ]
            messages.append({"role": "user", "content": prompt})
            resp = await client.messages.create(
                model=HAIKU, max_tokens=4096, system=system_prompt or "", messages=messages
            )
            llm_usage.add_anthropic(resp.usage)
            return "".join(b.text for b in resp.content if b.type == "text")

        async def embed(texts: list[str]) -> np.ndarray:
            result = await asyncio.to_thread(
                voyage.embed, texts, model=VOYAGE_TEXT, input_type="document"
            )
            embed_meta["tokens"] += getattr(result, "total_tokens", 0) or 0
            return np.array(result.embeddings, dtype=np.float32)

        self._rag = LightRAG(
            working_dir=working_dir,
            llm_model_func=llm_func,
            embedding_func=EmbeddingFunc(embedding_dim=1024, max_token_size=8192, func=embed),
            entity_extract_max_gleaning=1,  # acota el costo de extracción del grafo
            enable_llm_cache=True,
        )

    @property
    def embed_tokens(self) -> int:
        return self._embed_meta["tokens"]

    async def _init_storages(self) -> None:
        try:
            await self._rag.initialize_storages()
        except Exception:  # noqa: BLE001
            pass
        try:
            await self._rag.initialize_pipeline_status()
        except AttributeError:
            from lightrag.kg.shared_storage import initialize_pipeline_status

            await initialize_pipeline_status()

    async def build(self, transcription: str, per_page: dict[int, str]) -> None:
        self._per_page = per_page
        await self._init_storages()
        await self._rag.ainsert(transcription)  # dedup por hash: no re-extrae si ya está

    async def load(self, per_page: dict[int, str]) -> None:
        """Carga un grafo ya construido (sin re-insertar) para la fase de consultas."""
        self._per_page = per_page
        await self._init_storages()

    def _pages_from_context(self, context: str, k: int) -> list[int]:
        # Los marcadores viven en la sección de chunks del contexto; se eligen las páginas MÁS
        # citadas (frecuencia), no por orden de aparición. El presupuesto de ≤k páginas se aplica
        # aquí, sobre las páginas nativas que irán al generador (no truncando el contexto).
        counts = Counter(int(m) for m in _PAGE_RE.findall(context or ""))
        if counts:
            return sorted(p for p, _ in counts.most_common(k))
        # fallback: solapamiento léxico con la transcripción por página
        ctx = (context or "").lower()
        scored = [
            page
            for page, text in self._per_page.items()
            if (text or "")[:60].lower() and (text or "")[:60].lower() in ctx
        ]
        return sorted(scored[:k])

    async def retrieve(self, question: str, mode: str, k: int) -> list[int]:
        # NO se limita max_total_tokens: se necesita la sección de chunks (con marcadores de
        # página) para mapear a páginas nativas. El presupuesto de ≤k páginas se impone en
        # _pages_from_context; el generador solo recibe esas k páginas nativas.
        context = await self._rag.aquery(
            question,
            param=QueryParam(mode=mode, only_need_context=True, enable_rerank=False),
        )
        return self._pages_from_context(str(context), k)
