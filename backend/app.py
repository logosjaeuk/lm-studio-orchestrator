import os
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from .lm_client import lm_client
from .rag_engine import rag_engine
from .dataset_builder import dataset_builder
from .orchestrator import orchestrator_engine

app = FastAPI(title="LM Studio Orchestrator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PipelineRequest(BaseModel):
    mode: str = "sequential" # "sequential" or "debate"
    user_input: str
    agents: List[Dict[str, Any]] = []
    use_rag: bool = False
    model: str = "default"
    debate_rounds: Optional[int] = 2

class AddDatasetRequest(BaseModel):
    instruction: str
    output: str
    context_input: Optional[str] = ""

class ScriptGenRequest(BaseModel):
    base_model: str = "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"
    epochs: int = 3
    lora_r: int = 16
    learning_rate: float = 2e-4

@app.get("/api/health")
async def get_health():
    """LM Studio 헬스체크 및 모델 목록 조회"""
    return await lm_client.check_health()

@app.post("/api/orchestrate/stream")
async def orchestrate_stream(req: PipelineRequest):
    """멀티 에이전트 파이프라인 SSE 스트리밍 실행"""
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

# RAG API
@app.get("/api/rag/stats")
async def get_rag_stats():
    return rag_engine.get_stats()

@app.post("/api/rag/upload")
async def upload_rag_document(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text = content.decode("utf-8", errors="ignore")
        chunk_count = rag_engine.add_document_text(file.filename, text, save_disk=True)
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

# Dataset & LoRA API
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
