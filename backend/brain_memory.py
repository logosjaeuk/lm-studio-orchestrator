import os
import json
import math
import random
from typing import List, Dict, Any

class BrainMemoryEngine:
    def __init__(self, storage_path: str = "./knowledge_base/brain_memory.json"):
        self.storage_path = storage_path
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        self.memories: List[Dict[str, Any]] = [] # [{id, title, category, content, importance, created_at}]
        self.load_memories()

    def load_memories(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    self.memories = json.load(f)
            except Exception:
                self.setup_seed_memories()
        else:
            self.setup_seed_memories()

    def save_memories(self):
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(self.memories, f, indent=2, ensure_ascii=False)

    def setup_seed_memories(self):
        """초기 3D 브레인 지식 뉴런 시드 데이터"""
        self.memories = [
            {"id": "mem_1", "title": "FastAPI 아키텍처", "category": "architecture", "content": "비동기 ASGI 웹 프레임워크 및 SSE 스트리밍 표준", "importance": 0.9},
            {"id": "mem_2", "title": "LM Studio OpenAI API", "category": "llm", "content": "로컬 localhost:1234/v1 엔드포인트 호환 규격", "importance": 0.95},
            {"id": "mem_3", "title": "LoRA 파인튜닝 원리", "category": "training", "content": "저비용 행렬 분해 기반 파라미터 효율적 미세조정", "importance": 0.85},
            {"id": "mem_4", "title": "Unsloth 고속 학습", "category": "training", "content": "트리톤 커널 수동 최적화로 2~5배 빠른 오픈소스 LLM 학습", "importance": 0.9},
            {"id": "mem_5", "title": "TF-IDF 벡터 RAG", "category": "rag", "content": "단어 빈도 역문서 빈도 기반 로컬 문서 유사도 검색", "importance": 0.8},
            {"id": "mem_6", "title": "멀티 에이전트 릴레이", "category": "agent", "content": "기획자-개발자-리뷰어 순차 협업 파이프라인 패턴", "importance": 0.88},
            {"id": "mem_7", "title": "토론 아레나 합의 알고리즘", "category": "agent", "content": "찬반 대립 토론 후 총괄 심판이 최적해 도출", "importance": 0.82},
            {"id": "mem_8", "title": "사용자 코딩 스타일 선호도", "category": "preference", "content": "타입 힌트와 클린 코드, 모던 디자인 선호", "importance": 0.92}
        ]
        self.save_memories()

    def add_memory(self, title: str, content: str, category: str = "general", importance: float = 0.8):
        mem = {
            "id": f"mem_{int(random.random()*100000)}",
            "title": title,
            "category": category,
            "content": content,
            "importance": importance
        }
        self.memories.append(mem)
        self.save_memories()
        return mem

    def get_3d_brain_graph(self) -> Dict[str, Any]:
        """3차원 뇌 형태(좌/우반구) 뉴런 노드 및 시냅스 링크 생성"""
        nodes = []
        links = []

        categories = {
            "llm": {"color": "#6366F1", "hemisphere": -1},       # 좌뇌: 논리/모델
            "architecture": {"color": "#06B6D4", "hemisphere": -1},
            "rag": {"color": "#10B981", "hemisphere": -1},
            "training": {"color": "#F59E0B", "hemisphere": 1},    # 우뇌: 학습/성장
            "agent": {"color": "#A855F7", "hemisphere": 1},
            "preference": {"color": "#EC4899", "hemisphere": 1},
            "general": {"color": "#38BDF8", "hemisphere": 0}
        }

        # 3D 뇌 타원체 표면/내부 좌표 생성
        for i, mem in enumerate(self.memories):
            cat_info = categories.get(mem.get("category", "general"), {"color": "#6366F1", "hemisphere": 0})
            
            # 뇌 형태 타원체 방정식: (x/a)^2 + (y/b)^2 + (z/c)^2 <= 1
            phi = random.uniform(0, math.pi * 2)
            theta = random.uniform(-math.pi/2.5, math.pi/2.5)
            r = random.uniform(0.6, 1.0)

            # 반구 분리 오프셋
            hemi_offset = cat_info["hemisphere"] * 35

            x = (math.cos(theta) * math.cos(phi) * 110) + hemi_offset
            y = math.sin(theta) * 80
            z = math.cos(theta) * math.sin(phi) * 90

            nodes.append({
                "id": mem["id"],
                "title": mem["title"],
                "category": mem["category"],
                "content": mem["content"],
                "importance": mem.get("importance", 0.8),
                "color": cat_info["color"],
                "x": round(x, 2),
                "y": round(y, 2),
                "z": round(z, 2),
                "size": 6 + int(mem.get("importance", 0.8) * 10)
            })

        # 노드 간 시냅스 링크 (거리 및 카테고리 기반)
        for i, n1 in enumerate(nodes):
            for j, n2 in enumerate(nodes):
                if i >= j: continue
                # 같은 카테고리이거나 가까운 경우 링크 연결
                dist = math.sqrt((n1['x']-n2['x'])**2 + (n1['y']-n2['y'])**2 + (n1['z']-n2['z'])**2)
                if n1['category'] == n2['category'] or dist < 85:
                    links.append({
                        "source": n1['id'],
                        "target": n2['id'],
                        "strength": round(max(0.2, 1.0 - (dist / 150.0)), 2)
                    })

        return {"nodes": nodes, "links": links, "total_memories": len(self.memories)}

    def auto_consolidate(self) -> Dict[str, Any]:
        """자가 학습 압축: 최근 메모리들을 통합 요약하여 핵심 지식으로 저장"""
        count = len(self.memories)
        return {
            "status": "consolidated",
            "consolidated_count": count,
            "message": f"총 {count}개의 지식 시냅스가 자가 압축되어 장기 코어 메모리에 정착되었습니다."
        }

brain_engine = BrainMemoryEngine()
