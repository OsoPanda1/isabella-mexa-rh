"""
Isabella Voice API — Sintetización de voz en español mexicano.

Voz femenina es-MX-DaliaNeural con tono cálido, elegante y sofisticado.
Servicio FastAPI independiente que se integra con Express vía HTTP.

Motor: edge-tts (gratuito, sin API key, misma voz Microsoft Neural).

Dependencias:
    pip install -r requirements.txt

Variables de entorno opcionales:
    VOICE_SHARED_KEY=clave_compartida_con_express
        Si se define, toda síntesis exige el header x-voice-key.
    ALLOWED_ORIGINS=https://tu-dominio
        Lista separada por comas. Vacío (por defecto) deshabilita CORS.
    TRUSTED_PROXIES=127.0.0.1
        Proxys cuyo x-forwarded-for se respeta para el rate limit.

Ejecutar:
    uvicorn voice_api:app --host 0.0.0.0 --port 8001

Integración con Express (server.ts):
    VOICE_API_URL=http://localhost:8001
    VOICE_SHARED_KEY=misma_clave
"""

import asyncio
import os
import sys
import time
import uuid
import html
import hmac
import logging
import tempfile
from typing import Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

load_dotenv()

APP_NAME = "Isabella Voice API"
VOICE_NAME = "es-MX-DaliaNeural"

MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "1000"))
MAX_REQUESTS_PER_MINUTE = int(os.getenv("MAX_REQUESTS_PER_MINUTE", "20"))

DEFAULT_RATE = float(os.getenv("DEFAULT_RATE", "0.92"))
DEFAULT_PITCH = int(os.getenv("DEFAULT_PITCH", "-1"))
DEFAULT_VOLUME = int(os.getenv("DEFAULT_VOLUME", "0"))

VOICE_SHARED_KEY = os.getenv("VOICE_SHARED_KEY", "").strip()
TRUSTED_PROXIES = {
    proxy.strip()
    for proxy in os.getenv("TRUSTED_PROXIES", "").split(",")
    if proxy.strip()
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(APP_NAME)

if not VOICE_SHARED_KEY:
    logger.warning(
        "VOICE_SHARED_KEY no definido: la síntesis queda abierta a cualquier "
        "cliente que alcance este puerto. Defínala en producción."
    )

app = FastAPI(
    title=APP_NAME,
    version="2.0.0",
    description=(
        "Endpoint para generar voz femenina en español mexicano "
        "con estilo elegante y cálido. Motor: edge-tts (gratuito)."
    ),
)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
origins = (
    [o.strip() for o in allowed_origins.split(",") if o.strip()]
    if allowed_origins
    else []
)
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["content-type", "x-voice-key"],
    )

REQUEST_LOG: Dict[str, List[float]] = {}


def enforce_shared_key(request: Request) -> None:
    """Constant-time check for the optional shared key."""
    if not VOICE_SHARED_KEY:
        return
    provided = request.headers.get("x-voice-key", "")
    if not hmac.compare_digest(provided, VOICE_SHARED_KEY):
        raise HTTPException(status_code=401, detail="x-voice-key inválido o ausente.")


def get_client_ip(request: Request) -> str:
    direct = request.client.host if request.client and request.client.host else "unknown"
    if direct in TRUSTED_PROXIES:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
    return direct


def enforce_rate_limit(client_ip: str) -> None:
    now = time.time()
    window_start = now - 60
    timestamps = [ts for ts in REQUEST_LOG.get(client_ip, []) if ts >= window_start]
    if len(timestamps) >= MAX_REQUESTS_PER_MINUTE:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Límite excedido. Máximo {MAX_REQUESTS_PER_MINUTE} "
                f"solicitudes por minuto."
            ),
        )
    timestamps.append(now)
    REQUEST_LOG[client_ip] = timestamps


class VoiceRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)
    rate: Optional[float] = Field(default=None, ge=0.75, le=1.25)
    pitch: Optional[int] = Field(default=None, ge=-6, le=6)
    volume: Optional[int] = Field(default=None, ge=-50, le=50)
    style: Optional[str] = Field(
        default=None,
        description="Estilo de voz: natural, serene, poetic, lucid, protective, radiant (reservado para futura implementación con SSML)",
    )


class VoiceHealthResponse(BaseModel):
    status: str
    service: str
    voice: str
    engine: str
    availability: str
    modelLoaded: bool
    checkedAt: str


class VoiceSynthesisResponse(BaseModel):
    ok: bool
    engine: str
    availability: str
    modelLoaded: bool
    profile: str
    voiceName: str
    audioUrl: Optional[str] = None
    contentType: Optional[str] = None
    meta: Optional[dict] = None


def _rate_to_edge_tts(rate: float) -> str:
    """Convert internal rate (0.75-1.25) to edge-tts format (+/-N%)."""
    pct = int(round((rate - 1.0) * 100))
    return f"{pct:+d}%"


def _pitch_to_edge_tts(pitch: int) -> str:
    """Convert internal pitch (-6..+6 semitones) to edge-tts Hz format."""
    hz = pitch * 50
    return f"{hz:+d}Hz"


def _volume_to_edge_tts(volume: int) -> str:
    """Convert internal volume (-50..+50) to edge-tts format."""
    return f"{volume:+d}%"


async def _synthesize_async(
    text: str,
    rate: float,
    pitch: int,
    volume: int,
    style: Optional[str] = None,
) -> str:
    """Synthesize speech using edge-tts (free, no API key)."""
    try:
        import edge_tts
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="edge-tts no está instalado. Ejecuta: pip install edge-tts",
        )

    rate_str = _rate_to_edge_tts(rate)
    pitch_str = _pitch_to_edge_tts(pitch)
    volume_str = _volume_to_edge_tts(volume)

    output_path = os.path.join(tempfile.gettempdir(), f"isabella_voice_{uuid.uuid4().hex}.mp3")

    try:
        communicate = edge_tts.Communicate(
            text=text.strip(),
            voice=VOICE_NAME,
            rate=rate_str,
            pitch=pitch_str,
            volume=volume_str,
        )
        await communicate.save(output_path)
        return output_path

    except Exception as exc:
        if os.path.exists(output_path):
            try:
                os.remove(output_path)
            except OSError:
                pass
        logger.exception("Error en síntesis de voz: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Error interno al generar la voz.",
        ) from exc


# --- Routes ---


@app.get("/health", response_model=VoiceHealthResponse)
def health_check() -> VoiceHealthResponse:
    try:
        import edge_tts  # noqa: F401
        available = True
    except ImportError:
        available = False

    return VoiceHealthResponse(
        status="ok",
        service=APP_NAME,
        voice=VOICE_NAME,
        engine="edge_tts",
        availability="available" if available else "degraded_missing_dependency",
        modelLoaded=available,
        checkedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )


@app.post("/synthesize")
async def synthesize(request: Request, payload: VoiceRequest) -> FileResponse:
    enforce_shared_key(request)
    client_ip = get_client_ip(request)
    enforce_rate_limit(client_ip)

    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="El texto no puede estar vacío.")
    if len(text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail=f"El texto excede el límite de {MAX_TEXT_LENGTH} caracteres.",
        )

    rate = payload.rate if payload.rate is not None else DEFAULT_RATE
    pitch = payload.pitch if payload.pitch is not None else DEFAULT_PITCH
    volume = payload.volume if payload.volume is not None else DEFAULT_VOLUME
    style = payload.style

    start = time.monotonic()
    audio_path = await _synthesize_async(text, rate, pitch, volume, style)
    elapsed_ms = int((time.monotonic() - start) * 1000)

    logger.info(
        "Synthesized %d chars in %dms for %s",
        len(text),
        elapsed_ms,
        client_ip,
    )

    return FileResponse(
        path=audio_path,
        media_type="audio/mpeg",
        filename="isabella_voice.mp3",
        background=BackgroundTask(
            lambda p=audio_path: os.path.exists(p) and os.remove(p)
        ),
        headers={
            "X-Voice-Name": VOICE_NAME,
            "X-Voice-Engine": "edge_tts",
            "X-Voice-Latency-Ms": str(elapsed_ms),
        },
    )


@app.post("/synthesize-json")
async def synthesize_json(request: Request, payload: VoiceRequest) -> JSONResponse:
    enforce_shared_key(request)
    client_ip = get_client_ip(request)
    enforce_rate_limit(client_ip)

    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="El texto no puede estar vacío.")
    if len(text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail=f"El texto excede el límite de {MAX_TEXT_LENGTH} caracteres.",
        )

    rate = payload.rate if payload.rate is not None else DEFAULT_RATE
    pitch = payload.pitch if payload.pitch is not None else DEFAULT_PITCH
    volume = payload.volume if payload.volume is not None else DEFAULT_VOLUME
    style = payload.style

    start = time.monotonic()
    audio_path = await _synthesize_async(text, rate, pitch, volume, style)
    elapsed_ms = int((time.monotonic() - start) * 1000)

    file_size = os.path.getsize(audio_path) if os.path.exists(audio_path) else 0

    import base64

    audio_b64 = ""
    if os.path.exists(audio_path):
        with open(audio_path, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("ascii")
        try:
            os.remove(audio_path)
        except OSError:
            pass

    return JSONResponse(
        content={
            "ok": True,
            "engine": "edge_tts",
            "voice": VOICE_NAME,
            "locale": "es-MX",
            "contentType": "audio/mpeg",
            "sizeBytes": file_size,
            "audioBase64": audio_b64,
            "meta": {
                "textLength": len(text),
                "rate": rate,
                "pitch": pitch,
                "volume": volume,
                "style": style,
                "latencyMs": elapsed_ms,
            },
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "status_code": exc.status_code,
            "detail": exc.detail,
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "voice_api:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8001")),
        reload=os.getenv("NODE_ENV", "development") != "production",
    )
