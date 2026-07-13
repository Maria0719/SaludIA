"""Chatbot interactivo: responde preguntas en lenguaje natural sobre Dengue y Malaria
en Colombia (dónde hay más riesgo, qué anomalías hay, cómo está tal municipio, etc.)
usando OpenAI function calling — el modelo nunca inventa cifras, siempre consulta estas
herramientas contra los datos reales del backend antes de responder con un número.
"""

from __future__ import annotations

import json

from openai import OpenAI

from app.config import OPENAI_API_KEY, OPENAI_MODEL

_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

SISTEMA = (
    "Eres el asistente de datos de SaludIA, una plataforma de predicción de brotes de "
    "Dengue y Malaria en Colombia. Respondes en español, de forma breve y concreta "
    "(máximo un par de párrafos o una lista corta). NUNCA inventes cifras: para "
    "cualquier pregunta sobre municipios, casos predichos, niveles de alerta, "
    "vulnerabilidad o anomalías, usa siempre las herramientas disponibles para "
    "consultar los datos reales antes de responder. Si una herramienta no encuentra "
    "resultados, dilo explícitamente en vez de inventar un dato. Los 'casos predichos' "
    "son una predicción del modelo para la semana siguiente a la última disponible en "
    "el dataset (2018, 2019 y 2021 — no incluye 2020)."
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "ranking_riesgo",
            "description": "Devuelve los municipios con más casos predichos para la próxima semana, opcionalmente filtrado por enfermedad. Útil para preguntas como '¿dónde hay más dengue?' o '¿cuáles son los municipios con más riesgo de malaria?'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "enfermedad": {"type": "string", "enum": ["Dengue", "Malaria"]},
                    "limit": {"type": "integer", "description": "Cuántos municipios devolver", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buscar_alertas",
            "description": "Busca alertas (predicción + vulnerabilidad + semáforo) filtradas por enfermedad, departamento y/o nivel de alerta. Útil para '¿qué municipios de tal departamento están en alerta crítica?'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "enfermedad": {"type": "string", "enum": ["Dengue", "Malaria"]},
                    "dpto": {"type": "string", "description": "Nombre del departamento, en mayúsculas, ej. ANTIOQUIA"},
                    "nivel_alerta": {"type": "string", "enum": ["BAJO", "MEDIO", "ALTO", "CRÍTICO"]},
                    "limit": {"type": "integer", "default": 15},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "resumen_departamento",
            "description": "Resumen por departamento: cuántos de sus municipios están en cada nivel de alerta (BAJO/MEDIO/ALTO/CRÍTICO), opcionalmente filtrado por enfermedad. Útil para comparar departamentos entre sí.",
            "parameters": {
                "type": "object",
                "properties": {"enfermedad": {"type": "string", "enum": ["Dengue", "Malaria"]}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "info_municipio",
            "description": "Busca un municipio de Colombia por nombre y devuelve su índice de vulnerabilidad territorial y su predicción de Dengue y Malaria (si hay historial suficiente para predecir).",
            "parameters": {
                "type": "object",
                "properties": {"nombre": {"type": "string", "description": "Nombre del municipio, ej. Medellín"}},
                "required": ["nombre"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "anomalias_recientes",
            "description": "Lista anomalías (picos de casos muy por encima de lo esperado) detectadas por el modelo, opcionalmente filtradas por enfermedad y severidad.",
            "parameters": {
                "type": "object",
                "properties": {
                    "enfermedad": {"type": "string", "enum": ["Dengue", "Malaria"]},
                    "severidad": {"type": "string", "enum": ["moderate", "high", "critical"]},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
]


def _ejecutar_tool(store, nombre: str, argumentos: dict):
    if nombre == "ranking_riesgo":
        alertas = store.alertas(enfermedad=argumentos.get("enfermedad"))
        alertas = sorted(alertas, key=lambda a: a["casos_predichos"], reverse=True)
        return alertas[: argumentos.get("limit", 10)]
    if nombre == "buscar_alertas":
        alertas = store.alertas(
            enfermedad=argumentos.get("enfermedad"),
            dpto=argumentos.get("dpto"),
            nivel_alerta=argumentos.get("nivel_alerta"),
        )
        return alertas[: argumentos.get("limit", 15)]
    if nombre == "resumen_departamento":
        return store.departamentos_resumen(enfermedad=argumentos.get("enfermedad"))
    if nombre == "info_municipio":
        return store.buscar_municipio(argumentos["nombre"])
    if nombre == "anomalias_recientes":
        return store.anomalias(
            enfermedad=argumentos.get("enfermedad"),
            severidad=argumentos.get("severidad"),
            limit=argumentos.get("limit", 10),
        )
    return {"error": f"herramienta desconocida: {nombre}"}


def responder_chat(store, historial: list[dict]) -> dict:
    if _client is None:
        return {
            "disponible": False,
            "mensaje": "El chatbot no está configurado: falta OPENAI_API_KEY en backend/.env (ver backend/.env.example).",
        }

    mensajes = [{"role": "system", "content": SISTEMA}] + historial

    for _ in range(4):
        respuesta = _client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=mensajes,
            tools=TOOLS,
            temperature=0.3,
        )
        msg = respuesta.choices[0].message

        if not msg.tool_calls:
            return {"disponible": True, "respuesta": msg.content}

        mensajes.append(msg.model_dump(exclude_none=True))
        for tc in msg.tool_calls:
            argumentos = json.loads(tc.function.arguments or "{}")
            resultado = _ejecutar_tool(store, tc.function.name, argumentos)
            mensajes.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(resultado, ensure_ascii=False, default=str),
                }
            )

    return {"disponible": True, "respuesta": "No pude completar la consulta. ¿Puedes reformular la pregunta?"}
