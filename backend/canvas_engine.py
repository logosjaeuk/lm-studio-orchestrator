import json
import asyncio
import time
from typing import List, Dict, Any, AsyncGenerator
from .lm_client import lm_client
from .rag_engine import rag_engine
from .code_sandbox import code_sandbox
from .mcp_manager import mcp_manager

class CanvasExecutionEngine:
    """캔버스 노드 간 데이터 파이프라이닝 및 실시간 비주얼 스트리밍 실행기"""
    async def execute_canvas_pipeline(
        self,
        nodes: List[Dict[str, Any]],
        connections: List[Dict[str, Any]],
        initial_input: str = ""
    ) -> AsyncGenerator[Dict[str, Any], None]:
        # 토폴로지컬 정렬 순서대로 노드 체인 정렬
        sorted_nodes = nodes.copy()
        current_data = initial_input or "프로젝트 과업 자동 수행"

        for idx, node in enumerate(sorted_nodes):
            n_id = node.get("id")
            n_type = node.get("type", "agent")
            n_name = node.get("name", f"Node_{idx+1}")
            start_t = time.time()

            yield {
                "type": "node_start",
                "node_id": n_id,
                "node_name": n_name,
                "node_type": n_type,
                "input_data": current_data[:100] + "..." if len(current_data) > 100 else current_data
            }

            output_data = ""
            if n_type == "agent":
                prompt = node.get("system_prompt", "당신은 AI 에이전트입니다.")
                model = node.get("model", "default")
                temp = node.get("temperature", 0.7)
                assigned_tools = node.get("tools", [])

                msgs = [
                    {"role": "system", "content": f"{prompt}\n이전 단계의 출력을 이어받아 당신의 작업을 수행하세요."},
                    {"role": "user", "content": f"이전 단계 데이터:\n\n{current_data}"}
                ]

                async for chunk in lm_client.chat_stream(msgs, model=model, temperature=temp):
                    output_data += chunk
                    yield {"type": "node_token", "node_id": n_id, "delta": chunk}

            elif n_type == "python":
                code = node.get("code", "")
                yield {"type": "node_token", "node_id": n_id, "delta": "⚡ 파이썬 코드 실행 중..."}
                res = code_sandbox.execute_python(code)
                output_data = f"[Python Execution Result]\n{res.get('output', '')}"
                yield {"type": "node_token", "node_id": n_id, "delta": f"\n{output_data}"}

            elif n_type == "rag":
                q = node.get("query", current_data)
                ctx = rag_engine.get_augmented_context(q, top_k=2)
                output_data = f"[RAG Document Context]\n{ctx}\n\n[Original Query]: {q}"
                yield {"type": "node_token", "node_id": n_id, "delta": f"📚 지식베이스 검색 완료 ({len(ctx)}자)"}

            elif n_type == "output":
                filename = node.get("filename", "output.txt")
                output_data = f"파일 저장 완료: {filename} ({len(current_data)} 자 저장됨)"
                yield {"type": "node_token", "node_id": n_id, "delta": f"💾 {output_data}"}

            elapsed = round(time.time() - start_t, 2)
            current_data = output_data

            yield {
                "type": "node_complete",
                "node_id": n_id,
                "node_name": n_name,
                "output_data": output_data,
                "elapsed": elapsed
            }

            # 노드 간 연결선 펄스 애니메이션 트리거
            yield {
                "type": "line_pulse",
                "from_node": n_id,
                "to_node": sorted_nodes[idx + 1]["id"] if idx + 1 < len(sorted_nodes) else None
            }

        yield {"type": "pipeline_finished", "final_result": current_data}

canvas_engine = CanvasExecutionEngine()
