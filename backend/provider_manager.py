import os
import json
import httpx
from typing import Dict, List, Any, Optional

class ProviderManager:
    """멀티 LLM 프로바이더 매니저 (LM Studio, Ollama, vLLM, OpenAI 호환)"""
    def __init__(self, config_path: str = "./knowledge_base/providers.json"):
        self.config_path = config_path
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        self.providers: Dict[str, Any] = {}
        self.load_providers()

    def load_providers(self):
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    self.providers = json.load(f)
            except Exception:
                self.setup_default_providers()
        else:
            self.setup_default_providers()

    def save_providers(self):
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(self.providers, f, indent=2, ensure_ascii=False)

    def setup_default_providers(self):
        self.providers = {
            "lm_studio": {
                "name": "LM Studio Local",
                "type": "lm_studio",
                "base_url": "http://localhost:1234/v1",
                "active": True
            },
            "ollama": {
                "name": "Ollama Local Engine",
                "type": "ollama",
                "base_url": "http://localhost:11434/api",
                "active": True
            },
            "vllm_custom": {
                "name": "vLLM / LocalAI Endpoint",
                "type": "openai_compatible",
                "base_url": "http://localhost:8080/v1",
                "active": False
            }
        }
        self.save_providers()

    async def get_all_models(self) -> List[Dict[str, Any]]:
        """모든 활성 프로바이더로부터 로드된 모델 목록 병합 수집"""
        all_models = []

        # 1. LM Studio
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                res = await client.get(f"{self.providers['lm_studio']['base_url']}/models")
                if res.status_code == 200:
                    data = res.json()
                    for m in data.get("data", []):
                        all_models.append({
                            "id": f"lm_studio::{m['id']}",
                            "name": f"[LM Studio] {m['id']}",
                            "provider": "lm_studio",
                            "raw_id": m["id"]
                        })
        except Exception:
            pass

        # 2. Ollama
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                res = await client.get("http://localhost:11434/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    for m in data.get("models", []):
                        all_models.append({
                            "id": f"ollama::{m['name']}",
                            "name": f"[Ollama] {m['name']}",
                            "provider": "ollama",
                            "raw_id": m["name"]
                        })
        except Exception:
            pass

        if not all_models:
            all_models.append({
                "id": "default",
                "name": "기본 로컬 모델 (Default)",
                "provider": "lm_studio",
                "raw_id": "default"
            })

        return all_models

provider_manager = ProviderManager()
