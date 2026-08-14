import httpx
import json
import asyncio
from typing import List, Dict, Any, AsyncGenerator

class LMStudioClient:
    def __init__(self, base_url: str = "http://localhost:1234/v1"):
        self.base_url = base_url.rstrip("/")
        self.timeout = httpx.Timeout(120.0, connect=5.0)

    async def check_health(self) -> Dict[str, Any]:
        """LM Studio 서버 연결 상태 및 로드된 모델 조회"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.get(f"{self.base_url}/models")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("id") for m in data.get("data", [])]
                    return {
                        "connected": True,
                        "url": self.base_url,
                        "models": models,
                        "current_model": models[0] if models else "Default Model"
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
        payload = {
            "model": model,
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
                        yield f"[Error: LM Studio returned status {response.status_code}]"
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
                              f"- 모델: {model}\n" \
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
