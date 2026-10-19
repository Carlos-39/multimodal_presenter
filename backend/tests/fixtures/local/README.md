# Fixtures locales (NO se commitean)

Esta carpeta es para **PDFs reales aportados** por el autor como prueba de humo del pipeline
multimodal (Hito 5f, Parte A1). Su contenido está ignorado por git (salvo este README): los
documentos reales **no** se suben al repositorio.

Solo los fixtures **sintéticos** generados por código (con verdad de referencia conocida) se
commitean, y viven fuera de esta carpeta.

## Qué dejar aquí (sugerencia)

- Un PDF con **tablas** (p. ej. *Attention Is All You Need*, arXiv 1706.03762).
- Un PDF con **gráficos/diagramas** (p. ej. *IPCC AR6 WGI, Summary for Policymakers*).
- Un PDF **escaneado** o más largo (páginas como imagen, para probar OCR real).

Mantén los PDFs **cortos** (≤ ~10 páginas) para acotar el costo de tokens; el test de humo los
lee tal cual con el modelo real.

Los tests de humo detectan automáticamente los PDFs presentes aquí y los **reportan** (secciones,
tipos, si captó tablas/diagramas, alucinaciones) sin asertar cifras. Si la carpeta está vacía,
esos casos simplemente se saltan.

## `audio/`: clips de la mini-evaluación de audio (A1)

La subcarpeta `audio/` es para los **8 clips grabados por el autor** que alimentan la
mini-evaluación de la entrada de audio (hallazgo A1 de la auditoría). Están ignorados por git
igual que los PDFs: son grabaciones con la voz del autor y **no se suben al repositorio**.

- Guion de grabación, clip por clip: `docs/Guion_Clips_Audio_A1.md`.
- Verdad de referencia (qué se diseñó en cada clip): `backend/scripts/audio_clips_manifest.json`.
- Arnés que los consume: `uv run python scripts/eval_audio_evidence.py`.

Si la carpeta está vacía o falta algún clip, el arnés **dice cuáles faltan y no corre** (no
produce una evaluación parcial que parezca completa).
