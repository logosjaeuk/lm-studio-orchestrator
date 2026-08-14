import os
import math
import re
from typing import List, Dict, Any

class SimpleRAGEngine:
    def __init__(self, storage_dir: str = "./knowledge_base"):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)
        self.documents: List[Dict[str, Any]] = [] # [{id, filename, chunk_text, words}]
        self.load_existing_docs()

    def load_existing_docs(self):
        """저장소 내의 기존 문서들 로드"""
        if not os.path.exists(self.storage_dir):
            return
        for fname in os.listdir(self.storage_dir):
            fpath = os.path.join(self.storage_dir, fname)
            if os.path.isfile(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        text = f.read()
                        self.add_document_text(fname, text, save_disk=False)
                except Exception as e:
                    print(f"Error loading {fname}: {e}")

    def add_document_text(self, filename: str, content: str, save_disk: bool = True) -> int:
        """문서를 청크로 분할하여 인덱스에 추가"""
        if save_disk:
            fpath = os.path.join(self.storage_dir, filename)
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(content)

        chunks = self.chunk_text(content, chunk_size=400, overlap=50)
        for idx, chunk in enumerate(chunks):
            words = set(re.findall(r'\w+', chunk.lower()))
            self.documents.append({
                "id": f"{filename}_{idx}",
                "filename": filename,
                "chunk_index": idx,
                "text": chunk,
                "words": words
            })
        return len(chunks)

    def chunk_text(self, text: str, chunk_size: int = 400, overlap: int = 50) -> List[str]:
        """지능형 텍스트 청킹"""
        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = ""

        for p in paragraphs:
            p = p.strip()
            if not p:
                continue
            if len(current_chunk) + len(p) <= chunk_size:
                current_chunk += ("\n\n" if current_chunk else "") + p
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = p[-overlap:] + "\n" + p if len(p) > chunk_size else p

        if current_chunk:
            chunks.append(current_chunk)
        return chunks if chunks else [text]

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """TF-IDF / BM25 유사도 검색"""
        if not self.documents:
            return []

        query_words = set(re.findall(r'\w+', query.lower()))
        if not query_words:
            return []

        scored = []
        doc_count = len(self.documents)

        for doc in self.documents:
            doc_words = doc["words"]
            intersection = query_words.intersection(doc_words)
            if not intersection:
                continue

            score = 0.0
            for w in intersection:
                # IDF 근사
                df = sum(1 for d in self.documents if w in d["words"])
                idf = math.log((doc_count + 1) / (df + 1)) + 1
                score += idf

            score = score / (math.sqrt(len(doc_words)) + 1e-5)
            scored.append((score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, doc in scored[:top_k]:
            results.append({
                "id": doc["id"],
                "filename": doc["filename"],
                "chunk_index": doc["chunk_index"],
                "text": doc["text"],
                "score": round(score, 4)
            })
        return results

    def get_augmented_context(self, query: str, top_k: int = 3) -> str:
        """프롬프트 주입용 RAG 컨텍스트 생성"""
        results = self.search(query, top_k)
        if not results:
            return ""

        context_str = "### [참조 문서 지식베이스 (RAG Context)]\n"
        for idx, r in enumerate(results, 1):
            context_str += f"[{idx}] 파일: {r['filename']} (관련도: {r['score']})\n{r['text']}\n---\n"
        return context_str

    def get_stats(self) -> Dict[str, Any]:
        """지식베이스 통계"""
        files = list(set(d["filename"] for d in self.documents))
        return {
            "total_chunks": len(self.documents),
            "total_files": len(files),
            "files": files
        }

    def clear_all(self):
        """지식베이스 전체 초기화"""
        self.documents = []
        for fname in os.listdir(self.storage_dir):
            try:
                os.remove(os.path.join(self.storage_dir, fname))
            except Exception:
                pass

rag_engine = SimpleRAGEngine()
