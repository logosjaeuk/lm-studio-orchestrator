import os
import json
import math
import re
from typing import List, Dict, Any

class RAGEngine:
    def __init__(self, storage_dir: str = "./knowledge_base"):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)
        self.doc_chunks: List[Dict[str, Any]] = []
        self.db_file = os.path.join(self.storage_dir, "rag_documents.json")
        self.load_from_disk()

    def _tokenize(self, text: str) -> List[str]:
        cleaned = re.sub(r'[^\w\s]', ' ', text.lower())
        words = cleaned.split()
        # 단어 + 2-gram 시맨틱 토큰 생성
        bigrams = [f"{words[i]}_{words[i+1]}" for i in range(len(words)-1)] if len(words) > 1 else []
        return words + bigrams

    def _build_semantic_vector(self, tokens: List[str]) -> Dict[str, float]:
        tf = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1
        # L2 정규화
        norm = math.sqrt(sum(v * v for v in tf.values()))
        if norm > 0:
            for k in tf:
                tf[k] /= norm
        return tf

    def _cosine_similarity(self, vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
        score = 0.0
        for term, val in vec_a.items():
            if term in vec_b:
                score += val * vec_b[term]
        return score

    def add_document_text(self, filename: str, text: str, chunk_size: int = 400, chunk_overlap: int = 50, save_disk: bool = True) -> int:
        paragraphs = text.split("\n\n")
        chunks = []
        curr_chunk = ""

        for p in paragraphs:
            p = p.strip()
            if not p:
                continue
            if len(curr_chunk) + len(p) <= chunk_size:
                curr_chunk += ("\n\n" if curr_chunk else "") + p
            else:
                if curr_chunk:
                    chunks.append(curr_chunk)
                curr_chunk = p

        if curr_chunk:
            chunks.append(curr_chunk)

        added = 0
        for i, c in enumerate(chunks):
            tokens = self._tokenize(c)
            vector = self._build_semantic_vector(tokens)
            self.doc_chunks.append({
                "id": f"{filename}_chunk_{i+1}",
                "filename": filename,
                "chunk_index": i + 1,
                "text": c,
                "vector": vector
            })
            added += 1

        if save_disk:
            self.save_to_disk()

        return added

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        q_tokens = self._tokenize(query)
        q_vec = self._build_semantic_vector(q_tokens)

        scored = []
        for doc in self.doc_chunks:
            sim = self._cosine_similarity(q_vec, doc["vector"])
            scored.append({
                "id": doc["id"],
                "filename": doc["filename"],
                "text": doc["text"],
                "score": round(sim, 4),
                "similarity_pct": round(sim * 100, 1)
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    def get_augmented_context(self, query: str, top_k: int = 3) -> str:
        results = self.search(query, top_k=top_k)
        if not results or results[0]["score"] == 0:
            return ""

        context_blocks = []
        for r in results:
            if r["score"] > 0:
                context_blocks.append(f"[{r['filename']} (유사도 {r['similarity_pct']}%)]:\n{r['text']}")

        return "### [참조된 RAG 로컬 지식베이스 문서]:\n" + "\n---\n".join(context_blocks)

    def save_to_disk(self):
        with open(self.db_file, "w", encoding="utf-8") as f:
            json.dump(self.doc_chunks, f, ensure_ascii=False, indent=2)

    def load_from_disk(self):
        if os.path.exists(self.db_file):
            try:
                with open(self.db_file, "r", encoding="utf-8") as f:
                    self.doc_chunks = json.load(f)
            except Exception:
                self.doc_chunks = []

    def get_stats(self) -> Dict[str, Any]:
        files = set(d["filename"] for d in self.doc_chunks)
        return {
            "total_chunks": len(self.doc_chunks),
            "total_files": len(files),
            "files": list(files)
        }

    def clear_all(self):
        self.doc_chunks = []
        if os.path.exists(self.db_file):
            os.remove(self.db_file)

rag_engine = RAGEngine()
