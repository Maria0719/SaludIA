"""Agente de recomendación: convierte la salida del modelo + vulnerabilidad en un
reporte accionable en lenguaje natural para una autoridad de salud municipal.

Se genera bajo demanda (cuando alguien pide la recomendación de un municipio-enfermedad
por primera vez) y se cachea en memoria mientras el proceso del backend siga vivo, para
no volver a gastar tokens en la misma combinación.
"""

from __future__ import annotations

import json

from openai import OpenAI

from app.config import OPENAI_API_KEY, OPENAI_MODEL

_cache: dict[tuple[int, str], dict] = {}
_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def _prompt(contexto: dict) -> str:
    return (
        "Eres un asesor técnico de salud pública en Colombia. A partir de este contexto real "
        "(salida de un modelo de Machine Learning de predicción de casos + un índice de "
        "vulnerabilidad territorial), redacta una recomendación breve y accionable para la "
        "autoridad de salud municipal. No inventes cifras distintas a las que te doy. "
        'Responde solo en JSON con las claves "resumen" (2-3 frases) y "acciones" '
        "(lista de 3 a 5 acciones concretas, ordenadas por prioridad).\n\n"
        f"Municipio: {contexto['municipio']} ({contexto['dpto']})\n"
        f"Enfermedad: {contexto['enfermedad']}\n"
        f"Casos predichos para la próxima semana: {contexto['casos_predichos']}\n"
        f"Nivel de alerta (semáforo): {contexto['nivel_alerta']}\n"
        f"Índice de vulnerabilidad territorial: {contexto['indice_vulnerabilidad']}/10 "
        f"(nivel {contexto['vulnerabilidad']})\n"
        f"Casos totales registrados en 2021: {contexto['total_2021']}\n"
        f"Pico histórico: {contexto['pico_casos']} casos en la semana {contexto['pico_semana']} de 2021\n"
    )


def generar_recomendacion(contexto: dict) -> dict:
    key = (contexto["cod_mpio"], contexto["enfermedad"])
    if key in _cache:
        return _cache[key]

    if _client is None:
        return {
            "disponible": False,
            "mensaje": "El agente de recomendación no está configurado: falta OPENAI_API_KEY en backend/.env (ver backend/.env.example).",
        }

    respuesta = _client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "user", "content": _prompt(contexto)}],
        response_format={"type": "json_object"},
        temperature=0.4,
    )
    datos = json.loads(respuesta.choices[0].message.content)
    resultado = {
        "disponible": True,
        "resumen": datos.get("resumen", ""),
        "acciones": datos.get("acciones", []),
    }
    _cache[key] = resultado
    return resultado
