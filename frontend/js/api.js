// LM Studio Orchestrator API 클라이언트
class APIClient {
    constructor(baseUrl = "") {
        this.baseUrl = baseUrl;
    }

    async getHealth() {
        try {
            const res = await fetch(`${this.baseUrl}/api/health`);
            return await res.json();
        } catch (e) {
            return { connected: false, models: [], error: e.message };
        }
    }

    async streamPipeline(payload, onEvent, onComplete, onError) {
        try {
            const response = await fetch(`${this.baseUrl}/api/orchestrate/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop(); // 남은 불완전한 라인 보관

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const raw = line.slice(6).trim();
                        if (raw === "[DONE]") {
                            if (onComplete) onComplete();
                            return;
                        }
                        try {
                            const data = JSON.parse(raw);
                            if (onEvent) onEvent(data);
                        } catch (err) {
                            console.error("SSE JSON parse error:", err, raw);
                        }
                    }
                }
            }
            if (onComplete) onComplete();
        } catch (e) {
            if (onError) onError(e);
        }
    }

    async getRAGStats() {
        const res = await fetch(`${this.baseUrl}/api/rag/stats`);
        return await res.json();
    }

    async uploadRAGDoc(file) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${this.baseUrl}/api/rag/upload`, {
            method: "POST",
            body: formData
        });
        return await res.json();
    }

    async searchRAG(query) {
        const formData = new FormData();
        formData.append("query", query);
        const res = await fetch(`${this.baseUrl}/api/rag/search`, {
            method: "POST",
            body: formData
        });
        return await res.json();
    }

    async clearRAG() {
        const res = await fetch(`${this.baseUrl}/api/rag/clear`, { method: "DELETE" });
        return await res.json();
    }

    async addDataset(entry) {
        const res = await fetch(`${this.baseUrl}/api/dataset/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry)
        });
        return await res.json();
    }

    async exportDataset(format) {
        const res = await fetch(`${this.baseUrl}/api/dataset/export?format=${format}`);
        return await res.json();
    }

    async generateTrainingScript(params) {
        const res = await fetch(`${this.baseUrl}/api/dataset/generate-script`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params)
        });
        return await res.json();
    }
}

window.apiClient = new APIClient();
