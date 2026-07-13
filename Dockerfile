# ============================================================
#  SaludIA — Imagen única: backend (FastAPI + modelo) + frontend
#  FastAPI sirve la API Y el sitio web en el MISMO puerto.
#  Un solo comando levanta todo:  docker compose up --build
# ============================================================

# ---------- Etapa 1: compilar el frontend ----------
FROM node:22-slim AS frontend
WORKDIR /fe
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build            # deja el sitio compilado en /fe/dist


# ---------- Etapa 2: backend que sirve API + frontend ----------
FROM python:3.11-slim AS app
WORKDIR /app

# Dependencias de Python
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Código del backend (incluye el modelo .pkl en artifacts/)
COPY backend/ ./backend/

# Datos que el backend LEE en vivo (no se modifican)
COPY SaludIA/ ./SaludIA/

# Frontend ya compilado -> lo sirve FastAPI en el mismo puerto
COPY --from=frontend /fe/dist ./backend/frontend_dist

WORKDIR /app/backend
ENV PORT=8000
EXPOSE 8000

# Arranca el servidor. En Render, ${PORT} lo asigna la plataforma sola.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
