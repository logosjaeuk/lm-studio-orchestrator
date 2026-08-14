// 범용 계층형 조직 오케스트레이터 프론트엔드 엔진 (Issue #13)
class OrgOrchestrator {
    constructor() {
        this.orgSelect = document.getElementById('orgTemplateSelect');
        this.orgDesc = document.getElementById('orgDescText');
        this.orgStructureView = document.getElementById('orgStructureView');
        this.messagesList = document.getElementById('orgMessagesList');
        this.promptInput = document.getElementById('orgPromptInput');
        this.sendBtn = document.getElementById('orgSendBtn');
        this.stopBtn = document.getElementById('orgStopBtn');
        this.ragToggle = document.getElementById('orgRagToggle');

        this.organizations = {};
        this.currentOrgId = 'youtube_studio';
        this.isStreaming = false;
        this.abortController = null;

        this.init();
    }

    async init() {
        await this.loadOrganizations();
    }

    async loadOrganizations() {
        try {
            const res = await fetch('/api/org/templates');
            const data = await res.json();
            this.organizations = data.organizations || {};
            this.renderOrgSelect();
            this.updateOrgDisplay();
        } catch (e) {
            console.error('조직 템플릿 로드 실패:', e);
        }
    }

    renderOrgSelect() {
        if (!this.orgSelect) return;
        this.orgSelect.innerHTML = '';
        Object.keys(this.organizations).forEach(k => {
            const o = this.organizations[k];
            const opt = document.createElement('option');
            opt.value = k;
            opt.innerText = o.name;
            this.orgSelect.appendChild(opt);
        });
        this.orgSelect.value = this.currentOrgId;
    }

    changeOrg(orgId) {
        this.currentOrgId = orgId;
        this.updateOrgDisplay();
    }

    updateOrgDisplay() {
        const org = this.organizations[this.currentOrgId];
        if (!org) return;

        if (this.orgDesc) this.orgDesc.innerText = org.description;

        if (this.orgStructureView) {
            this.orgStructureView.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; background:rgba(99,102,241,0.1); padding:10px 14px; border-radius:8px; border:1px solid rgba(99,102,241,0.3);">
                    <div>
                        <div style="font-weight:800; font-size:13px; color:var(--primary);">${org.head_manager.name}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${org.head_manager.role}</div>
                    </div>
                    <span class="node-role-badge" style="background:var(--primary); color:#fff;">최상위 조직 관리자</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
                    ${org.departments.map(d => `
                        <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; padding:10px;">
                            <div style="font-weight:700; font-size:12px; color:var(--accent-cyan); margin-bottom:6px;">${d.name}</div>
                            <div style="display:flex; flex-direction:column; gap:4px;">
                                ${d.agents.map(a => `
                                    <div style="font-size:11px; color:var(--text-muted); display:flex; justify-content:space-between;">
                                        <span>• ${a.name}</span>
                                        <span style="font-size:10px; color:var(--text-dim);">${a.role}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    stopOrchestration() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.setStreamingState(false);
    }

    setStreamingState(streaming) {
        this.isStreaming = streaming;
        if (this.sendBtn) this.sendBtn.style.display = streaming ? 'none' : 'flex';
        if (this.stopBtn) this.stopBtn.style.display = streaming ? 'flex' : 'none';
        if (this.promptInput) this.promptInput.disabled = streaming;
    }

    async startOrchestration() {
        if (this.isStreaming || !this.promptInput) return;
        const text = this.promptInput.value.trim();
        if (!text) return;

        const org = this.organizations[this.currentOrgId];
        if (!org) return;

        this.setStreamingState(true);
        this.abortController = new AbortController();

        // 1. 사용자 명령 카드 추가
        const userCard = document.createElement('div');
        userCard.className = 'agent-msg-card';
        userCard.innerHTML = `
            <div class="agent-msg-header">
                <div class="agent-info"><span>👤</span><span>나 (User)</span></div>
                <span class="node-role-badge">조직 총괄 지시</span>
            </div>
            <div class="msg-content" style="font-weight:600; color:var(--text-main);">${text}</div>
        `;
        this.messagesList.appendChild(userCard);
        this.promptInput.value = '';
        this.scrollToBottom();

        // 2. 관리자 브리핑 카드 컨테이너 준비
        let currentTargetEl = null;

        try {
            const useRag = this.ragToggle ? this.ragToggle.checked : false;
            const selectedModel = document.getElementById('modelSelect')?.value || "default";

            const res = await fetch('/api/org/orchestrate/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: this.abortController.signal,
                body: JSON.stringify({
                    org_id: this.currentOrgId,
                    user_command: text,
                    use_rag: useRag,
                    model: selectedModel
                })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const ev = JSON.parse(dataStr);
                            
                            // 1. 관리자 계획 수립 시작
                            if (ev.type === 'manager_plan_start') {
                                const card = document.createElement('div');
                                card.className = 'agent-msg-card';
                                card.style.borderLeft = '4px solid var(--primary)';
                                card.innerHTML = `
                                    <div class="agent-msg-header">
                                        <div class="agent-info"><span style="font-size:16px;">👑</span><span>${ev.manager_name}</span></div>
                                        <span class="node-role-badge" style="background:var(--primary); color:#fff;">업무 분배 지침 수립</span>
                                    </div>
                                    <div class="msg-content" id="currManagerPlan"></div>
                                `;
                                this.messagesList.appendChild(card);
                                currentTargetEl = document.getElementById('currManagerPlan');
                                this.scrollToBottom();
                            }
                            else if (ev.type === 'manager_plan_chunk' && currentTargetEl) {
                                currentTargetEl.innerText += ev.delta;
                                this.scrollToBottom();
                            }
                            // 2. 부서별 에이전트 작업 시작
                            else if (ev.type === 'agent_work_start') {
                                const cardId = `agent_${Date.now()}`;
                                const card = document.createElement('div');
                                card.className = 'agent-msg-card';
                                card.style.borderLeft = '4px solid var(--accent-cyan)';
                                card.style.marginLeft = '16px';
                                card.innerHTML = `
                                    <div class="agent-msg-header">
                                        <div class="agent-info">
                                            <span>🤖</span>
                                            <span>${ev.agent_name}</span>
                                            <span style="font-size:10px; color:var(--text-dim);">[${ev.dept_name}]</span>
                                        </div>
                                        <span class="node-role-badge">${ev.agent_role}</span>
                                    </div>
                                    <div class="msg-content" id="${cardId}"></div>
                                `;
                                this.messagesList.appendChild(card);
                                currentTargetEl = document.getElementById(cardId);
                                this.scrollToBottom();
                            }
                            else if (ev.type === 'agent_work_chunk' && currentTargetEl) {
                                currentTargetEl.innerText += ev.delta;
                                this.scrollToBottom();
                            }
                            // 3. 관리자 최종 총괄 완성본
                            else if (ev.type === 'manager_final_start') {
                                const card = document.createElement('div');
                                card.className = 'agent-msg-card';
                                card.style.border = '1px solid var(--accent-green)';
                                card.style.background = 'rgba(16,185,129,0.06)';
                                card.innerHTML = `
                                    <div class="agent-msg-header">
                                        <div class="agent-info"><span style="font-size:16px;">🏆</span><span>${ev.manager_name}</span></div>
                                        <span class="node-role-badge" style="background:#10B981; color:#fff;">최종 종합 완성본 패키지</span>
                                    </div>
                                    <div class="msg-content" id="currManagerFinal" style="font-size:13px; font-weight:500;"></div>
                                `;
                                this.messagesList.appendChild(card);
                                currentTargetEl = document.getElementById('currManagerFinal');
                                this.scrollToBottom();
                            }
                            else if (ev.type === 'manager_final_chunk' && currentTargetEl) {
                                currentTargetEl.innerText += ev.delta;
                                this.scrollToBottom();
                            }
                        } catch (e) {}
                    }
                }
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                const card = document.createElement('div');
                card.className = 'agent-msg-card';
                card.innerHTML = `<div style="color:#EF4444; font-size:12px;">⏹️ 오케스트레이션이 사용자에 의해 중단되었습니다.</div>`;
                this.messagesList.appendChild(card);
            } else {
                alert(`오류 발생: ${e.message}`);
            }
        } finally {
            this.setStreamingState(false);
            this.abortController = null;
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        if (this.messagesList) {
            this.messagesList.scrollTop = this.messagesList.scrollHeight;
        }
    }
}

window.orgOrchestrator = new OrgOrchestrator();
