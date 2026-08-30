"""
Tests para Isabella Voice API (edge-tts engine).

Ejecutar:
    python -m pytest test_voice_api.py -v

O directamente:
    python test_voice_api.py
"""

import os
import sys
import json
import time
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient


def _make_client() -> Any:
    from voice_api import app

    return TestClient(app)


class TestVoiceHealth(unittest.TestCase):
    def setUp(self):
        self.client = _make_client()

    def test_health_returns_ok(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["voice"], "es-MX-DaliaNeural")
        self.assertEqual(data["engine"], "edge_tts")
        self.assertIn("availability", data)
        self.assertIn("checkedAt", data)

    def test_health_reports_model_loaded(self):
        resp = self.client.get("/health")
        data = resp.json()
        self.assertIn(data["modelLoaded"], [True, False])


class TestVoiceSynthesize(unittest.TestCase):
    def setUp(self):
        self.client = _make_client()

    @patch("voice_api._synthesize_async", new_callable=AsyncMock)
    def test_synthesize_returns_audio(self, mock_synth: AsyncMock):
        import tempfile

        mock_file = os.path.join(tempfile.gettempdir(), "test_voice_mock.mp3")
        with open(mock_file, "wb") as f:
            f.write(b"\xff\xfb\x90\x00" + b"\x00" * 100)
        mock_synth.return_value = mock_file

        resp = self.client.post(
            "/synthesize",
            json={"text": "Hola, soy Isabella.", "rate": 0.92, "pitch": -1},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("audio/mpeg", resp.headers.get("content-type", ""))
        self.assertIn("X-Voice-Name", resp.headers)
        self.assertIn("X-Voice-Latency-Ms", resp.headers)

    def test_synthesize_empty_text_returns_400(self):
        resp = self.client.post("/synthesize", json={"text": ""})
        self.assertEqual(resp.status_code, 422)

    def test_synthesize_missing_text_returns_422(self):
        resp = self.client.post("/synthesize", json={})
        self.assertEqual(resp.status_code, 422)

    @patch("voice_api._synthesize_async", new_callable=AsyncMock)
    def test_synthesize_json_returns_base64(self, mock_synth: AsyncMock):
        import tempfile
        import base64

        mock_file = os.path.join(tempfile.gettempdir(), "test_voice_json.mp3")
        audio_content = b"\xff\xfb\x90\x00" + b"\x00" * 50
        with open(mock_file, "wb") as f:
            f.write(audio_content)
        mock_synth.return_value = mock_file

        resp = self.client.post(
            "/synthesize-json",
            json={"text": "Prueba de audio.", "rate": 0.95},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["ok"])
        self.assertEqual(data["engine"], "edge_tts")
        self.assertEqual(data["voice"], "es-MX-DaliaNeural")
        self.assertIn("audioBase64", data)
        self.assertIn("meta", data)
        self.assertIn("latencyMs", data["meta"])

    @patch("voice_api._synthesize_async", new_callable=AsyncMock)
    def test_synthesize_with_style(self, mock_synth: AsyncMock):
        import tempfile

        mock_file = os.path.join(tempfile.gettempdir(), "test_voice_style.mp3")
        with open(mock_file, "wb") as f:
            f.write(b"\xff\xfb\x90\x00" + b"\x00" * 100)
        mock_synth.return_value = mock_file

        resp = self.client.post(
            "/synthesize",
            json={"text": "Voz poética.", "style": "poetic"},
        )
        self.assertEqual(resp.status_code, 200)

    def test_synthesize_long_text_returns_413(self):
        resp = self.client.post(
            "/synthesize",
            json={"text": "x" * 1500},
        )
        self.assertEqual(resp.status_code, 413)

    def test_rate_limit_enforced(self):
        for i in range(21):
            resp = self.client.post(
                "/synthesize",
                json={"text": f"Mensaje {i}"},
            )
            if resp.status_code == 429:
                self.assertIn("Límite", resp.json()["detail"])
                return
        self.fail("Rate limit was not triggered after 21 requests")


class TestEdgeTTSConversion(unittest.TestCase):
    def test_rate_conversion(self):
        from voice_api import _rate_to_edge_tts

        self.assertEqual(_rate_to_edge_tts(0.92), "-8%")
        self.assertEqual(_rate_to_edge_tts(1.10), "+10%")
        self.assertEqual(_rate_to_edge_tts(1.0), "+0%")
        self.assertEqual(_rate_to_edge_tts(0.75), "-25%")
        self.assertEqual(_rate_to_edge_tts(1.25), "+25%")

    def test_pitch_conversion(self):
        from voice_api import _pitch_to_edge_tts

        self.assertEqual(_pitch_to_edge_tts(-1), "-50Hz")
        self.assertEqual(_pitch_to_edge_tts(0), "+0Hz")
        self.assertEqual(_pitch_to_edge_tts(4), "+200Hz")
        self.assertEqual(_pitch_to_edge_tts(-3), "-150Hz")

    def test_volume_conversion(self):
        from voice_api import _volume_to_edge_tts

        self.assertEqual(_volume_to_edge_tts(0), "+0%")
        self.assertEqual(_volume_to_edge_tts(-50), "-50%")
        self.assertEqual(_volume_to_edge_tts(50), "+50%")


if __name__ == "__main__":
    unittest.main(verbosity=2)
