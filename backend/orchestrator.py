import json
import re
from typing import List, Dict, Any, AsyncGenerator
from .lm_client import lm_client
from .rag_engine import rag_engine
from .mcp_manager import mcp_manager

class OrchestrationEngine:
    async def run_sequential_pipeline(
        self,
        agents: List[Dict[str, Any]],
        user_task: str,
        use_rag: bool = False,
        model: str = "default"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """순차적 에이전트 협업 릴레이 + 독립 MCP 도구 호출 지원"""
        context_accumulator = f"## 최초 사용자 요청 과업:\n{user_task}\n"
        
        # RAG 맥락 주입
        if use_rag:
            rag_context = rag_engine.get_augmented_context(user_task, top_k=2)
            if rag_context:
                context_accumulator += f"\n{rag_context}\n"

        for i, agent in enumerate(agents):
            agent_name = agent.get("name", f"Agent_{i+1}")
            agent_role = agent.get("role", "Collaborator")
            base_prompt = agent.get("system_prompt", "당신은 AI 에이전트입니다.")
            assigned_tools = agent.get("tools", []) # 에이전트별 독립 MCP 도구 목록
            agent_model = agent.get("model") or model
            temp = agent.get("temperature", 0.7)

            yield {
                "type": "step_start",
                "step": i + 1,
                "total_steps": len(agents),
                "agent": agent_name,
                "role": agent_role
            }

            # 도구 스키마 프롬프트 빌드
            tool_prompt = ""
            available_tools = [t for t in mcp_manager.get_all_tools() if t["name"] in assigned_tools]
            if available_tools:
                tool_prompt = "\n\n### 사용할 수 있는 MCP 도구 목록:\n"
                for t in available_tools:
                    tool_prompt += f"- `{t['name']}`: {t['description']}\n"
                tool_prompt += "\n도구를 실행해야 할 경우 다음과 같은 JSON 형식으로만 단독 출력하세요:\n"
                tool_prompt += '```json\n{"action": "tool_call", "tool": "도구이름", "args": {"파라미터": "값"}}\n```\n'

            system_instruction = f"{base_prompt}\n\n당신의 역할은 [{agent_role}]입니다. 이전 단계까지의 맥락을 검토하고 맡은 과업을 완성하세요.{tool_prompt}"

            messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": f"현재까지 진행된 작업 맥락:\n\n{context_accumulator}\n\n위 내용을 이어받아 [{agent_name}]로서 당신의 산출물을 작성하세요."}
            ]

            agent_response = ""
            async for chunk in lm_client.chat_stream(messages, model=agent_model, temperature=temp):
                agent_response += chunk
                yield {"type": "token", "agent": agent_name, "delta": chunk}

            # 도구 호출(Tool Call) 감지 및 실행 루프
            if '{"action": "tool_call"' in agent_response:
                try:
                    match = re.search(r'\{"action":\s*"tool_call",\s*"tool":\s*"([^"]+)",\s*"args":\s*(\{.*?\})\}', agent_response, re.DOTALL)
                    if match:
                        tool_name = match.group(1)
                        tool_args = json.loads(match.group(2))
                        yield {"type": "token", "agent": agent_name, "delta": f"\n\n⚙️ *[MCP 도구 실행 중: `{tool_name}`]...*\n"}
                        
                        tool_res = mcp_manager.execute_tool(tool_name, tool_args)
                        tool_output_str = json.dumps(tool_res, ensure_ascii=False)
                        
                        # 도구 실행 결과를 반영한 후속 완성 호출
                        yield {"type": "token", "agent": agent_name, "delta": f"✅ *[도구 실행 결과]*:\n```\n{tool_output_str}\n```\n\n"}
                        
                        followup_msgs = messages + [
                            {"role": "assistant", "content": agent_response},
                            {"role": "user", "content": f"도구 실행 결과입니다:\n{tool_output_str}\n\n이 결과를 바탕으로 최종 결론 및 산출물을 완성하세요."}
                        ]
                        
                        async for chunk in lm_client.chat_stream(followup_msgs, model=agent_model, temperature=temp):
                            agent_response += chunk
                            yield {"type": "token", "agent": agent_name, "delta": chunk}
                except Exception as e:
                    yield {"type": "token", "agent": agent_name, "delta": f"\n[도구 실행 오류: {str(e)}]\n"}

            yield {
                "type": "step_end",
                "step": i + 1,
                "agent": agent_name,
                "output": agent_response
            }

            context_accumulator += f"\n\n### [{agent_name} ({agent_role})] 산출물:\n{agent_response}\n"

    async def run_debate_arena(
        self,
        agent_a: Dict[str, Any],
        agent_b: Dict[str, Any],
        judge_agent: Dict[str, Any],
        topic: str,
        rounds: int = 2,
        model: str = "default"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """토론형 아레나 파이프라인"""
        debate_history = f"## 토론 주제: {topic}\n"

        for r in range(rounds):
            # Agent A 발언
            yield {"type": "step_start", "agent": agent_a.get("name", "Proponent"), "role": f"찬성/발제 (라운드 {r+1})"}
            msgs_a = [
                {"role": "system", "content": f"{agent_a.get('system_prompt', '당신은 찬성측입니다.')}\n토론 주제에 대해 강력한 논거를 제시하세요."},
                {"role": "user", "content": f"현재 토론 진행 상황:\n{debate_history}\n\n발언하세요."}
            ]
            resp_a = ""
            async for chunk in lm_client.chat_stream(msgs_a, model=model):
                resp_a += chunk
                yield {"type": "token", "agent": agent_a.get("name", "Proponent"), "delta": chunk}
            debate_history += f"\n[{agent_a.get('name', 'Proponent')} (R{r+1})]:\n{resp_a}\n"

            # Agent B 반론
            yield {"type": "step_start", "agent": agent_b.get("name", "Critic"), "role": f"비판/반론 (라운드 {r+1})"}
            msgs_b = [
                {"role": "system", "content": f"{agent_b.get('system_prompt', '당신은 반대측입니다.')}\n상대의 취약점과 리스크를 조목조목 지적하세요."},
                {"role": "user", "content": f"현재 토론 진행 상황:\n{debate_history}\n\n반론하세요."}
            ]
            resp_b = ""
            async for chunk in lm_client.chat_stream(msgs_b, model=model):
                resp_b += chunk
                yield {"type": "token", "agent": agent_b.get("name", "Critic"), "delta": chunk}
            debate_history += f"\n[{agent_b.get('name', 'Critic')} (R{r+1})]:\n{resp_b}\n"

        # Judge 판결
        yield {"type": "step_start", "agent": judge_agent.get("name", "Judge"), "role": "총괄 심판 및 최적 합의안 도출"}
        msgs_judge = [
            {"role": "system", "content": f"{judge_agent.get('system_prompt', '당신은 총괄 심판입니다.')}\n양측의 토론을 분석하여 최선의 실행 가능한 솔루션을 판결하세요."},
            {"role": "user", "content": f"전체 토론 기록:\n{debate_history}\n\n최종 판결과 합의안을 작성하세요."}
        ]
        async for chunk in lm_client.chat_stream(msgs_judge, model=model):
            yield {"type": "token", "agent": judge_agent.get("name", "Judge"), "delta": chunk}

orchestrator_engine = OrchestrationEngine()
