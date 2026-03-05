const API_BASE = '/api/admin';

async function fetchAdmin<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`);
    return response.json();
}

async function postAdmin(endpoint: string, body: object) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return response.json();
}

// Stats & Dashboard
async function loadStats() {
    try {
        const stats = await fetchAdmin<any>('/stats');
        const u = document.getElementById('stat-users');
        const s = document.getElementById('stat-slots');
        const b = document.getElementById('stat-bookings');
        if (u) u.textContent = stats.users.toString();
        if (s) s.textContent = stats.slots.toString();
        if (b) b.textContent = stats.bookings.toString();
    } catch (e) {
        console.warn('Dashboard stats load failed', e);
    }
}

async function loadAnalytics() {
    const data = await fetchAdmin<any>('/analytics');
    document.getElementById('kpi-fulfillment')!.textContent = `${data.fulfillmentRate}%`;
    document.getElementById('kpi-external')!.textContent = `${data.externalRatio}%`;
    document.getElementById('kpi-waitlist')!.textContent = `${data.waitlistConversion}%`;
    document.getElementById('kpi-rebooking')!.textContent = `${data.rebookingRate}%`;
}

// Live Session Monitoring

let selectedEventId: number | null = null;

// Live Session Monitoring
async function loadLiveSession() {
    console.log('[Admin] Loading live session...');
    const container = document.getElementById('live-session-container');
    if (!container) return;

    try {
        // 1. Fetch Events for selection
        let events: any[] = [];
        try {
            events = await fetchAdmin<any[]>('/events');
            if (!Array.isArray(events)) events = [];
        } catch (e) {
            console.warn('Failed to fetch events', e);
        }

        const headerHtml = `
            <div class="glass-card" style="grid-column: 1 / -1; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <label style="font-weight: 700;">📺 모드 선택:</label>
                    <select id="live-event-selector" onchange="window.selectLiveEvent(this.value)" style="min-width: 250px; background: #1a1a1a; color: white; border: 1px solid #333; padding: 8px; border-radius: 6px;">
                        <option value="">-- 일반 타임슬롯 체크인 대기 --</option>
                        ${events.map(e => `<option value="${e.id}" ${selectedEventId === e.id ? 'selected' : ''}>${e.name} (${e.date})</option>`).join('')}
                    </select>
                </div>
                <button class="action-btn" onclick="window.showCreateEventModal()" style="background: var(--accent-purple); color: white; padding: 10px 20px;">+ 새 행사 생성</button>
            </div>
        `;

        if (selectedEventId) {
            // EVENT MODE
            const res = await fetch(`/api/admin/events/${selectedEventId}/details`);
            const data = await res.json();
            const { event, squads, standings, checkedIn } = data;

            if (!event) {
                container.innerHTML = headerHtml + '<div class="glass-card" style="text-align:center; padding:50px;">행사 정보를 불러올 수 없습니다.</div>';
                return;
            }

            const squadCount = squads ? squads.length : 0;

            container.innerHTML = headerHtml + `
                <div class="glass-card" style="grid-column: 1 / -1; margin-bottom: 20px; border-left: 5px solid var(--accent-purple);">
                    <h2 class="accent-purple">🏆 ${event.name}</h2>
                    <p>📅 ${event.date} | 📍 ${event.location} | 👥 참여 대원: ${checkedIn ? checkedIn.length : 0}명</p>
                    ${squadCount === 0 ? `
                        <div style="margin-top: 20px; padding: 20px; background: #ffffff05; border-radius: 8px; text-align: center;">
                            <p style="margin-bottom: 15px; opacity: 0.7;">아직 생성된 조가 없습니다.</p>
                            <button class="btn-primary" onclick="window.batchCreateSquads(${event.id}, 8)">8개 조 일괄 생성 (1조~8조)</button>
                        </div>
                    ` : ''}
                </div>

                <div class="live-grid" style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; grid-column: 1 / -1;">
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        <div class="glass-card">
                            <h3 class="accent-green">🏁 경기 결과 등록</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                                <div class="form-group">
                                    <label>🔴 RED TEAM (조 선택)</label>
                                    <select id="event-match-red-squad" style="background: #1a1a1a; color: white; border: 1px solid #333; padding: 8px;">
                                        <option value="">-- 조 선택 --</option>
                                        ${(squads || []).map((s: any) => `<option value="${s.squad_num}">${s.squad_num}조 (${s.name})</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>🔵 BLUE TEAM (조 선택)</label>
                                    <select id="event-match-blue-squad" style="background: #1a1a1a; color: white; border: 1px solid #333; padding: 8px;">
                                        <option value="">-- 조 선택 --</option>
                                        ${(squads || []).map((s: any) => `<option value="${s.squad_num}">${s.squad_num}조 (${s.name})</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>레드팀 점수</label>
                                    <input type="number" id="event-match-red-score" value="0" class="admin-input">
                                </div>
                                <div class="form-group">
                                    <label>블루팀 점수</label>
                                    <input type="number" id="event-match-blue-score" value="0" class="admin-input">
                                </div>
                            </div>
                            <div class="form-group" style="margin-top: 15px;">
                                <label>MVP 대원 선정</label>
                                <select id="event-match-mvp" style="background: #1a1a1a; color: white; border: 1px solid #333; padding: 8px;">
                                    <option value="">-- 선택 안함 --</option>
                                    ${(checkedIn || []).map((p: any) => `<option value="${p.user_id}">${p.users.name} (${p.squad_num}조)</option>`).join('')}
                                </select>
                            </div>
                            <button class="btn-primary" onclick="window.saveEventMatchResult()" style="margin-top: 20px; width: 100%;">경기 결과 저장</button>
                        </div>

                        ${squadCount === 8 ? `
                        <div class="glass-card">
                            <h3 class="accent-purple">📅 조별 리그전 대진표</h3>
                            <div class="league-order-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; font-size: 0.85rem;">
                                <div style="background: #ffffff05; padding: 10px; border-radius: 5px;">
                                    <p style="font-weight: 700; color: #ff4d4d; border-bottom: 1px solid #ff4d4d22; padding-bottom: 4px; margin-bottom: 8px;">A리그 (1-4조)</p>
                                    <p>1회: 1조 vs 2조</p><p>2회: 3조 vs 4조</p><p>3회: 1조 vs 3조</p><p>4회: 2조 vs 4조</p><p>5회: 1조 vs 4조</p><p>6회: 2조 vs 3조</p>
                                </div>
                                <div style="background: #ffffff05; padding: 10px; border-radius: 5px;">
                                    <p style="font-weight: 700; color: #4d79ff; border-bottom: 1px solid #4d79ff22; padding-bottom: 4px; margin-bottom: 8px;">B리그 (5-8조)</p>
                                    <p>1회: 5조 vs 6조</p><p>2회: 7조 vs 8조</p><p>3회: 5조 vs 7조</p><p>4회: 6조 vs 8조</p><p>5회: 5조 vs 8조</p><p>6회: 6조 vs 7조</p>
                                </div>
                                <div style="grid-column: 1 / -1; background: #ffffff10; padding: 10px; border-radius: 5px; text-align: center; margin-top: 5px;">
                                    <p style="font-weight: 700; color: var(--accent-green);">교차 토너먼트</p>
                                    <p>준결승1: A1위 vs B2위</p>
                                    <p>준결승2: B1위 vs A2위</p>
                                    <p style="font-weight: 800; margin-top: 4px;">결승전: 준결1 승 vs 준결2 승</p>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <div class="glass-card" style="background: #ffffff05;">
                        <h3 class="accent-purple">📊 리그 순위표</h3>
                        <table class="admin-table" style="font-size: 0.85rem; margin-top: 15px;">
                            <thead>
                                <tr>
                                    <th>조</th>
                                    <th>P</th>
                                    <th>W</th>
                                    <th>D</th>
                                    <th>L</th>
                                    <th>득실</th>
                                    <th>Pts</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(standings || []).map((s: any) => `
                                    <tr>
                                        <td style="font-weight: 700;">${s.squad_num}조</td>
                                        <td>${s.played}</td>
                                        <td>${s.wins}</td>
                                        <td>${s.draws}</td>
                                        <td>${s.losses}</td>
                                        <td>${s.goals_for - s.goals_against}</td>
                                        <td class="accent-green" style="font-weight: 800;">${s.points}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            return;
        }

        // SLOT MODE (Default)
        const response = await fetch('/api/sessions/live');
        const data = await response.json();

        if (!data.slot) {
            container.innerHTML = headerHtml + '<div class="glass-card" style="text-align:center; padding:50px;">현재 활성화된 체크인 세션이 없습니다. (대전장 QR 체크인 시 활성화됨)</div>';
            return;
        }

        let groups: any[] = [];
        try {
            groups = await fetchAdmin<any[]>('/groups');
        } catch (e) {
            console.warn('Failed to fetch groups', e);
        }

        const checkedIn = data.checkedIn || [];
        const redTeam = checkedIn.filter((b: any) => b.team_id === 'RED').sort((a: any, b: any) => a.squad_num - b.squad_num);
        const blueTeam = checkedIn.filter((b: any) => b.team_id === 'BLUE').sort((a: any, b: any) => a.squad_num - b.squad_num);

        container.innerHTML = headerHtml + `
            <div class="glass-card" style="grid-column: 1 / -1; margin-bottom: 20px; border-left: 5px solid var(--accent-green);">
                <h3 class="accent-purple">${data.slot.date} | ${data.slot.time_start} - ${data.slot.time_end}</h3>
                <p>📍 ${data.slot.location} (${checkedIn.length} / ${data.slot.capacity} 체크인 완료)</p>
            </div>
            
            <div class="live-teams-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; grid-column: 1 / -1;">
                <div class="glass-card team-red" style="border-color: #ff4d4d22;">
                    <h3 style="color: #ff4d4d; margin-bottom: 15px;">🔴 RED TEAM (${redTeam.length})</h3>
                    <div class="team-list">
                        ${[1, 2, 3, 4, 5, 6, 7, 8].map(num => {
            const player = redTeam.find((p: any) => p.squad_num === num);
            return `
                                <div class="player-slot ${player ? 'active' : 'empty'}">
                                    <span class="sq-num">${num}</span>
                                    <span class="player-name">${player ? player.users.name : '대기 중...'}</span>
                                </div>
                            `;
        }).join('')}
                    </div>
                    <div class="form-group" style="margin-top: 15px;">
                        <label>레드팀 지정 (가족/팀)</label>
                        <select id="match-red-group-id" style="background: #1a1a1a; color: white; border: 1px solid #333; padding: 8px;">
                            <option value="">-- 선택 안함 --</option>
                            ${groups.map(g => `<option value="${g.id}">${g.name} (${g.category})</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="glass-card team-blue" style="border-color: #4d79ff22;">
                    <h3 style="color: #4d79ff; margin-bottom: 15px;">🔵 BLUE TEAM (${blueTeam.length})</h3>
                    <div class="team-list">
                        ${[1, 2, 3, 4, 5, 6, 7, 8].map(num => {
            const player = blueTeam.find((p: any) => p.squad_num === num);
            return `
                                <div class="player-slot ${player ? 'active' : 'empty'}">
                                    <span class="sq-num">${num}</span>
                                    <span class="player-name">${player ? player.users.name : '대기 중...'}</span>
                                </div>
                            `;
        }).join('')}
                    </div>
                    <div class="form-group" style="margin-top: 15px;">
                        <label>블루팀 지정 (가족/팀)</label>
                        <select id="match-blue-group-id" style="background: #1a1a1a; color: white; border: 1px solid #333; padding: 8px;">
                            <option value="">-- 선택 안함 --</option>
                            ${groups.map(g => `<option value="${g.id}">${g.name} (${g.category})</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div class="glass-card" style="grid-column: 1 / -1; margin-top: 20px; border: 1px dashed var(--accent-green);">
                <h3 class="accent-green">🏁 경기 결과 등록</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 15px;">
                    <div class="form-group">
                        <label>레드팀 점수</label>
                        <input type="number" id="match-red-score" value="0" class="admin-input">
                    </div>
                    <div class="form-group">
                        <label>블루팀 점수</label>
                        <input type="number" id="match-blue-score" value="0" class="admin-input">
                    </div>
                    <div class="form-group">
                        <label>승리팀</label>
                        <select id="match-winner" style="background: #1a1a1a; color: white; border: 1px solid #333; padding: 8px;">
                            <option value="RED">RED TEAM</option>
                            <option value="BLUE">BLUE TEAM</option>
                            <option value="DRAW">무승부 (DRAW)</option>
                        </select>
                    </div>
                </div>
                <div class="form-group" style="margin-top: 10px;">
                    <label>MVP 대원 선정 (ID)</label>
                    <select id="match-mvp-id" style="background: #1a1a1a; color: white; border: 1px solid #333; padding: 8px;">
                        <option value="">-- 선택 안함 --</option>
                        ${checkedIn.map((p: any) => `<option value="${p.user_id}">${p.users.name} (${p.team_id})</option>`).join('')}
                    </select>
                </div>
                <button class="btn-primary" onclick="window.saveMatchResult(${data.slot.id})" style="margin-top: 15px;">경기 종료 및 기록 저장</button>
            </div>
        `;
    } catch (e) {
        console.error('Live data load failed', e);
        if (container) container.innerHTML = '<div class="glass-card" style="text-align:center; padding:50px;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
    }
}

// Global Event/Squad Handlers
(window as any).selectLiveEvent = (eventId: string) => {
    selectedEventId = eventId ? parseInt(eventId) : null;
    loadLiveSession();
};

(window as any).showCreateEventModal = () => {
    document.getElementById('event-modal')!.style.display = 'flex';
};

(window as any).closeEventModal = () => {
    document.getElementById('event-modal')!.style.display = 'none';
};

(window as any).submitEvent = async () => {
    const data = {
        name: (document.getElementById('event-name') as HTMLInputElement).value,
        date: (document.getElementById('event-date') as HTMLInputElement).value,
        location: (document.getElementById('event-location') as HTMLInputElement).value,
        squadCount: parseInt((document.getElementById('event-squad-count') as HTMLSelectElement).value)
    };

    if (!data.name) {
        alert('행사 명칭을 입력해주세요.');
        return;
    }

    const res = await postAdmin('/events/create', data);
    if (res.success) {
        alert('행사가 생성되었습니다.');
        (window as any).closeEventModal();
        selectedEventId = res.event.id;
        loadLiveSession();
    } else {
        alert('행사 생성 실패');
    }
};

(window as any).batchCreateSquads = async (eventId: number, count: number) => {
    if (confirm(`${count}개의 조를 생성하시겠습니까?`)) {
        const res = await postAdmin('/events/squads/create-batch', { eventId, count });
        if (res.success) {
            loadLiveSession();
        } else {
            alert('조 생성 실패');
        }
    }
};

(window as any).saveEventMatchResult = async () => {
    if (!selectedEventId) return;

    const redSquad = parseInt((document.getElementById('event-match-red-squad') as HTMLSelectElement).value);
    const blueSquad = parseInt((document.getElementById('event-match-blue-squad') as HTMLSelectElement).value);
    const redScore = parseInt((document.getElementById('event-match-red-score') as HTMLInputElement).value);
    const blueScore = parseInt((document.getElementById('event-match-blue-score') as HTMLInputElement).value);
    const mvpUserId = (document.getElementById('event-match-mvp') as HTMLSelectElement).value;

    if (!redSquad || !blueSquad) {
        alert('경기할 조를 모두 선택해주세요.');
        return;
    }

    let winningSquadNum = 0; // Draw
    if (redScore > blueScore) winningSquadNum = redSquad;
    else if (blueScore > redScore) winningSquadNum = blueSquad;

    const confirm = window.confirm('경기 결과를 저장하시겠습니까?');
    if (!confirm) return;

    try {
        const res = await postAdmin('/events/matches/save', {
            eventId: selectedEventId,
            redSquadNum: redSquad,
            blueSquadNum: blueSquad,
            redScore,
            blueScore,
            winningSquadNum,
            mvpUserId: mvpUserId ? parseInt(mvpUserId) : null
        });

        if (res.success) {
            alert('기록되었습니다.');
            loadLiveSession();
        } else {
            alert('저장 실패: ' + res.message);
        }
    } catch (e) {
        alert('서버 오류');
    }
};

(window as any).saveMatchResult = async (slotId: number) => {
    const redScore = parseInt((document.getElementById('match-red-score') as HTMLInputElement).value);
    const blueScore = parseInt((document.getElementById('match-blue-score') as HTMLInputElement).value);
    const winningTeam = (document.getElementById('match-winner') as HTMLSelectElement).value;
    const mvpUserId = (document.getElementById('match-mvp-id') as HTMLSelectElement).value;
    const redGroupId = (document.getElementById('match-red-group-id') as HTMLSelectElement).value;
    const blueGroupId = (document.getElementById('match-blue-group-id') as HTMLSelectElement).value;

    const confirm = window.confirm('경기를 종료하고 결과를 저장하시겠습니까? 승리팀 보상과 MVP 경험치가 즉시 지급됩니다.');
    if (!confirm) return;

    try {
        const response = await fetch('/api/admin/match-records/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                slotId,
                winningTeam,
                redScore,
                blueScore,
                mvpUserId: mvpUserId ? parseInt(mvpUserId) : null,
                redGroupId: redGroupId ? parseInt(redGroupId) : null,
                blueGroupId: blueGroupId ? parseInt(blueGroupId) : null,
                matchReport: `${winningTeam}팀 승리! (${redScore}:${blueScore})`
            })
        });
        const result = await response.json();
        if (result.success) {
            alert('기록이 저장되었습니다.');
            loadLiveSession();
        } else {
            alert('저장 실패: ' + result.message);
        }
    } catch (e) {
        alert('서버 오류 발생');
    }
};


// User Management
async function loadUsers() {
    console.log('[Admin] Loading users...');
    try {
        const users = await fetchAdmin<any[]>('/users');
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;

        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 40px; opacity: 0.5;">등록된 대원이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr class="user-row" style="transition: background 0.2s ease;">
                <td>${user.id}</td>
                <td class="accent-purple" style="font-weight: 700; cursor: pointer;" onclick="window.changeRole('${user.id}', '${user.role || 'USER'}')">
                    ${user.name}
                </td>
                <td>
                    <span class="status-badge ${user.role === 'ADMIN' ? 'paid' : ''}" 
                          style="cursor: pointer; font-size: 0.75rem; padding: 6px 10px; border: 1px solid var(--glass-border); display: inline-flex; align-items: center; gap: 4px;" 
                          onclick="window.changeRole('${user.id}', '${user.role || 'USER'}')">
                        ${user.role === 'ADMIN' ? '🛡️ ADMIN' : '👤 USER'}
                    </span>
                </td>
                <td>${user.level}</td>
                <td>${user.xp} XP</td>
                <td>
                    <span class="status-badge ${user.membership_type === 'ELITE' ? 'paid' : 'pending'}" 
                          style="cursor: pointer; font-size: 0.75rem; padding: 6px 10px;" 
                          onclick="window.changeMembership('${user.id}', '${user.membership_type}')">
                        ${user.membership_type === 'ELITE' ? '🏅 ELITE' : 'STANDARD'}
                    </span>
                    ${user.membership_expiry ? `<br><small style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-top: 4px;">~${new Date(user.membership_expiry).toLocaleDateString()}</small>` : ''}
                </td>
                <td style="font-size: 0.8rem; color: var(--text-secondary);">
                    🏆 ${user.total_wins || 0} / 🎖️ ${user.mvp_count || 0}
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="action-btn" style="padding: 6px 12px;" onclick="window.editUser('${user.id}', '${user.level}', ${user.xp})">XP수정</button>
                        <button class="action-btn" style="color: var(--accent-green); padding: 6px 12px;" onclick="window.awardPerformance('${user.id}', 'win')">승리!</button>
                        <button class="action-btn" style="color: #ff9f43; padding: 6px 12px;" onclick="window.awardPerformance('${user.id}', 'mvp')">MVP!</button>
                    </div>
                </td>
            </tr>
        `).join('');

        console.log(`[Admin] Successfully loaded ${users.length} users.`);
    } catch (e) {
        console.error('[Admin] Failed to load users:', e);
        const tbody = document.getElementById('user-table-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--accent-red); padding: 40px;">데이터 로드 실패</td></tr>';
    }
}

(window as any).changeRole = async (userId: string | number, currentRole: string) => {
    console.log(`[Admin] Attempting to change role for user ${userId}. Current role: ${currentRole}`);
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!confirm(`사용자 권한을 ${newRole}로 변경하시겠습니까?`)) return;

    try {
        const res = await postAdmin('/users/update-role', { userId, role: newRole });
        if (res.success) {
            alert(res.message);
            loadUsers();
        } else {
            alert('권한 변경 실패: ' + (res.message || 'Unknown error'));
        }
    } catch (e) {
        console.error('[Admin] Role change error:', e);
        alert('권한 변경 중 오류가 발생했습니다.');
    }
};

(window as any).changeMembership = async (userId: string | number, currentType: string) => {
    console.log(`[Admin] Changing membership for user ${userId}. Current: ${currentType}`);
    const newType = currentType === 'ELITE' ? 'STANDARD' : 'ELITE';
    const confirmMsg = newType === 'ELITE'
        ? '이 대원을 엘리트 멤버십(30일)으로 업그레이드하시겠습니까?'
        : '이 대원을 일반 멤버십으로 변경하시겠습니까?';

    if (confirm(confirmMsg)) {
        const expiryDays = newType === 'ELITE' ? 30 : 0;
        const res = await postAdmin('/users/update-membership', { userId, type: newType, expiryDays });
        if (res.success) {
            alert(res.message);
            loadUsers();
        } else {
            alert('멤버십 변경에 실패했습니다.');
        }
    }
};

(window as any).editUser = async (id: string | number, currentLevel: string, currentXp: number) => {
    console.log(`[Admin] Editing user ${id}. Current XP: ${currentXp}`);
    const newXp = prompt('새로운 XP를 입력하세요:', currentXp.toString());
    if (newXp !== null) {
        const res = await postAdmin('/users/update', { id, level: currentLevel, xp: parseInt(newXp) });
        if (res.success) {
            alert(res.message);
            loadUsers();
        } else {
            alert('XP 수정에 실패했습니다.');
        }
    }
};

(window as any).awardPerformance = async (userId: string | number, type: 'win' | 'mvp') => {
    console.log(`[Admin] Awarding ${type} to user ${userId}`);
    const label = type === 'win' ? '승리' : 'MVP';
    if (confirm(`이 대원에게 ${label} 보상을 지급하시겠습니까?`)) {
        const res = await postAdmin('/users/award-performance', { userId, type });
        if (res.success) {
            alert(res.message);
            loadUsers();
        } else {
            alert('보상 지급 실패');
        }
    }
};

// Slot Management
async function loadSlots() {
    const slots = await fetchAdmin<any[]>('/slots');
    const tbody = document.getElementById('slot-table-body');
    if (!tbody) return;
    tbody.innerHTML = slots.map(slot => `
        <tr>
            <td>${slot.date}</td>
            <td class="accent-purple"><strong>${slot.label || '-'}</strong></td>
            <td><strong>${slot.location || '-'}</strong></td>
            <td>${slot.time_start} - ${slot.time_end}</td>
            <td>${slot.booked} / ${slot.capacity}</td>
            <td>${slot.price.toLocaleString()}원</td>
            <td>
                <button class="action-btn danger" onclick="window.deleteSlot(${slot.id})">삭제</button>
            </td>
        </tr>
    `).join('');
}

(window as any).showAddSlot = () => {
    document.getElementById('slot-modal')!.style.display = 'flex';
};

(window as any).closeModal = () => {
    document.getElementById('slot-modal')!.style.display = 'none';
};

(window as any).submitSlot = async () => {
    const data = {
        date: (document.getElementById('slot-date') as HTMLInputElement).value,
        label: (document.getElementById('slot-label') as HTMLInputElement).value,
        time_start: (document.getElementById('slot-start') as HTMLInputElement).value,
        time_end: (document.getElementById('slot-end') as HTMLInputElement).value,
        location: (document.getElementById('slot-location') as HTMLInputElement).value,
        capacity: parseInt((document.getElementById('slot-cap') as HTMLInputElement).value),
        price: parseInt((document.getElementById('slot-price') as HTMLInputElement).value),
        price_youth: parseInt((document.getElementById('slot-price-youth') as HTMLInputElement).value),
        price_child: parseInt((document.getElementById('slot-price-child') as HTMLInputElement).value)
    };

    await postAdmin('/slots/add', data);
    (window as any).closeModal();
    loadSlots();
};

(window as any).showBatchSlot = () => {
    (window as any).closeModal();
    document.getElementById('batch-slot-modal')!.style.display = 'flex';
};

(window as any).closeBatchModal = () => {
    document.getElementById('batch-slot-modal')!.style.display = 'none';
};

(window as any).submitBatchSlots = async () => {
    const location = (document.getElementById('batch-location') as HTMLSelectElement).value;
    const days = Array.from(document.querySelectorAll('input[name="batch-day"]:checked')).map(el => parseInt((el as HTMLInputElement).value));

    if (days.length === 0) {
        alert('최소 하나 이상의 요일을 선택해주세요.');
        return;
    }

    const t1Start = (document.getElementById('batch-t1-start') as HTMLInputElement).value;
    const t1End = (document.getElementById('batch-t1-end') as HTMLInputElement).value;
    const t2Start = (document.getElementById('batch-t2-start') as HTMLInputElement).value;
    const t2End = (document.getElementById('batch-t2-end') as HTMLInputElement).value;
    const priceInternal = parseInt((document.getElementById('batch-price-internal') as HTMLInputElement).value);
    const priceExternal = parseInt((document.getElementById('batch-price-external') as HTMLInputElement).value);

    const slots: any[] = [];
    const today = new Date();

    for (let i = 0; i < 28; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);

        if (days.includes(targetDate.getDay())) {
            const dateStr = targetDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

            slots.push({
                date: dateStr,
                time_start: t1Start,
                time_end: t1End,
                label: '1타임',
                location: location,
                capacity: 32,
                price: priceExternal,
                price_youth: priceInternal,
                price_child: priceInternal
            });

            slots.push({
                date: dateStr,
                time_start: t2Start,
                time_end: t2End,
                label: '2타임',
                location: location,
                capacity: 32,
                price: priceExternal,
                price_youth: priceInternal,
                price_child: priceInternal
            });
        }
    }

    if (confirm(`${slots.length}개의 슬롯을 한 번에 생성하시겠습니까?`)) {
        const res = await postAdmin('/slots/batch-add', { slots });
        if (res.success) {
            alert('일괄 생성이 완료되었습니다.');
            (window as any).closeBatchModal();
            loadSlots();
        } else {
            alert('슬롯 생성이 실패했습니다.');
        }
    }
};

(window as any).deleteSlot = async (id: number) => {
    if (confirm('이 슬롯을 삭제하시겠습니까?')) {
        await postAdmin('/slots/delete', { id });
        loadSlots();
    }
};

// Booking Management
async function loadBookings() {
    const location = (document.getElementById('filter-location') as HTMLSelectElement).value;
    const status = (document.getElementById('filter-status') as HTMLSelectElement).value;
    const date = (document.getElementById('filter-date') as HTMLInputElement).value;

    let query = `/bookings?`;
    if (location) query += `location=${location}&`;
    if (status) query += `status=${status}&`;
    if (date) query += `date=${date}&`;

    const bookings = await fetchAdmin<any[]>(query);
    const tbody = document.getElementById('booking-table-body')!;
    tbody.innerHTML = bookings.map(b => `
        <tr>
            <td>${b.id}</td>
            <td class="accent-green">${b.user_name}</td>
            <td>${b.date} ${b.time_start}</td>
            <td>${b.location}</td>
            <td style="font-weight: 800;">
                <span class="status-badge ${b.status?.toLowerCase() || 'pending'}" style="${b.status === 'PENDING' ? 'background: #ff4d4d22; border: 1px solid #ff4d4d; color: #ff4d4d;' : ''}">
                    ${b.status === 'PAID' ? '✅ 결제완료' : b.status === 'REFUNDED' ? '↩️ 환불됨' : b.status === 'NOSHOW' ? '⏳ 노쇼' : '💳 입금대기'}
                </span>
            </td>
            <td style="font-size: 0.75rem; color: var(--text-secondary);">${new Date(b.created_at).toLocaleString()}</td>
            <td>
                <div style="display: flex; gap: 5px;">
                    ${b.status === 'PENDING' ? `
                        <button class="action-btn" style="color: var(--accent-green); border-color: var(--accent-green);" onclick="window.updateBookingStatus(${b.id}, 'PAID')">입금확인</button>
                    ` : ''}
                    ${b.status === 'PAID' ? `
                        <button class="action-btn" onclick="window.updateBookingStatus(${b.id}, 'REFUNDED')">환불</button>
                        <button class="action-btn" style="color: #ff9f43;" onclick="window.updateBookingStatus(${b.id}, 'NOSHOW')">노쇼</button>
                    ` : ''}
                    <button class="action-btn danger" onclick="window.deleteBooking(${b.id})">삭제</button>
                </div>
            </td>
        </tr>
    `).join('');
}

(window as any).updateBookingStatus = async (id: number, status: string) => {
    let confirmMsg = '';
    if (status === 'PAID') confirmMsg = '해당 예약의 입금을 확인하고 확정하시겠습니까?';
    else if (status === 'REFUNDED') confirmMsg = '해당 예약을 환불 처리하시겠습니까?';
    else if (status === 'NOSHOW') confirmMsg = '해당 예약을 노쇼 처리하시겠습니까?';

    if (confirm(confirmMsg)) {
        const res = await postAdmin('/bookings/update-status', { id, status });
        if (res.success) {
            loadBookings();
        } else {
            alert('상태 업데이트에 실패했습니다.');
        }
    }
};

(window as any).deleteBooking = async (id: number) => {
    if (confirm('이 예약을 완전히 삭제하시겠습니까? 데이터베이스에서 제거됩니다.')) {
        await postAdmin('/bookings/delete', { id });
        loadBookings();
        loadStats();
    }
};

// Initialization & Tab Switching
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Admin] v1.3.2 Initializing...');

    // 1. Critical UI Globals
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('menu-toggle');

    // Ensure overlay is hidden at start to avoid blocking clicks
    if (overlay) overlay.classList.remove('active');

    const localToggleMobileMenu = () => {
        console.log('[Admin] Toggling mobile menu');
        sidebar?.classList.toggle('active');
        overlay?.classList.toggle('active');
    };

    if (menuBtn) menuBtn.addEventListener('click', localToggleMobileMenu);
    if (overlay) overlay.addEventListener('click', localToggleMobileMenu);

    // 2. Tab Navigation Setup (Highest Priority after Menu)
    const tabs = document.querySelectorAll('.nav-item');
    console.log(`[Admin] Found ${tabs.length} tabs`);

    tabs.forEach(tab => {
        tab.addEventListener('click', async (e) => {
            const currentTab = e.currentTarget as HTMLElement;
            const target = currentTab.getAttribute('data-tab') || '';
            console.log(`[Admin] Tab clicked: ${target}`);

            try {
                // UI State Update (Immediate)
                tabs.forEach(t => t.classList.remove('active'));
                currentTab.classList.add('active');

                const allContents = document.querySelectorAll('.tab-content');
                allContents.forEach(c => {
                    (c as HTMLElement).style.display = 'none';
                });

                const targetEl = document.getElementById(`tab-${target}`);
                if (targetEl) {
                    targetEl.style.display = 'block';
                    console.log(`[Admin] Displayed tab-${target}`);
                } else {
                    console.error(`[Admin] Target tab content not found: tab-${target}`);
                }

                // Close mobile menu if open
                if (window.innerWidth <= 992 && sidebar?.classList.contains('active')) {
                    localToggleMobileMenu();
                }

                // Data Loading (Async)
                switch (target) {
                    case 'dashboard': await loadStats(); break;
                    case 'users': await loadUsers(); break;
                    case 'slots': await loadSlots(); break;
                    case 'bookings': await loadBookings(); break;
                    case 'live': await loadLiveSession(); break;
                    case 'analytics': await loadAnalytics(); break;
                    case 'events': await (window as any).loadEvents(); break;
                }
            } catch (err) {
                console.error(`[Admin] Error switching to tab ${target}:`, err);
            }
        });
    });

    // 3. Define Missing Global Functions for HTML onclick
    (window as any).changeCount = () => {
        console.warn('[Admin] changeCount called (not implemented in admin, but defined for safety)');
    };

    (window as any).loadBookings = loadBookings;
    (window as any).loadUsers = loadUsers;
    (window as any).loadSlots = loadSlots;
    (window as any).loadLiveSession = loadLiveSession;
    (window as any).loadAnalytics = loadAnalytics;
    (window as any).loadStats = loadStats;
    (window as any).loadEvents = loadEvents;
    (window as any).showAddSlot = () => {
        const modal = document.getElementById('slot-modal');
        if (modal) modal.style.display = 'flex';
    };
    (window as any).closeModal = () => {
        const modals = document.querySelectorAll('.login-overlay, .modal');
        modals.forEach(m => (m as HTMLElement).style.display = 'none');
    };

    // 4. Initial Load (Dashboard Stats)
    console.log('[Admin] Performing initial dashboard load');
    try {
        await loadStats();
        console.log('[Admin] Initial stats loaded successfully');
    } catch (e) {
        console.error('[Admin] Initial stats load failed:', e);
    }
});

(window as any).generateQRCode = () => {
    const location = (document.getElementById('qr-location-select') as HTMLSelectElement).value;
    const qrDisplay = document.getElementById('qr-code-display')!;
    const resultArea = document.getElementById('qr-result-area')!;
    const urlText = document.getElementById('qr-url-text')!;

    // Clear previous QR
    qrDisplay.innerHTML = '';

    // Generate target URL
    const targetUrl = `https://club-five-xi.vercel.app/index.html?qr=${location}`;
    urlText.textContent = targetUrl;

    // Use QRCode.js
    new (window as any).QRCode(qrDisplay, {
        text: targetUrl,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: (window as any).QRCode.CorrectLevel.H
    });

    resultArea.style.display = 'block';
};

(window as any).downloadQR = () => {
    const qrImage = document.querySelector('#qr-code-display img') as HTMLImageElement;
    if (qrImage) {
        const link = document.createElement('a');
        link.href = qrImage.src;
        link.download = `QR_CHECKIN_${new Date().getTime()}.png`;
        link.click();
    } else {
        // Fallback for canvas if img not ready
        const canvas = document.querySelector('#qr-code-display canvas') as HTMLCanvasElement;
        if (canvas) {
            const link = document.createElement('a');
            link.href = canvas.toDataURL("image/png");
            link.download = `QR_CHECKIN_${new Date().getTime()}.png`;
            link.click();
        }
    }
};

(window as any).updateCouponPreview = () => {
    try {
        const xpInput = document.getElementById('coupon-xp-input') as HTMLInputElement;
        const prefixInput = document.getElementById('coupon-prefix-input') as HTMLInputElement;
        const neonInput = document.getElementById('coupon-color-neon') as HTMLInputElement;
        const xpColorInput = document.getElementById('coupon-color-xp') as HTMLInputElement;
        const brandInput = document.getElementById('coupon-brand-input') as HTMLInputElement;
        const rewardInput = document.getElementById('coupon-reward-label-input') as HTMLInputElement;
        const codeInput = document.getElementById('coupon-code-label-input') as HTMLInputElement;

        if (!xpInput || !prefixInput || !neonInput || !xpColorInput || !brandInput || !rewardInput || !codeInput) {
            console.warn('Coupon designer inputs not found');
            return;
        }

        const xp = xpInput.value;
        const prefix = prefixInput.value;
        const neonColor = neonInput.value;
        const xpColor = xpColorInput.value;
        const brandText = brandInput.value;
        const rewardLabel = rewardInput.value;
        const codeLabel = codeInput.value;

        const xpVal = document.getElementById('preview-xp-val');
        if (xpVal) {
            xpVal.textContent = `${xp} XP`;
            xpVal.style.color = xpColor;
        }

        const codeVal = document.getElementById('preview-code-val');
        if (codeVal) codeVal.textContent = `${prefix || 'CPN'}_XXXXXX`;

        const brandEl = document.querySelector('#coupon-design-card .coupon-brand') as HTMLElement;
        if (brandEl) {
            brandEl.textContent = brandText;
            brandEl.style.color = neonColor;
        }

        const labels = document.querySelectorAll('#coupon-design-card .preview-label');
        if (labels.length >= 2) {
            (labels[0] as HTMLElement).textContent = rewardLabel;
            (labels[1] as HTMLElement).textContent = codeLabel;
        }

        const card = document.getElementById('coupon-design-card');
        if (card) {
            card.style.borderColor = neonColor;
            card.style.boxShadow = `0 20px 50px ${neonColor}33`;
        }

        // Also sync to printable template
        const printXp = document.getElementById('print-xp-val');
        if (printXp) printXp.textContent = `${xp} XP`;

        const printTitle = document.querySelector('#coupon-print-template .title') as HTMLElement;
        if (printTitle) printTitle.textContent = `${brandText} SPECIAL OFFER`;

        const printCodeLabel = document.querySelector('#coupon-print-template .code-label') as HTMLElement;
        if (printCodeLabel) printCodeLabel.textContent = codeLabel;
    } catch (e) {
        console.error('updateCouponPreview error:', e);
    }
};

(window as any).generateCouponQR = async () => {
    const xp = parseInt((document.getElementById('coupon-xp-input') as HTMLInputElement).value);
    const prefix = (document.getElementById('coupon-prefix-input') as HTMLInputElement).value;
    const brandInput = document.getElementById('coupon-brand-input') as HTMLInputElement;
    const brandText = brandInput.value.trim() || 'K서바이벌스포츠클럽'; // Fallback to club name
    const xpInput = document.getElementById('coupon-xp-input') as HTMLInputElement;
    const xpText = xpInput.value.trim();

    const count = 10; // Generate 10 as requested
    console.log('Generating coupons with params:', { xp, prefix, count });

    // Call backend to generate codes
    try {
        const res = await fetch('/api/admin/coupons/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rewardXp: xp, prefix, count })
        });
        const data = await res.json();

        if (data.success) {
            const codes = data.codes;
            const mainQrDisplay = document.getElementById('coupon-qr-display')!;
            const mainCodeText = document.getElementById('preview-code-val')!;
            const batchContainer = document.getElementById('coupon-batch-print-template')!;

            // 1. Update main preview (first code)
            mainQrDisplay.innerHTML = '';
            const baseUrl = window.location.origin; // Use current origin for local/dev support
            const firstTargetUrl = `${baseUrl}/index.html?coupon=${codes[0]}`;
            mainCodeText.textContent = codes[0];

            new (window as any).QRCode(mainQrDisplay, {
                text: firstTargetUrl,
                width: 80,
                height: 80,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: (window as any).QRCode.CorrectLevel.H
            });

            // 2. Prepare Batch Grid
            batchContainer.innerHTML = '';
            codes.forEach((code: string) => {
                const item = document.createElement('div');
                item.className = 'batch-item';
                item.innerHTML = `
                <div class="batch-left">
                    <p class="title">${brandText}</p>
                    <h1 class="reward">${xpText} XP</h1>
                    <p class="sub-label">Redeem Code:</p>
                    <p class="coupon-code">${code}</p>
                </div>
                <div class="batch-right">
                    <div class="batch-qr"></div>
                </div>
                `;
                batchContainer.appendChild(item);

                // Add QR code to this batch item
                new (window as any).QRCode(item.querySelector('.batch-qr'), {
                    text: `${window.location.origin}/index.html?coupon=${code}`,
                    width: 140,
                    height: 140,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: (window as any).QRCode.CorrectLevel.H
                });
            });

            // Show download buttons
            document.getElementById('download-coupon-btn')!.style.display = 'block';
            document.getElementById('download-print-btn')!.style.display = 'block';

            // Update single printable template (keep for fallback/legacy)
            document.getElementById('print-xp-val')!.textContent = `${xp} XP`;
            document.getElementById('print-code-val')!.textContent = codes[0];
            const printQrDisplay = document.getElementById('print-qr-display')!;
            printQrDisplay.innerHTML = '';
            new (window as any).QRCode(printQrDisplay, {
                text: firstTargetUrl,
                width: 140,
                height: 140,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: (window as any).QRCode.CorrectLevel.H
            });

            alert('10개의 무작위 코드가 생성되었습니다!');
        } else {
            console.error('Coupon generation failed API response:', data);
            alert('쿠폰 생성에 실패했습니다: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Fetch error during coupon generation:', err);
        alert('서버와 연결할 수 없습니다. 백엔드 상태를 확인하세요.');
    }
};

(window as any).downloadFullCoupon = async () => {
    console.log('downloadFullCoupon started');
    const card = document.getElementById('coupon-design-card')!;
    const code = document.getElementById('preview-code-val')!.textContent;

    try {
        const canvas = await (window as any).html2canvas(card, {
            backgroundColor: null,
            scale: 2
        });

        canvas.toBlob((blob: Blob | null) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `COUPON_SCREEN_${code}.png`;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            console.log('Download triggered');
        }, 'image/png');
    } catch (e) {
        console.error('Coupon export failed', e);
        alert('이미지 생성 중 오류가 발생했습니다.');
    }
};

(window as any).downloadPrintableCoupon = async () => {
    console.log('downloadPrintableCoupon started');
    const template = document.getElementById('coupon-batch-print-template')!;

    if (!template || template.children.length === 0) {
        alert('먼저 쿠폰을 생성해 주세요!');
        return;
    }

    try {
        // Temporarily prepare for capture
        const originalStyle = template.getAttribute('style') || '';
        template.style.position = 'absolute';
        template.style.left = '0';
        template.style.top = '0';
        template.style.zIndex = '9999';
        template.style.visibility = 'visible';
        template.style.display = 'flex';
        template.style.background = '#ffffff';

        // Wait for QR codes and layout to settle
        await new Promise(resolve => setTimeout(resolve, 800));

        const canvas = await (window as any).html2canvas(template, {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
            allowTaint: false, // Disabling this prevents tainting the canvas
            logging: true,
            width: 1200,
            height: template.offsetHeight
        });

        // Restore original style
        template.setAttribute('style', originalStyle);

        console.log('Canvas generated, converting to blob...');
        canvas.toBlob((blob: Blob | null) => {
            if (!blob) {
                console.error('Blob generation failed');
                alert('이미지 생성 실패 (Blob)');
                return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `COUPON_BATCH_${new Date().getTime()}.png`;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 500);
            console.log('Download triggered successfully');
        }, 'image/png');
    } catch (e) {
        console.error('Batch export failed', e);
        alert('인쇄용 파일 생성에 실패했습니다.');
    }
};

// --- Event Management Tab Logic ---

async function loadEvents() {
    console.log('[Admin] Loading events...');
    try {
        const events = await fetchAdmin<any[]>('/events');
        const tbody = document.getElementById('event-table-body');
        if (!tbody) return;

        if (!events || events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; opacity: 0.5;">등록된 대회가 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = events.map(event => `
            <tr>
                <td>${event.id}</td>
                <td class="accent-purple" style="font-weight: 700;">${event.name}</td>
                <td>${event.date}</td>
                <td>${event.location}</td>
                <td><span class="status-badge paid">진행 중</span></td>
                <td>
                    <button class="action-btn" onclick="window.loadEventDetails(${event.id})">상세보기</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('[Admin] Failed to load events:', e);
    }
}

(window as any).loadEventDetails = async (id: number) => {
    selectedEventId = id;
    const section = document.getElementById('event-detail-section')!;
    const title = document.getElementById('selected-event-title')!;
    section.style.display = 'block';

    // Auto-scroll to details on mobile/all for better UX
    setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    try {
        const res = await fetch(`/api/admin/events/${id}/details`);
        const data = await res.json();
        const { event, squads, standings, matches, checkedIn } = data;

        title.textContent = `🏆 ${event.name} 상세 관리`;

        // 1. Participant List
        const participantsList = document.getElementById('event-participants-list')!;
        participantsList.innerHTML = (checkedIn || []).map((p: any) => `
            <div class="participant-item">
                <span>${p.users.name}</span>
                <span class="accent-green" style="font-weight: 800;">${p.squad_num ? p.squad_num + '조' : '미배정'}</span>
            </div>
        `).join('') || '<p style="padding: 20px; text-align: center; opacity: 0.5;">참가자가 없습니다.</p>';

        // 2. User Selector for assignment
        try {
            const userSelector = document.getElementById('event-user-selector') as HTMLSelectElement;
            if (userSelector) {
                const allUsers = await fetchAdmin<any[]>('/users');
                if (Array.isArray(allUsers)) {
                    userSelector.innerHTML = '<option value="">-- 대원 선택 --</option>' +
                        allUsers.map(u => `<option value="${u.id}">${u.name} (${u.level})</option>`).join('');
                }
            }
        } catch (e) {
            console.warn('Failed to load user list for selector', e);
        }

        // 3. Match Squad Selectors
        try {
            const redSelector = document.getElementById('match-red-squad') as HTMLSelectElement;
            const blueSelector = document.getElementById('match-blue-squad') as HTMLSelectElement;
            if (redSelector && blueSelector) {
                const squadOptions = (squads || []).map((s: any) => `<option value="${s.squad_num}">${s.squad_num}조 (${s.name})</option>`).join('');
                redSelector.innerHTML = '<option value="">-- 조 선택 --</option>' + squadOptions;
                blueSelector.innerHTML = '<option value="">-- 조 선택 --</option>' + squadOptions;
            }
        } catch (e) {
            console.warn('Failed to setup squad selectors', e);
        }

        // 4. MVP Selector
        try {
            const mvpSelector = document.getElementById('match-mvp-user') as HTMLSelectElement;
            if (mvpSelector) {
                mvpSelector.innerHTML = '<option value="">-- 선택 안함 --</option>' +
                    (checkedIn || []).map((p: any) => `<option value="${p.user_id}">${p.users.name} (${p.squad_num}조)</option>`).join('');
            }
        } catch (e) {
            console.warn('Failed to setup MVP selector', e);
        }

        // 5. Standings Table
        try {
            const standingsBody = document.getElementById('event-standings-body')!;
            if (standingsBody) {
                const standingsHtml = (standings || []).map((s: any) => `
                    <tr>
                        <td>${s.squad_num}조</td>
                        <td>${s.played}</td>
                        <td>${s.wins}</td>
                        <td>${s.draws}</td>
                        <td>${s.losses}</td>
                        <td class="accent-green" style="font-weight: 800;">${s.points}</td>
                    </tr>
                `).join('');
                standingsBody.innerHTML = standingsHtml || '<tr><td colspan="6" style="text-align:center; padding:20px; opacity:0.5;">데이터가 없습니다.</td></tr>';
            }
        } catch (e) {
            console.warn('Failed to render standings', e);
        }

        // 6. Matches Schedule (대진표)
        console.log('[Admin] Rendering matches schedule:', matches);
        try {
            const matchesSchedule = document.getElementById('event-matches-schedule')!;
            if (matchesSchedule) {
                const safeMatches = Array.isArray(matches) ? matches : [];

                // Dynamic played count based on match order
                const currentMatchCounts: { [key: number]: number } = {};

                if (safeMatches.length > 0) {
                    matchesSchedule.innerHTML = safeMatches.map((m: any, idx: number) => {
                        const isCompleted = m.winning_squad_num !== null;
                        const redWon = m.winning_squad_num === m.red_squad_num;
                        const blueWon = m.winning_squad_num === m.blue_squad_num;

                        // Increment counts for this specific match position
                        currentMatchCounts[m.red_squad_num] = (currentMatchCounts[m.red_squad_num] || 0) + 1;
                        currentMatchCounts[m.blue_squad_num] = (currentMatchCounts[m.blue_squad_num] || 0) + 1;

                        const redPlayed = currentMatchCounts[m.red_squad_num];
                        const bluePlayed = currentMatchCounts[m.blue_squad_num];

                        return `
                        <div class="glass-card" style="margin-bottom: 10px; padding: 12px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${isCompleted ? 'var(--accent-green)' : 'var(--glass-border)'};">
                            <div style="flex: 1; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <span class="accent-red" style="font-weight: 700; ${redWon ? 'background: rgba(255,77,77,0.2); padding: 2px 8px; border-radius: 4px;' : 'opacity: 0.7;'}">
                                    ${m.red_squad_num}조 <span style="font-size: 0.65rem; opacity: 0.8; color: white;">(${redPlayed}회)</span>
                                </span>
                                ${isCompleted ?
                                `<span style="font-weight: 900; font-size: 1.3rem; color: #000000; background: #eee; padding: 2px 10px; border-radius: 4px;">${m.red_score}</span>` :
                                `<input type="number" id="direct-red-score-${idx}" value="0" style="width: 100px; height: 35px; background: #ffffff; border: 1px solid #ccc; border-radius: 4px; color: #000000 !important; -webkit-text-fill-color: #000000; text-align: center; font-weight: 800; font-size: 1.2rem;">`
                            }
                            </div>
                            
                            <div style="padding: 0 10px; opacity: 0.3; font-weight: 800; color: white;">VS</div>

                            <div style="flex: 1; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                ${isCompleted ?
                                `<span style="font-weight: 900; font-size: 1.3rem; color: #000000; background: #eee; padding: 2px 10px; border-radius: 4px;">${m.blue_score}</span>` :
                                `<input type="number" id="direct-blue-score-${idx}" value="0" style="width: 100px; height: 35px; background: #ffffff; border: 1px solid #ccc; border-radius: 4px; color: #000000 !important; -webkit-text-fill-color: #000000; text-align: center; font-weight: 800; font-size: 1.2rem;">`
                            }
                                <span class="accent-blue" style="font-weight: 700; ${blueWon ? 'background: rgba(77,121,255,0.2); padding: 2px 8px; border-radius: 4px;' : 'opacity: 0.7;'}">
                                    ${m.blue_squad_num}조 <span style="font-size: 0.65rem; opacity: 0.8; color: white;">(${bluePlayed}회)</span>
                                </span>
                            </div>

                            <div style="margin-left: 10px;">
                                ${isCompleted ?
                                `<span style="font-size: 0.7rem; color: var(--accent-green); font-weight: 800;">${m.winning_squad_num === 0 ? '무승부' : (redWon ? 'RED 승' : 'BLUE 승')}</span>` :
                                `<button class="action-btn" style="padding: 6px 10px; font-size: 0.75rem; background: var(--accent-green); color: black; border: none; font-weight: 700;" onclick="window.saveEventMatchDirectly(${id}, ${m.red_squad_num}, ${m.blue_squad_num}, ${idx})">입력</button>`
                            }
                            </div>
                        </div>
                    `}).join('');
                } else {
                    console.log('[Admin] No matches found for this event.');
                    matchesSchedule.innerHTML = '<p style="opacity: 0.5; padding: 20px; text-align: center; color: white;">생성된 경기가 없습니다.</p>';
                }
            } else {
                console.warn('[Admin] matchesSchedule container NOT FOUND!');
            }
        } catch (e) {
            console.error('[Admin] Error rendering matches schedule:', e);
        }

        // Helper to save match result directly from the schedule list
        (window as any).saveEventMatchDirectly = async (eventId: number, red: number, blue: number, idx: number) => {
            const redScoreInput = document.getElementById(`direct-red-score-${idx}`) as HTMLInputElement;
            const blueScoreInput = document.getElementById(`direct-blue-score-${idx}`) as HTMLInputElement;

            if (!redScoreInput || !blueScoreInput) return;

            const redScore = parseInt(redScoreInput.value);
            const blueScore = parseInt(blueScoreInput.value);

            if (isNaN(redScore) || isNaN(blueScore)) {
                alert('점수를 입력해 주세요.');
                return;
            }

            let winningSquadNum = 0; // Default to 0 for draw
            if (redScore > blueScore) winningSquadNum = red;
            else if (blueScore > redScore) winningSquadNum = blue;
            // if redScore == blueScore, it remains 0

            if (!confirm(`${red}조 ${redScore} : ${blueScore} ${blue}조 결과를 저장하시겠습니까?`)) return;

            try {
                const response = await fetch('/api/admin/events/matches/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventId,
                        redSquadNum: red,
                        blueSquadNum: blue,
                        redScore,
                        blueScore,
                        winningSquadNum
                    })
                });

                if (response.ok) {
                    alert('결과가 저장되었습니다.');
                    (window as any).loadEventDetails(eventId);
                } else {
                    const err = await response.json();
                    alert('저장 실패: ' + (err.message || '알 수 없는 오류'));
                }
            } catch (e) {
                alert('서버 오류 발생');
            }
        };

        // Setup Buttons
        const b1 = document.getElementById('btn-batch-squad');
        if (b1) b1.onclick = () => (window as any).batchCreateSquads(id, 8);
        const b2 = document.getElementById('btn-assign-user');
        if (b2) b2.onclick = () => (window as any).assignParticipantToSquad(id);
        const b3 = document.getElementById('btn-save-match');
        if (b3) b3.onclick = () => (window as any).saveEventMatchResultFromTab(id);
        const b4 = document.getElementById('btn-delete-event');
        if (b4) b4.onclick = () => (window as any).deleteEvent(id);

    } catch (e) {
        console.error('Failed to load event details:', e);
    }
};

(window as any).assignParticipantToSquad = async (eventId: number) => {
    const userId = (document.getElementById('event-user-selector') as HTMLSelectElement).value;
    const squadNum = parseInt((document.getElementById('event-squad-num') as HTMLInputElement).value);

    if (!userId) {
        alert('대원을 선택해주세요.');
        return;
    }

    // Assigning to squad involves updating the booking or a separate assignment table.
    // Based on server.js details, participants are from bookings where event_id = id.
    // In server.js line 875: `const { data: bookings } = await supabaseAdmin.from('bookings').select('*, users(name)').eq('event_id', id);`

    // We need to implement the assignment API or reuse an existing one. 
    // Let's assume we need a new API endpoint or update the booking.

    // Wait, let's look at the existing bookings.
    try {
        const res = await fetch(`/api/admin/events/assign-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, userId, squadNum })
        });
        const result = await res.json();
        if (result.success) {
            alert('배정되었습니다.');
            (window as any).loadEventDetails(eventId);
        } else {
            alert('배정 실패: ' + result.message);
        }
    } catch (e) {
        alert('서버 오류');
    }
};

(window as any).saveEventMatchResultFromTab = async (eventId: number) => {
    const redSquad = parseInt((document.getElementById('match-red-squad') as HTMLSelectElement).value);
    const blueSquad = parseInt((document.getElementById('match-blue-squad') as HTMLSelectElement).value);
    const redScore = parseInt((document.getElementById('match-red-score') as HTMLInputElement).value);
    const blueScore = parseInt((document.getElementById('match-blue-score') as HTMLInputElement).value);
    const mvpUserId = (document.getElementById('match-mvp-user') as HTMLSelectElement).value;

    if (!redSquad || !blueSquad) {
        alert('조를 선택해주세요.');
        return;
    }

    let winningSquadNum = 0;
    if (redScore > blueScore) winningSquadNum = redSquad;
    else if (blueScore > redScore) winningSquadNum = blueSquad;

    const confirm = window.confirm('결과를 저장하시겠습니까?');
    if (!confirm) return;

    const res = await postAdmin('/events/matches/save', {
        eventId,
        redSquadNum: redSquad,
        blueSquadNum: blueSquad,
        redScore,
        blueScore,
        winningSquadNum,
        mvpUserId: mvpUserId ? parseInt(mvpUserId) : null
    });

    if (res.success) {
        alert('저장되었습니다.');
        (window as any).loadEventDetails(eventId);
    } else {
        alert('실패: ' + res.message);
    }
};

(window as any).deleteEvent = async (id: number) => {
    if (confirm('대회를 정말 삭제하시겠습니까? 모든 관련 데이터가 삭제될 수 있습니다.')) {
        const res = await postAdmin('/events/delete', { id });
        if (res.success) {
            alert('삭제되었습니다.');
            document.getElementById('event-detail-section')!.style.display = 'none';
            loadEvents();
        } else {
            alert('삭제 실패');
        }
    }
};

// --- End of Script ---
