import json
import asyncio
import time
from typing import List, Dict, Any, AsyncGenerator
from .lm_client import lm_client
from .rag_engine import rag_engine
from .mcp_manager import mcp_manager
from .org_templates import org_manager

class HierarchicalOrchestrator:
    """최상위 조직 관리자 및 동적 부서 라우팅 오케스트레이션 엔진"""

    async def run_organization_pipeline(
        self,
        org_id: str,
        user_command: str,
        use_rag: bool = False,
        model: str = "default"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        org = org_manager.get_org(org_id)
        head = org.get("head_manager", {})
        depts = org.get("departments", [])

        # RAG 문맥 보강
        rag_context = ""
        if use_rag and user_command:
            rag_context = rag_engine.get_augmented_context(user_command, top_k=2)

        # ==========================================================
        # STEP 1: 최상위 조직 관리자(CEO/PD/편집장)의 의도 분석 및 업무 분배 계획
        # ==========================================================
        yield {
            "type": "manager_plan_start",
            "manager_name": head.get("name", "👑 총괄 관리자"),
            "manager_role": head.get("role", "조직 총괄 디렉터")
        }

        # 조직 내 모든 에이전트 목록 브리핑 문자열
        roster_lines = []
        for d in depts:
            agent_names = [f"{a['name']}({a['role']})" for a in d.get("agents", [])]
            roster_lines.append(f"- [{d['name']}]: {', '.join(agent_names)}")
        roster_str = "\n".join(roster_lines)

        plan_prompt = f"""당신은 {org.get('name')}의 {head.get('name')}입니다.
사용자로부터 다음과 같은 지시가 내려왔습니다:
\"{user_command}\"

[우리 조직의 부서 및 팀원 목록]:
{roster_str}

사용자의 목표를 완벽히 달성하기 위해, 어떤 부서의 누구에게 어떤 순서로 작업을 맡길지 총괄 디렉터의 관점에서 명확하고 카리스마 있는 업무 지시 브리핑을 3~4문장으로 작성하세요.
각 팀원에게 요구할 핵심 결과물도 함께 브리핑하세요."""

        if rag_context:
            plan_prompt += f"\n\n{rag_context}"

        plan_msgs = [
            {"role": "system", "content": head.get("system_prompt", "당신은 총괄 관리자입니다.")},
            {"role": "user", "content": plan_prompt}
        ]

        manager_plan = ""
        async for chunk in lm_client.chat_stream(plan_msgs, model=model, temperature=0.7):
            manager_plan += chunk
            yield {
                "type": "manager_plan_chunk",
                "delta": chunk
            }

        yield {
            "type": "manager_plan_complete",
            "full_plan": manager_plan
        }

        # ==========================================================
        # STEP 2: 부서별 담당 에이전트 순차 업무 수행 및 인수인계
        # ==========================================================
        cumulative_context = f"[사용자 지시사항]: {user_command}\n\n[총괄 관리자 지침]:\n{manager_plan}"

        for d_idx, dept in enumerate(depts):
            d_name = dept.get("name")
            agents = dept.get("agents", [])

            for a_idx, agent in enumerate(agents):
                a_name = agent.get("name")
                a_role = agent.get("role")
                a_prompt = agent.get("system_prompt")
                a_tools = agent.get("tools", [])

                yield {
                    "type": "agent_work_start",
                    "dept_name": d_name,
                    "agent_name": a_name,
                    "agent_role": a_role
                }

                # MCP 도구 안내 프롬프트
                tool_guide = ""
                if a_tools:
                    tool_guide = f"\n\n[사용 가능한 도구: {', '.join(a_tools)}]"

                agent_user_msg = f"""현재까지 작성된 이전 부서 작업 내용입니다:

{cumulative_context}

---
당신은 [{d_name}]의 '{a_name}({a_role})'입니다.
총괄 관리자의 지침과 이전 부서의 내용을 바탕으로, 당신의 전문 영역에 해당하는 완성도 높은 산출물을 상세히 작성하세요."""

                agent_msgs = [
                    {"role": "system", "content": f"{a_prompt}{tool_guide}"},
                    {"role": "user", "content": agent_user_msg}
                ]

                agent_output = ""
                async for chunk in lm_client.chat_stream(agent_msgs, model=model, temperature=0.5):
                    agent_output += chunk
                    yield {
                        "type": "agent_work_chunk",
                        "dept_name": d_name,
                        "agent_name": a_name,
                        "delta": chunk
                    }

                yield {
                    "type": "agent_work_complete",
                    "dept_name": d_name,
                    "agent_name": a_name,
                    "output": agent_output
                }

                # 다음 부서를 위해 누적 문맥 갱신
                cumulative_context += f"\n\n### [{d_name} - {a_name} 산출물]:\n{agent_output}"

        # ==========================================================
        # STEP 3: 최상위 관리자의 최종 검수 및 완성본 합성 (Executive Synthesis)
        # ==========================================================
        yield {
            "type": "manager_final_start",
            "manager_name": head.get("name")
        }

        final_prompt = f"""모든 부서의 업무 산출물이 접수되었습니다:

{cumulative_context}

---
당신은 {head.get('name')}입니다.
각 부서에서 올라온 결과물을 종합 검수하여, 사용자가 즉시 활용할 수 있는 '최종 완성본 패키지(Final Deliverable)'를 품격 있고 완벽한 서식으로 종합 정리하여 발표하세요."""

        final_msgs = [
            {"role": "system", "content": head.get("system_prompt", "")},
            {"role": "user", "content": final_prompt}
        ]

        final_synthesis = ""
        async for chunk in lm_client.chat_stream(final_msgs, model=model, temperature=0.6):
            final_synthesis += chunk
            yield {
                "type": "manager_final_chunk",
                "delta": chunk
            }

        yield {
            "type": "manager_final_complete",
            "final_result": final_synthesis
        }

hierarchical_orchestrator = HierarchicalOrchestrator()
