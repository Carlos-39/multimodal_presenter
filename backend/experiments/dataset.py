"""Dataset PROVISIONAL del dry run (Hito 7) — NO es ground truth validado.

Preguntas sobre "Attention Is All You Need" (arXiv 1706.03762) para validar el pipeline y medir
costo. Las respuestas de referencia y las páginas de evidencia son un mejor-esfuerzo y DEBEN ser
validadas a mano antes de cualquier corrida con valor de tesis
(el experimento completo usa su dataset validado). Categorías: factual_1hop, multi_hop,
aggregation, visual, unanswerable.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Question:
    id: str
    category: str
    question: str
    reference_answer: str
    evidence_pages: list[int]


DOC_ID = "attention_1706.03762"

QUESTIONS: list[Question] = [
    Question(
        "q1",
        "factual_1hop",
        "¿Qué optimizador se usó para entrenar el modelo y con qué parámetros beta?",
        "Adam, con beta1=0.9, beta2=0.98 y epsilon=1e-9.",
        [7],
    ),
    Question(
        "q2",
        "factual_1hop",
        "¿Cuántas capas (N) tiene el encoder del Transformer base?",
        "6 capas idénticas.",
        [3],
    ),
    Question(
        "q3",
        "multi_hop",
        "¿Cómo se relaciona la dimensión de cada cabeza de atención con d_model y el "
        "número de cabezas h?",
        "Cada cabeza usa dimensión d_k = d_v = d_model/h; con d_model=512 y h=8, d_k=64.",
        [4, 5],
    ),
    Question(
        "q4",
        "aggregation",
        "¿Qué puntajes BLEU obtuvo el Transformer (big) en las tareas EN-DE y EN-FR?",
        "28.4 BLEU en inglés-alemán (EN-DE) y 41.8 (41.0) BLEU en inglés-francés (EN-FR).",
        [8],
    ),
    Question(
        "q5",
        "visual",
        "Según la Figura 1, ¿qué dos sub-capas componen cada capa del encoder?",
        "Una sub-capa de atención multi-cabeza y una red feed-forward posicional, cada una "
        "con conexión residual y normalización.",
        [3],
    ),
    Question(
        "q6",
        "unanswerable",
        "¿Qué exactitud obtuvo el modelo en reconocimiento de voz en español?",
        "No se encuentra en el documento (el paper no trata reconocimiento de voz en español).",
        [],
    ),
]
