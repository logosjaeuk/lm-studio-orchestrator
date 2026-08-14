// 멀티 LLM 프로바이더 스위처 매니저 (Issue #11)
class ProviderClientManager {
    constructor() {
        this.providerListEl = document.getElementById('providerList');
        this.modelSelectEl = document.getElementById('modelSelect');
        this.init();
    }

    init() {
        this.loadProviders();
    }

    async loadProviders() {
        try {
            const res = await fetch('/api/providers');
            const data = await res.json();
            this.renderProviders(data.providers || {});
            this.renderModelOptions(data.models || []);
        } catch (e) {
            console.error('프로바이더 로드 오류:', e);
        }
    }

    renderProviders(providers) {
        if (!this.providerListEl) return;
        this.providerListEl.innerHTML = '';

        Object.keys(providers).forEach(k => {
            const p = providers[k];
            const card = document.createElement('div');
            card.className = 'agent-msg-card';
            card.style.padding = '12px 16px';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div style="font-weight:700; font-size:13px; color:var(--text-main);">${p.name}</div>
                    <span class="node-role-badge" style="background:${p.active ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)'}; color:${p.active ? '#10B981' : '#94A3B8'};">
                        ${p.active ? '🟢 활성' : '⚪ 비활성'}
                    </span>
                </div>
                <div style="font-size:11px; font-family:monospace; color:var(--text-muted); margin-bottom:8px;">
                    ${p.base_url}
                </div>
                <div style="font-size:11px; color:var(--text-dim);">
                    타입: <strong>${p.type}</strong>
                </div>
            `;
            this.providerListEl.appendChild(card);
        });
    }

    renderModelOptions(models) {
        if (!this.modelSelectEl) return;
        this.modelSelectEl.innerHTML = '';

        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.innerText = m.name;
            this.modelSelectEl.appendChild(opt);
        });
    }
}

window.providerManager = new ProviderClientManager();
