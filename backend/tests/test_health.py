"""Test trivial del health check (Hito 0).

Verifica que la app FastAPI levanta y responde. Con Logfire en modo
`send_to_logfire="if-token-present"`, este test corre sin token en CI sin problema.
"""

from fastapi.testclient import TestClient

from smart_presenter.main import app

client = TestClient(app)


def test_health_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert "service" in body
    assert "environment" in body
