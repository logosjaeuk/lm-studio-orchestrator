import os
import json
import time
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from .lm_client import lm_client
from .rag_engine import rag_engine
from .dataset_builder import dataset_builder
from .orchestrator import orchestrator_engine
from .brain_memory import brain_engine
from .code_sandbox import code_sandbox
from .mcp_manager import mcp_manager

app = FastAPI(title="LM Studio Orchestrator API", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SingleChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: str = "default"
    system_prompt: Optional[str] = "당신은 지능적이고 친절한 AI 어시스턴트입니다."
    temperature: float = 0.7
    max_tokens: int = 2048
    use_rag: bool = False
    auto_learn: bool = True

class PipelineRequest(BaseModel):
    mode: str = "sequential"
    user_input: str
    agents: List[Dict[str, Any]] = []
    use_rag: bool = False
    model: str = "default"
    debate_rounds: Optional[int] = 2

class PythonExecRequest(BaseModel):
    code: str

class MCPRegisterRequest(BaseModel):
    id: str
    name: str
    type: str = "stdio"
    command: Optional[str] = ""
    url: Optional[str] = ""
    tools: List[str] = []

class MCPExecuteRequest(BaseModel):
    tool: str
    args: Dict[str, Any] = {}

class CanvasSaveRequest(BaseModel):
    name: str = "default_workflow"
    workflow: Dict[str, Any]

class AddMemoryRequest(BaseModel):
    title: str
    content: str
    category: str = "general"
    importance: float = 0.8

class AddDatasetRequest(BaseModel):
    instruction: str
    output: str
    context_input: Optional[str] = ""

class ScriptGenRequest(BaseModel):
    base_model: str = "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"
    epochs: int = 3
    lora_r: int = 16
    learning_rate: float = 2e-4

WORKFLOW_STORAGE = "./knowledge_base/saved_workflows.json"

@app.get("/api/health")
async def get_health():
    return await lm_client.check_health()

# ==========================================
# 1. 1:1 싱글 챗 플레이그라운드 API (Issue #1, #6)
# ==========================================
@app.get("/api/presets")
async def get_presets():
    return [
        {"id": "general", "name": "🤖 범용 AI 비서", "prompt": "당신은 사용자의 질문에 정확하고 명료하게 답하는 지능형 어시스턴트입니다."},
        {"id": "coder", "name": "💻 수석 소프트웨어 엔지니어", "prompt": "당신은 최고 수준의 시니어 풀스택 개발자입니다. 견고하고 최적화된 코드와 명확한 주석을 작성하세요."},
        {"id": "tutor", "name": "🎓 친절한 1:1 튜터", "prompt": "당신은 복잡한 개념을 쉬운 비유와 실생활 예시로 친절하게 설명하는 최고의 교육자입니다."},
        {"id": "architect", "name": "🏛️ 시스템 아키텍트", "prompt": "당신은 대규모 분산 시스템 설계와 확장성, 보안을 책임지는 수석 아키텍트입니다."}
    ]

@app.post("/api/single-chat/stream")
async def single_chat_stream(req: SingleChatRequest):
    async def event_generator():
        msgs = req.messages.copy()
        last_user_msg = next((m["content"] for m in reversed(msgs) if m["role"] == "user"), "")
        rag_context = ""
        if req.use_rag and last_user_msg:
            rag_context = rag_engine.get_augmented_context(last_user_msg, top_k=2)

        sys_content = req.system_prompt or "당신은 유능한 AI 어시스턴트입니다."
        if rag_context:
            sys_content += f"\n\n{rag_context}"

        full_msgs = [{"role": "system", "content": sys_content}] + msgs

        start_time = time.time()
        token_count = 0
        full_response = ""

        async for chunk in lm_client.chat_stream(full_msgs, model=req.model, temperature=req.temperature, max_tokens=req.max_tokens):
            token_count += 1
            full_response += chunk
            elapsed = max(0.001, time.time() - start_time)
            tps = round(token_count / elapsed, 1)

            payload = {
                "type": "token",
                "delta": chunk,
                "token_count": token_count,
                "tps": tps,
                "elapsed": round(elapsed, 2)
            }
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

        if req.auto_learn and len(last_user_msg) > 8 and len(full_response) > 20:
            brain_engine.add_memory(
                title=last_user_msg[:30] + "...",
                content=f"Q: {last_user_msg}\nA: {full_response[:200]}...",
                category="llm",
                importance=0.85
            )

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# ==========================================
# 2. MCP (Model Context Protocol) API (Issue #5, #7)
# ==========================================
@app.get("/api/mcp/servers")
async def get_mcp_servers():
    return {"servers": mcp_manager.servers}

@app.post("/api/mcp/servers")
async def register_mcp_server(req: MCPRegisterRequest):
    mcp_manager.servers[req.id] = {
        "name": req.name,
        "type": req.type,
        "command": req.command,
        "url": req.url,
        "enabled": True,
        "tools": req.tools or ["default_action"]
    }
    mcp_manager.save_servers()
    return {"status": "success", "server": mcp_manager.servers[req.id]}

@app.get("/api/mcp/tools")
async def get_mcp_tools():
    return {"tools": mcp_manager.get_all_tools()}

@app.post("/api/mcp/execute")
async def execute_mcp_tool(req: MCPExecuteRequest):
    res = mcp_manager.execute_tool(req.tool, req.args)
    return res

# ==========================================
# 3. 캔버스 도구 노드 & 워크플로우 API (Issue #4, #8)
# ==========================================
@app.post("/api/canvas/execute-python")
async def execute_python(req: PythonExecRequest):
    return code_sandbox.execute_python(req.code)

@app.post("/api/canvas/save")
async def save_canvas_workflow(req: CanvasSaveRequest):
    os.makedirs(os.path.dirname(WORKFLOW_STORAGE), exist_ok=True)
    workflows = {}
    if os.path.exists(WORKFLOW_STORAGE):
        try:
            with open(WORKFLOW_STORAGE, "r", encoding="utf-8") as f:
                workflows = json.load(f)
        except Exception:
            workflows = {}
    workflows[req.name] = req.workflow
    with open(WORKFLOW_STORAGE, "w", encoding="utf-8") as f:
        json.dump(workflows, f, indent=2, ensure_ascii=False)
    return {"status": "saved", "name": req.name}

@app.get("/api/canvas/workflows")
async def list_canvas_workflows():
    if os.path.exists(WORKFLOW_STORAGE):
        try:
            with open(WORKFLOW_STORAGE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

# ==========================================
# 4. 3D 브레인 지식 그래프 & 자가 학습 API
# ==========================================
@app.get("/api/brain/graph")
async def get_brain_graph():
    return brain_engine.get_3d_brain_graph()

@app.post("/api/brain/memory")
async def add_brain_memory(req: AddMemoryRequest):
    mem = brain_engine.add_memory(req.title, req.content, req.category, req.importance)
    return {"status": "success", "memory": mem}

@app.post("/api/brain/consolidate")
async def consolidate_brain_memory():
    return brain_engine.auto_consolidate()

# ==========================================
# 5. 멀티 에이전트 오케스트레이션 API
# ==========================================
@app.post("/api/orchestrate/stream")
async def orchestrate_stream(req: PipelineRequest):
    async def event_generator():
        if req.mode == "debate":
            agent_a = req.agents[0] if len(req.agents) > 0 else {"name": "Proponent", "role": "찬성/기획자", "system_prompt": "당신은 혁신적인 아이디어를 적극 제안하는 기획자입니다."}
            agent_b = req.agents[1] if len(req.agents) > 1 else {"name": "Critic", "role": "비판/검증자", "system_prompt": "당신은 현실적인 한계와 보안, 버그 가능성을 냉철하게 검증하는 아키텍트입니다."}
            judge = req.agents[2] if len(req.agents) > 2 else {"name": "Judge", "role": "총괄 심판", "system_prompt": "당신은 두 의견을 종합하여 최적의 실행 계획을 도출하는 총괄 디렉터입니다."}
            
            async for ev in orchestrator_engine.run_debate_arena(agent_a, agent_b, judge, req.user_input, req.debate_rounds or 2, req.model):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        else:
            default_agents = [
                {"name": "🧠 Planner", "role": "요구사항 분석 및 기획", "system_prompt": "당신은 사용자의 요구사항을 심층 분석하고 체계적인 구현 전략과 아키텍처를 설계하는 수석 기획자입니다."},
                {"name": "💻 Developer", "role": "실제 코드 및 산출물 작성", "system_prompt": "당신은 기획 내용을 바탕으로 견고하고 완성도 높은 실제 코드와 결과물을 작성하는 시니어 개발자입니다."},
                {"name": "🔍 Reviewer", "role": "품질 검토 및 최적화 요약", "system_prompt": "당신은 결과물을 엄격히 검토하여 엣지 케이스, 성능 최적화 포인트, 최종 요약 보고서를 작성하는 QA 리드입니다."}
            ]
            agents_to_run = req.agents if req.agents else default_agents
            async for ev in orchestrator_engine.run_sequential_pipeline(agents_to_run, req.user_input, req.use_rag, req.model):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# ==========================================
# 6. RAG 및 파인튜닝 데이터셋 API
# ==========================================
@app.get("/api/rag/stats")
async def get_rag_stats():
    return rag_engine.get_stats()

@app.post("/api/rag/upload")
async def upload_rag_document(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text = content.decode("utf-8", errors="ignore")
        chunk_count = rag_engine.add_document_text(file.filename, text, save_disk=True)
        brain_engine.add_memory(
            title=f"Doc: {file.filename}",
            content=text[:180] + "...",
            category="rag",
            importance=0.9
        )
        return {"status": "success", "filename": file.filename, "chunks_added": chunk_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/rag/search")
async def search_rag(query: str = Form(...), top_k: int = Form(3)):
    results = rag_engine.search(query, top_k=top_k)
    return {"query": query, "results": results}

@app.delete("/api/rag/clear")
async def clear_rag():
    rag_engine.clear_all()
    return {"status": "cleared"}

@app.post("/api/dataset/add")
async def add_dataset_entry(entry: AddDatasetRequest):
    dataset_builder.add_entry(entry.instruction, entry.output, entry.context_input or "")
    return {"status": "success", "total_entries": len(dataset_builder.entries)}

@app.get("/api/dataset/export")
async def export_dataset(format: str = "alpaca"):
    if format == "sharegpt":
        data = dataset_builder.export_sharegpt()
    elif format == "jsonl":
        data = dataset_builder.export_jsonl()
    else:
        data = dataset_builder.export_alpaca()
    return {"format": format, "data": data, "count": len(dataset_builder.entries)}

@app.post("/api/dataset/generate-script")
async def generate_training_script(req: ScriptGenRequest):
    script = dataset_builder.generate_unsloth_script(
        base_model=req.base_model,
        epochs=req.epochs,
        lora_r=req.lora_r,
        learning_rate=req.learning_rate
    )
    return {"script": script}

# 프론트엔드 정적 파일 서빙
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
