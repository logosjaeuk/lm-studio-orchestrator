import httpx
import json
import asyncio
from typing import List, Dict, Any, AsyncGenerator, Optional

class LMStudioClient:
    def __init__(self, base_url: str = "http://localhost:1234/v1"):
        self.base_url = base_url.rstrip("/")
        self.timeout = httpx.Timeout(120.0, connect=5.0)
        self._cached_model: Optional[str] = None

    async def get_active_model(self) -> str:
        """LM Studio에서 현재 로드된 첫 번째 텍스트 생성 모델 ID를 동적으로 검색"""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{self.base_url}/models")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("id") for m in data.get("data", []) if "embed" not in m.get("id", "").lower()]
                    if models:
                        self._cached_model = models[0]
                        return models[0]
        except Exception:
            pass
        return self._cached_model or "google/gemma-4-e4b"

    async def check_health(self) -> Dict[str, Any]:
        """LM Studio 서버 연결 상태 및 로드된 모델 조회"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.get(f"{self.base_url}/models")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("id") for m in data.get("data", [])]
                    active_models = [m for m in models if "embed" not in m.lower()]
                    curr = active_models[0] if active_models else (models[0] if models else "Default Model")
                    self._cached_model = curr
                    return {
                        "connected": True,
                        "url": self.base_url,
                        "models": models,
                        "current_model": curr
                    }
        except Exception as e:
            return {
                "connected": False,
                "url": self.base_url,
                "error": str(e),
                "models": ["mock-qwen-2.5-7b", "mock-llama-3.1-8b", "mock-mistral-nemo"],
                "current_model": "mock-qwen-2.5-7b (Offline Simulation)"
            }

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = "default",
        temperature: float = 0.7,
        max_tokens: int = 2048,
        top_p: float = 0.95
    ) -> AsyncGenerator[str, None]:
        """LM Studio SSE 실시간 스트리밍 대화"""
        # 모델 파라미터 정규화 (default 또는 provider prefix 처리)
        target_model = model
        if target_model.startswith("lm_studio::"):
            target_model = target_model.replace("lm_studio::", "")
        elif target_model.startswith("ollama::"):
            target_model = target_model.replace("ollama::", "")

        if not target_model or target_model == "default":
            target_model = await self.get_active_model()

        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "stream": True
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("POST", f"{self.base_url}/chat/completions", json=payload) as response:
                    if response.status_code != 200:
                        error_body = await response.aread()
                        err_msg = error_body.decode('utf-8', errors='ignore')
                        yield f"[LM Studio Error {response.status_code}]: {err_msg}"
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            raw_data = line[6:].strip()
                            if raw_data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(raw_data)
                                delta = chunk["choices"][0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                            except Exception:
                                continue
        except Exception as e:
            # LM Studio 미가동 시 시뮬레이션 스트리밍 (테스트용)
            simulated_reply = f"[LM Studio Offline Simulation Mode]\n\n" \
                              f"수신된 프롬프트 요청을 분석했습니다.\n" \
                              f"- 모델: {target_model}\n" \
                              f"- 역할: {messages[-1].get('role', 'user')}\n" \
                              f"- 내용 요약: {messages[-1].get('content', '')[:120]}...\n\n" \
                              f"👉 *LM Studio 로컬 서버(http://localhost:1234)를 실행하시면 실제 로컬 LLM 가중치로 답변이 실시간 생성됩니다.*"
            for token in simulated_reply.split(" "):
                yield token + " "
                await asyncio.sleep(0.04)

    async def chat_complete(
        self,
        messages: List[Dict[str, str]],
        model: str = "default",
        temperature: float = 0.7,
        max_tokens: int = 2048
    ) -> str:
        """단일 완료 응답"""
        full_text = ""
        async for chunk in self.chat_stream(messages, model, temperature, max_tokens):
            full_text += chunk
        return full_text

lm_client = LMStudioClient()
