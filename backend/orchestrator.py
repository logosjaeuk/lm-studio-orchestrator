import json
import asyncio
from typing import List, Dict, Any, AsyncGenerator
from .lm_client import lm_client
from .rag_engine import rag_engine

class AgentNode:
    def __init__(self, id: str, name: str, role: str, system_prompt: str, model: str = "default", temperature: float = 0.7):
        self.id = id
        self.name = name
        self.role = role
        self.system_prompt = system_prompt
        self.model = model
        self.temperature = temperature

class OrchestrationEngine:
    def __init__(self):
        pass

    async def run_sequential_pipeline(
        self,
        agents: List[Dict[str, Any]],
        user_input: str,
        use_rag: bool = False,
        model: str = "default"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """순차 릴레이 체인 실행 (SSE 스트리밍 이벤트 생성)"""
        current_context = user_input

        # 1. RAG 검색이 활성화된 경우
        if use_rag:
            yield {"type": "step_start", "agent": "📚 Local RAG", "role": "지식베이스 검색 중..."}
            rag_context = rag_engine.get_augmented_context(user_input, top_k=3)
            if rag_context:
                current_context = f"{rag_context}\n\n[사용자 요청]:\n{user_input}"
                yield {"type": "token", "agent": "📚 Local RAG", "delta": f"지식베이스에서 관련 문서 청크를 성공적으로 추출하여 프롬프트에 주입했습니다.\n\n"}
            else:
                yield {"type": "token", "agent": "📚 Local RAG", "delta": "관련 문서를 찾지 못해 기본 입력으로 진행합니다.\n\n"}
            yield {"type": "step_end", "agent": "📚 Local RAG", "output": rag_context}

        # 2. 에이전트 릴레이 실행
        for idx, agent_data in enumerate(agents):
            agent_name = agent_data.get("name", f"Agent {idx+1}")
            agent_role = agent_data.get("role", "도우미")
            system_prompt = agent_data.get("system_prompt", "당신은 유능한 AI 어시스턴트입니다.")
            agent_model = agent_data.get("model", model)
            temp = float(agent_data.get("temperature", 0.7))

            yield {
                "type": "step_start",
                "agent": agent_name,
                "role": agent_role,
                "step_index": idx + 1,
                "total_steps": len(agents)
            }

            # 메시지 구성
            prompt_content = f"이전 단계 산출물 및 지시사항:\n{current_context}\n\n당신의 역할({agent_role})에 맞게 완성도 높은 결과를 생성하세요."
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt_content}
            ]

            step_output = ""
            async for chunk in lm_client.chat_stream(messages, model=agent_model, temperature=temp):
                step_output += chunk
                yield {"type": "token", "agent": agent_name, "delta": chunk}

            current_context = step_output
            yield {"type": "step_end", "agent": agent_name, "output": step_output}

        yield {"type": "pipeline_complete", "final_result": current_context}

    async def run_debate_arena(
        self,
        agent_a: Dict[str, Any],
        agent_b: Dict[str, Any],
        judge: Dict[str, Any],
        topic: str,
        rounds: int = 2,
        model: str = "default"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """두 에이전트의 턴제 토론 & 심판 종합"""
        yield {"type": "debate_start", "topic": topic}
        history = f"[토론 주제]: {topic}\n\n"

        for r in range(1, rounds + 1):
            # Agent A 발언
            yield {"type": "step_start", "agent": agent_a['name'], "role": f"Round {r} - {agent_a['role']}"}
            messages_a = [
                {"role": "system", "content": agent_a.get("system_prompt", "")},
                {"role": "user", "content": f"{history}\n당신의 입장({agent_a['role']})에서 논리적인 주장을 펼치세요."}
            ]
            resp_a = ""
            async for chunk in lm_client.chat_stream(messages_a, model=model):
                resp_a += chunk
                yield {"type": "token", "agent": agent_a['name'], "delta": chunk}
            history += f"\n[{agent_a['name']}]: {resp_a}\n"
            yield {"type": "step_end", "agent": agent_a['name'], "output": resp_a}

            # Agent B 발언
            yield {"type": "step_start", "agent": agent_b['name'], "role": f"Round {r} - {agent_b['role']}"}
            messages_b = [
                {"role": "system", "content": agent_b.get("system_prompt", "")},
                {"role": "user", "content": f"{history}\n상대방의 주장을 반박하거나 보완하는 의견을 제시하세요."}
            ]
            resp_b = ""
            async for chunk in lm_client.chat_stream(messages_b, model=model):
                resp_b += chunk
                yield {"type": "token", "agent": agent_b['name'], "delta": chunk}
            history += f"\n[{agent_b['name']}]: {resp_b}\n"
            yield {"type": "step_end", "agent": agent_b['name'], "output": resp_b}

        # 심판(Judge) 최종 종합
        yield {"type": "step_start", "agent": judge['name'], "role": "최종 판정 및 솔루션 종합"}
        messages_judge = [
            {"role": "system", "content": judge.get("system_prompt", "당신은 공정한 토론 심판 및 총괄 기획자입니다.")},
            {"role": "user", "content": f"다음 토론 내용을 평가하고 최선의 합의된 결론을 도출하세요:\n\n{history}"}
        ]
        final_judge = ""
        async for chunk in lm_client.chat_stream(messages_judge, model=model):
            final_judge += chunk
            yield {"type": "token", "agent": judge['name'], "delta": chunk}
        yield {"type": "step_end", "agent": judge['name'], "output": final_judge}
        yield {"type": "debate_complete", "final_result": final_judge}

orchestrator_engine = OrchestrationEngine()
