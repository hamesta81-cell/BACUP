import './style.css'

interface UserProfile {
    name: string;
    level: string;
    xp: number;
    membership_type?: string;
    membership_expiry?: string;
}

interface Timeslot {
    id: number;
    date: string;
    time_start: string;
    time_end: string;
    price: number;
    capacity: number;
    booked: number;
    location: string;
    price_youth: number;
    price_child: number;
}

interface Mission {
    id: number;
    title: string;
    xp_reward: number;
    status: string;
}

interface Ranking {
    id: number;
    category: string;
    name: string;
    score: number;
    rank_info: string;
}

interface XPHistory {
    id: number;
    amount: number;
    reason: string;
    timestamp: string;
}

const API_BASE = '/api';
const KAKAO_JS_KEY = 'da0bd96f8c51605a3ec56c195081016f';

let selectedSlots: Set<number> = new Set();
let allSlots: Timeslot[] = [];
let counts = { adult: 0, youth: 0, child: 0 };

// Initialize Kakao
const initKakao = () => {
    if ((window as any).Kakao) {
        if (!(window as any).Kakao.isInitialized()) {
            (window as any).Kakao.init(KAKAO_JS_KEY);
            console.log('Kakao SDK Initialized');
        }
    }
};
initKakao();

// Profile Update Handlers
(window as any).showProfileEdit = () => {
    const modal = document.getElementById('profile-edit-modal');
    const input = document.getElementById('new-nickname-input') as HTMLInputElement;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (modal && input) {
        input.value = user.name || '';
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
};

(window as any).closeProfileModal = () => {
    const modal = document.getElementById('profile-edit-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
};

(window as any).submitProfileUpdate = async () => {
    const input = document.getElementById('new-nickname-input') as HTMLInputElement;
    const newName = input?.value.trim();

    if (!newName) {
        alert('닉네임을 입력해 주세요.');
        return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
        alert('사용자 정보를 찾을 수 없습니다. 다시 로그인해 주세요.');
        return;
    }

    try {
        const result = await postData('/api/user/update', {
            userId: user.id,
            name: newName
        });

        if (result.success) {
            localStorage.setItem('user', JSON.stringify(result.user));
            updateProfileUI(result.user);
            (window as any).closeProfileModal();
            alert('프로필이 성공적으로 변경되었습니다.');
        } else {
            alert('업데이트 실패: ' + result.message);
        }
    } catch (e: any) {
        alert('오류가 발생했습니다: ' + e.message);
    }
};

async function fetchData<T>(endpoint: string): Promise<T> {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const separator = endpoint.includes('?') ? '&' : '?';
    const query = user.id ? `${separator}userId=${user.id}` : '';
    const response = await fetch(`${API_BASE}${endpoint}${query}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return response.json();
}

async function postData(endpoint: string, body: object) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, userId: user.id })
    });
    return response.json();
}

function updateProfileUI(user: UserProfile) {
    const nameEl = document.getElementById('user-name');
    const levelEl = document.getElementById('user-level');
    const xpTextEl = document.getElementById('xp-text');
    const xpFillEl = document.getElementById('xp-progress');
    const eliteBadgeEl = document.getElementById('elite-badge');
    const membershipStatusEl = document.getElementById('membership-status');

    if (nameEl) nameEl.textContent = `@${user.name}`;
    if (levelEl) levelEl.textContent = user.level;

    // Membership Display
    if (eliteBadgeEl) {
        eliteBadgeEl.style.display = user.membership_type === 'ELITE' ? 'inline-block' : 'none';
    }
    if (membershipStatusEl) {
        if (user.membership_type === 'ELITE') {
            const expiry = user.membership_expiry ? new Date(user.membership_expiry).toLocaleDateString() : '무제한';
            membershipStatusEl.textContent = `| Elite Pass (~${expiry})`;
        } else {
            membershipStatusEl.textContent = '';
        }
    }

    const nextLevelXp = 800; // Mock current max
    const progress = (user.xp / nextLevelXp) * 100;

    if (xpTextEl) xpTextEl.textContent = `${user.xp} / ${nextLevelXp} XP`;
    if (xpFillEl) xpFillEl.style.width = `${progress}%`;

    // Handle Team Assignment Display
    const teamInfoEl = document.getElementById('user-team-info');
    if (teamInfoEl) {
        if ((user as any).checked_in && (user as any).team_id) {
            teamInfoEl.innerHTML = `
                <div class="team-badge ${(user as any).team_id}" style="display:inline-flex; align-items:center; gap:8px; padding:4px 12px; border-radius:20px; background: ${(user as any).team_id === 'RED' ? '#ff4d4d22' : '#4d79ff22'}; border:1px solid ${(user as any).team_id === 'RED' ? '#ff4d4d' : '#4d79ff'}; margin-top:8px;">
                    <span style="font-size:0.7rem; color:${(user as any).team_id === 'RED' ? '#ff4d4d' : '#4d79ff'}; font-weight:900;">${(user as any).team_id === 'RED' ? '🔴 RED TEAM' : '🔵 BLUE TEAM'}</span>
                    <span style="font-size:0.7rem; opacity:0.8;">| SQ-${(user as any).squad_num}</span>
                </div>
            `;
        } else {
            teamInfoEl.innerHTML = '';
        }
    }
}

function renderTimeslots(slots: Timeslot[]) {
    const listEl = document.getElementById('timeslot-list');
    if (!listEl) return;

    listEl.innerHTML = slots.map(slot => `
        <div class="glass-card slot-card ${selectedSlots.has(slot.id) ? 'selected' : ''}" id="slot-${slot.id}" onclick="window.openDetailBooking(${slot.id})">
            <div class="slot-select-badge" onclick="event.stopPropagation(); window.toggleSlot(${slot.id})"></div>
            <div class="slot-top">
                <div>
                    <h3 class="accent-green">${slot.date}</h3>
                    <p style="font-weight: 700; margin-bottom: 4px;">📍 ${slot.location || '위치 정보 없음'}</p>
                    <p>${slot.time_start} - ${slot.time_end}</p>
                    <p class="slot-booked">남은 정원: ${slot.capacity - slot.booked} / ${slot.capacity}</p>
                </div>
                <div class="slot-price">
                    <div style="font-size: 1rem;">${slot.price.toLocaleString()}원</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); opacity: 0.7;">어린이: ${(slot.price_child || 0).toLocaleString()}원</div>
                </div>
            </div>
            ${slot.booked >= slot.capacity ? '<div class="sold-out-overlay">매진</div>' : ''}
        </div>
    `).join('');
}

function renderMissions(missions: Mission[]) {
    const listEl = document.getElementById('mission-list');
    if (!listEl) return;

    listEl.innerHTML = missions.map(mission => `
        <div class="mission-item ${mission.status === 'COMPLETED' ? 'completed' : ''}">
            <div class="mission-icon">
                ${mission.status === 'COMPLETED' ? '✅' : '🎯'}
            </div>
            <div class="mission-details">
                <h4>${mission.title}</h4>
                <p>${mission.status === 'COMPLETED' ? '완료됨' : `+${mission.xp_reward} XP`}</p>
            </div>
        </div>
    `).join('');
}

async function renderRankings(category: string) {
    const listEl = document.getElementById('ranking-list');
    const recordsEl = document.getElementById('record-room-list');
    if (!listEl || !recordsEl) return;

    listEl.style.display = 'block';
    recordsEl.style.display = 'none';

    try {
        let rankings: any[] = [];
        if (category === 'individual') {
            rankings = await fetchData<Ranking[]>(`/rankings/${category}`);
        } else {
            // Team, Family, Taekwondo categories
            rankings = await fetchData<any[]>(`/groups?category=${category}`);
        }

        listEl.innerHTML = rankings.map((rank, index) => {
            const name = rank.name;
            const score = rank.score;
            const info = rank.rank_info || (category === 'individual' ? '' : `${rank.category.toUpperCase()}`);
            const displayScore = category === 'individual' ? `${score.toLocaleString()}명 초대` : `${score.toLocaleString()} GP`;

            // For teams/families, show W-L-D
            const wldStats = category !== 'individual' ? `
                <div style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 2px;">
                    <span style="color: var(--accent-green);">${rank.wins || 0}승</span> 
                    <span style="color: #ff4d4d;">${rank.losses || 0}패</span> 
                    <span>${rank.draws || 0}무</span>
                </div>
            ` : '';

            return `
                <div class="rank-item" style="height: auto; padding: 12px 0; align-items: flex-start;">
                    <div style="display: flex; align-items: flex-start;">
                        <span style="font-weight: 900; width: 24px; color: var(--text-secondary); margin-top: 3px;">${index + 1}</span>
                        <div>
                            <span class="rank-name">${name}</span>
                            <span class="rank-meta">${info}</span>
                            ${wldStats}
                        </div>
                    </div>
                    <span class="rank-score" style="margin-top: 3px;">${displayScore}</span>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Failed to load rankings:', e);
    }
}

async function renderMatchRecords() {
    const listEl = document.getElementById('ranking-list');
    const recordsEl = document.getElementById('record-room-list');
    if (!listEl || !recordsEl) return;

    listEl.style.display = 'none';
    recordsEl.style.display = 'block';

    recordsEl.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.5;">기록을 불러오는 중...</div>';

    try {
        const records = await fetchData<any[]>('/match-records');
        if (records.length === 0) {
            recordsEl.innerHTML = '<div style="text-align:center; padding:30px; opacity:0.5;">아직 등록된 경기 기록이 없습니다.</div>';
            return;
        }

        recordsEl.innerHTML = records.map(record => `
            <div class="glass-card record-item" style="margin-bottom: 12px; border-left: 4px solid ${record.winning_team === 'RED' ? '#ff4d4d' : '#4d79ff'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <span style="font-size: 0.6rem; opacity: 0.6;">${new Date(record.created_at).toLocaleDateString()} | ${record.timeslots.location}</span>
                        <h4 style="margin: 5px 0;">${record.match_report || '전투 종료'}</h4>
                    </div>
                </div>
                <div style="display: flex; gap: 20px; align-items: center;">
                    <div style="text-align:center;">
                        <p style="font-size: 0.6rem; opacity: 0.6;">RED</p>
                        <h3 style="color: #ff4d4d; margin:0;">${record.red_score}</h3>
                    </div>
                    <div style="opacity: 0.3;">VS</div>
                    <div style="text-align:center;">
                        <p style="font-size: 0.6rem; opacity: 0.6;">BLUE</p>
                        <h3 style="color: #4d79ff; margin:0;">${record.blue_score}</h3>
                    </div>
                    <div style="margin-left: auto; text-align: right;">
                        <p style="font-size: 0.6rem; color: #ff9f43; font-weight: 800;">🎖️ MVP</p>
                        <p style="font-size: 0.8rem; font-weight: 700;">${record.users ? record.users.name : '미선정'}</p>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        recordsEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--accent-red);">기록 로드 실패</div>';
    }
}

async function renderXPHistory() {
    const listEl = document.getElementById('xp-history-list');
    if (!listEl) return;

    try {
        const history = await fetchData<XPHistory[]>('/user/xp-history');
        if (history.length === 0) {
            listEl.innerHTML = '<p style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.5;">활동 내역이 없습니다.</p>';
            return;
        }

        listEl.innerHTML = history.map(item => `
            <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.75rem;">
                <span style="color: var(--text-primary);">${item.reason}</span>
                <span style="color: var(--accent-green); font-weight: 800;">+${item.amount} XP</span>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load XP history:', e);
    }
}

function updateBookingSummary() {
    // Obsolete: Bottom bar removed. Sidebar now handles real-time updates via calculateFinalPrice.
}

function calculateFinalPrice() {
    let total = 0;
    selectedSlots.forEach(id => {
        const slot = allSlots.find(s => s.id === id);
        if (slot) {
            total += (slot.price * counts.adult);
            total += (slot.price_youth * counts.youth);
            total += (slot.price_child * counts.child);
        }
    });

    const modalTotal = document.getElementById('modal-total-price');
    if (modalTotal) modalTotal.textContent = `${total.toLocaleString()}원`;
    return total;
}

(window as any).toggleSlot = (id: number) => {
    const slot = allSlots.find(s => s.id === id);
    if (slot && slot.booked >= slot.capacity) return;

    if (selectedSlots.has(id)) {
        selectedSlots.delete(id);
    } else {
        selectedSlots.add(id);
    }
    renderTimeslots(allSlots);
    updateBookingSummary();
};

(window as any).openDetailBooking = (id: number) => {
    const slot = allSlots.find(s => s.id === id);
    if (slot && slot.booked >= slot.capacity) return;

    // If not selected, select it first
    if (!selectedSlots.has(id)) {
        selectedSlots.add(id);
    }

    renderTimeslots(allSlots);
    updateBookingSummary();

    // Trigger the modal (same logic as Next button click)
    const modal = document.getElementById('participant-modal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        // Set base prices
        const targetSlot = allSlots.find(s => s.id === id);
        if (targetSlot) {
            document.getElementById('adult-price-label')!.textContent = `${(targetSlot.price || 0).toLocaleString()}원`;
            document.getElementById('youth-price-label')!.textContent = `${(targetSlot.price_youth || 0).toLocaleString()}원`;
            document.getElementById('child-price-label')!.textContent = `${(targetSlot.price_child || 0).toLocaleString()}원`;
        }
        calculateFinalPrice();
    }
};

(window as any).changeCount = (type: 'adult' | 'youth' | 'child', delta: number) => {
    const newVal = counts[type] + delta;
    if (newVal >= 0 && newVal <= 10) { // Limit max 10 for safety
        counts[type] = newVal;
        const countEl = document.getElementById(`count-${type}`);
        if (countEl) countEl.textContent = counts[type].toString();
        calculateFinalPrice();
    }
};

// Global exposure for event handlers
(window as any).bookSlot = async (slotId: number) => {
    try {
        const result = await postData('/bookings', { slotId });
        if (result.success) {
            alert('미션이 예약되었습니다! 장비를 확인하세요.');
            initApplication(); // Refresh
        } else {
            alert(result.message);
        }
    } catch (e) {
        console.error('Booking failed', e);
    }
};

(window as any).handleQRCheckin = async (qrCode: string) => {
    try {
        const result = await postData('/checkin', { qrCode }); // Changed endpoint from /api/checkin to /checkin to match API_BASE usage
        if (result.success) {
            // Visual feedback
            const container = document.querySelector('.container');
            const alert = document.createElement('div');
            alert.className = 'glass-card checkin-toast active';
            alert.innerHTML = `
                <div class="toast-content">
                    <span class="toast-icon">⚡</span>
                    <div>
                        <h4>체크인 성공!</h4>
                        <p>${result.message}</p>
                    </div>
                </div>
            `;
            container?.appendChild(alert);
            setTimeout(() => {
                alert.classList.remove('active');
                alert.remove(); // Remove element after animation
            }, 5000);

            initApplication(); // Refresh stats
        } else {
            // Handle check-in failure, e.g., show an error toast
            const container = document.querySelector('.container');
            const alert = document.createElement('div');
            alert.className = 'glass-card checkin-toast error active';
            alert.innerHTML = `
                <div class="toast-content">
                    <span class="toast-icon">❌</span>
                    <div>
                        <h4>체크인 실패!</h4>
                        <p>${result.message || '알 수 없는 오류가 발생했습니다.'}</p>
                    </div>
                </div>
            `;
            container?.appendChild(alert);
            setTimeout(() => {
                alert.classList.remove('active');
                alert.remove();
            }, 5000);
        }
    } catch (e) {
        console.error('Check-in failed', e);
        // Show a generic error toast for network issues etc.
        const container = document.querySelector('.container');
        const alert = document.createElement('div');
        alert.className = 'glass-card checkin-toast error active';
        alert.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">⚠️</span>
                <div>
                    <h4>오류 발생!</h4>
                    <p>체크인 중 문제가 발생했습니다.</p>
                </div>
            </div>
        `;
        container?.appendChild(alert);
        setTimeout(() => {
            alert.classList.remove('active');
            alert.remove();
        }, 5000);
    }
};

// Helper functions to fetch and render specific sections
async function renderProfile() {
    try {
        const user = await fetchData<UserProfile>('/user/profile');
        updateProfileUI(user);
    } catch (e) {
        console.error('Failed to load user profile:', e);
    }
}

async function renderTimeSlots() {
    try {
        allSlots = await fetchData<Timeslot[]>('/timeslots');
        console.log('Fetched slots:', allSlots);
        if (allSlots.length === 0) {
            const listEl = document.getElementById('timeslot-list');
            if (listEl) listEl.innerHTML = '<p style="text-align:center; opacity:0.5; padding:20px;">현재 예약 가능한 매치가 없습니다.</p>';
        } else {
            renderTimeslots(allSlots);
        }
        updateBookingSummary();
    } catch (e) {
        console.error('Failed to load timeslots:', e);
    }
}

async function renderMissionsContainer() {
    try {
        const missions = await fetchData<Mission[]>('/missions');
        renderMissions(missions);
    } catch (e) {
        console.error('Failed to load missions:', e);
    }
}

async function handleKakaoCode(code: string) {
    const overlay = document.getElementById('login-overlay');
    try {
        const redirectUri = 'https://club-five-xi.vercel.app';
        const result = await postData('/auth/kakao/code', {
            code,
            redirectUri
        });
        if (result.success) {
            // Clean URL
            window.history.replaceState({}, document.title, '/');
            if (overlay) overlay.style.display = 'none';
            localStorage.setItem('user', JSON.stringify(result.user));
            await initApplication();

            // After login, check for pending coupon
            const pendingCoupon = sessionStorage.getItem('pending_coupon');
            if (pendingCoupon) {
                sessionStorage.removeItem('pending_coupon');
                processCouponAuto(pendingCoupon);
            }
        } else {
            alert('로그인 인증 실패: ' + result.message);
        }
    } catch (e) {
        console.error('Code auth failed', e);
        alert('서버 인증 중 오류가 발생했습니다.');
    }
}

async function renderBookings() {
    const bookingsContainer = document.getElementById('my-bookings-container');
    if (!bookingsContainer) return;

    try {
        const bookings = await fetchData<any[]>('/bookings');
        if (bookings.length === 0) {
            bookingsContainer.innerHTML = '<p style="text-align:center; opacity:0.5; padding:20px;">내 예약 내역이 없습니다.</p>';
            return;
        }

        bookingsContainer.innerHTML = bookings.map(b => `
            <div class="glass-card slot-card" style="border-left: 4px solid ${b.status === 'PAID' ? 'var(--accent-green)' : '#ff4d4d'};">
                <div class="slot-top">
                    <div>
                        <h3 class="accent-purple">${b.date}</h3>
                        <p class="slot-booked">${b.time_start} - ${b.time_end} | ${b.location}</p>
                    </div>
                    <div style="text-align: right;">
                        <span class="status-badge ${b.status?.toLowerCase() || 'pending'}">
                            ${b.status === 'PAID' ? '예약 확정' : '입금 대기'}
                        </span>
                    </div>
                </div>
                ${b.status === 'PENDING' ? `
                    <div style="margin-top: 15px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 12px; font-size: 0.8rem;">
                        <p style="color: var(--text-secondary); line-height: 1.4;">
                            <span style="color: #ff4d4d; font-weight: 800;">⚠️ 입금 대기 중:</span><br>
                            기업은행 010-4414-7474 (예금주: 방진혁)<br>
                            입금 확인 후 1시간 내로 '예약 확정' 처리됩니다.
                        </p>
                    </div>
                ` : `
                    <p style="margin-top: 10px; font-size: 0.8rem; color: var(--accent-green);">✅ 예약이 확정되었습니다. 매치 시간에 맞춰 방문해주세요!</p>
                `}
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load bookings:', e);
    }
}

// --- Match Center Results & Standings ---
let currentSelectedEventId: number | null = null;

(window as any).switchMatchTab = (tab: 'results' | 'standings') => {
    const resultsView = document.getElementById('match-results-view');
    const standingsView = document.getElementById('match-standings-view');
    const tabs = document.querySelectorAll('.m-tab');

    if (resultsView && standingsView) {
        if (tab === 'results') {
            resultsView.style.display = 'block';
            standingsView.style.display = 'none';
            tabs[0].classList.add('active');
            tabs[1].classList.remove('active');
        } else {
            resultsView.style.display = 'none';
            standingsView.style.display = 'block';
            tabs[0].classList.remove('active');
            tabs[1].classList.add('active');
        }
    }
};

(window as any).selectMatchEvent = (eventId: number) => {
    currentSelectedEventId = eventId;
    renderMatchCenter(eventId);
    updateEventNavUI(eventId);
};

function updateEventNavUI(activeId: number) {
    const chips = document.querySelectorAll('.event-chip');
    chips.forEach(chip => {
        const id = parseInt(chip.getAttribute('data-id') || '0');
        if (id === activeId) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

async function renderOngoingEvents() {
    const navEl = document.getElementById('ongoing-events-nav');
    if (!navEl) return;

    try {
        const events = await fetchData<any[]>('/events');
        if (!events || events.length === 0) {
            navEl.innerHTML = '<p style="font-size: 0.7rem; opacity: 0.5;">진행 중인 이벤트가 없습니다.</p>';
            return;
        }

        navEl.innerHTML = events.map((ev, idx) => `
            <div class="event-chip ${idx === 0 && !currentSelectedEventId ? 'active' : ''}" 
                 data-id="${ev.id}"
                 onclick="window.selectMatchEvent(${ev.id})">
                ${ev.name}
            </div>
        `).join('');

        // If no event selected yet, default to first
        if (!currentSelectedEventId && events.length > 0) {
            currentSelectedEventId = events[0].id;
        }
    } catch (e) {
        console.error('Failed to load ongoing events:', e);
    }
}

async function renderMatchCenter(eventId?: number) {
    const listEl = document.getElementById('live-match-list');
    const standingsEl = document.getElementById('match-standings-body');
    if (!listEl || !standingsEl) return;

    // Show loading state
    listEl.innerHTML = '<p style="text-align:center; opacity:0.5; padding:20px; font-size: 0.8rem;">데이터를 불러오는 중...</p>';

    try {
        let targetId = eventId;

        if (!targetId) {
            const events = await fetchData<any[]>('/events');
            if (!events || events.length === 0) {
                listEl.innerHTML = '<p style="text-align:center; opacity:0.5; padding:20px; font-size: 0.8rem;">현재 진행 중인 대회가 없습니다.</p>';
                return;
            }
            targetId = events[0].id; // Default to latest
            currentSelectedEventId = targetId as number;
        }

        const res = await fetch(`${API_BASE}/events/${targetId}/details`);
        const data = await res.json();
        const { matches, standings } = data;

        // 1. Render Matches
        if (matches && matches.length > 0) {
            listEl.innerHTML = matches.map((m: any) => {
                const redWon = m.winning_squad_num === m.red_squad_num;
                const blueWon = m.winning_squad_num === m.blue_squad_num;

                return `
                    <div class="match-card-v2">
                        <div class="team-info ${redWon ? 'winner' : ''}">
                            <span style="font-size: 0.6rem; color: #ff4d4d;">RED</span>
                            <h4>${m.red_squad_num}조</h4>
                        </div>
                        <div class="score-v2 ${redWon ? 'winner' : ''}">${m.red_score ?? 0}</div>
                        <div class="match-vs">VS</div>
                        <div class="score-v2 ${blueWon ? 'winner' : ''}">${m.blue_score ?? 0}</div>
                        <div class="team-info ${blueWon ? 'winner' : ''}">
                            <span style="font-size: 0.6rem; color: #4d79ff;">BLUE</span>
                            <h4>${m.blue_squad_num}조</h4>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            listEl.innerHTML = '<p style="text-align:center; opacity:0.5; padding:20px; font-size: 0.8rem;">아직 진행된 경기가 없습니다.</p>';
        }

        // 2. Render Standings
        if (standings && standings.length > 0) {
            standingsEl.innerHTML = standings.map((s: any, idx: number) => `
                <tr>
                    <td><div class="rank-num">${idx + 1}</div></td>
                    <td style="font-weight: 700;">${s.squad_num}조</td>
                    <td>${s.wins}</td>
                    <td>${s.losses}</td>
                    <td class="accent-green" style="font-weight: 900;">${s.points}</td>
                </tr>
            `).join('');
        } else {
            standingsEl.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; opacity:0.5;">데이터가 없습니다.</td></tr>';
        }
    } catch (e) {
        console.error('Failed to load match center:', e);
        listEl.innerHTML = '<p style="text-align:center; color: #ff4d4d; padding:20px; font-size: 0.8rem;">데이터 로드 실패</p>';
    }
}

async function initApplication() {
    await Promise.all([
        renderProfile(),
        renderTimeSlots(),
        renderMissionsContainer(),
        renderRankings('individual'), // Default
        renderXPHistory(),
        renderBookings(),
        renderOngoingEvents(),
        renderMatchCenter()
    ]);

    // Handle QR Check-in from URL
    const qrParams = new URLSearchParams(window.location.search);
    const qrCode = qrParams.get('qr');
    if (qrCode) {
        // Remove parameter from URL to prevent double check-in on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
        (window as any).handleQRCheckin(qrCode);
    }
}

// Logout Handler
(window as any).handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
        localStorage.removeItem('user');
        window.location.href = '/landing.html';
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Note: urlParams is already declared in initApplication or check functions if needed, 
    // but here we use the one scoped to this listener.
    const urlParams = new URLSearchParams(window.location.search);
    const overlay = document.getElementById('login-overlay');
    const loginBtn = document.getElementById('kakao-login-btn');

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            // Kakao SDK is already initialized at the top level
            if (!(window as any).Kakao || !(window as any).Kakao.isInitialized()) {
                initKakao();
                if (!(window as any).Kakao || !(window as any).Kakao.isInitialized()) {
                    alert('카카오 SDK 초기화에 실패했습니다. 잠시 후 상단 홈 버튼을 눌러 다시 시도해주세요.');
                    return;
                }
            }

            try {
                const k = (window as any).Kakao;

                if (!k.Auth) {
                    alert('Kakao.Auth 모듈이 아직 로드되지 않았습니다. 잠시 후 홈 버튼을 눌렀다가 다시 대시보드로 들어와주세요.');
                    console.error('Kakao.Auth is missing. SDK State:', k.isInitialized());
                    return;
                }

                // Removed redundant initialization check here as it's handled above

                if (typeof k.Auth.login === 'function') {
                    console.log('Using Kakao.Auth.login (Popup)');
                    k.Auth.login({
                        success: async (authObj: any) => {
                            try {
                                const referrerId = sessionStorage.getItem('referrerId');
                                const result = await postData('/auth/kakao', {
                                    accessToken: authObj.access_token,
                                    referrerId: referrerId || undefined
                                });
                                if (referrerId) sessionStorage.removeItem('referrerId');

                                if (result.success) {
                                    if (overlay) overlay.style.display = 'none';
                                    localStorage.setItem('user', JSON.stringify(result.user));
                                    await initApplication();

                                    // Check for pending coupon
                                    const pendingCoupon = sessionStorage.getItem('pending_coupon');
                                    if (pendingCoupon) {
                                        sessionStorage.removeItem('pending_coupon');
                                        processCouponAuto(pendingCoupon);
                                    }
                                } else {
                                    alert('로그인 처리 중 오류가 발생했습니다: ' + result.message);
                                }
                            } catch (e: any) {
                                alert('서버 응답 오류가 발생했습니다: ' + (e.message || JSON.stringify(e)));
                            }
                        },
                        fail: (err: any) => {
                            alert('카카오 로그인 취소 또는 오류: ' + JSON.stringify(err));
                        }
                    });
                } else if (typeof k.Auth.authorize === 'function') {
                    console.log('Falling back to Kakao.Auth.authorize (Redirect)');
                    // Redirect approach is safer for some mobile environments
                    const redirectUri = 'https://club-five-xi.vercel.app';
                    console.log('Sending Redirect URI:', redirectUri);
                    // alert('카카오 인증 페이지로 이동합니다. (Redirect URI: ' + redirectUri + ')');
                    k.Auth.authorize({
                        redirectUri
                    });
                } else {
                    alert('사용 가능한 카카오 로그인 함수가 없습니다. 브라우저 호환성을 확인해주세요.');
                }
            } catch (e: any) {
                console.error('Login flow crashed', e);
                alert('로그인 과정 중 치명적 오류가 발생했습니다: ' + (e.message || '알 수 없는 오류'));
            }
        });
    }

    // Auto-login check
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        if (overlay) overlay.style.display = 'none';
        initApplication();
    } else {
        // Enforce login overlay if not logged in
        if (overlay) overlay.style.display = 'flex';
        // Hide dashboard content to prevent "flash" of data if any was in DOM
        const container = document.querySelector('.container') as HTMLElement;
        if (container) container.style.opacity = '0';
    }

    const copyBtn = document.getElementById('copy-link-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (!user.id) {
                alert('로그인이 필요합니다.');
                return;
            }

            // Generate referral link
            const baseUrl = window.location.origin + window.location.pathname;
            const refLink = `${baseUrl}?ref=${user.id}`;

            try {
                await navigator.clipboard.writeText(refLink);
                alert('추천 링크가 복사되었습니다! 친구가 가입하면 XP를 획득합니다!');
            } catch (e) {
                console.error('Clipboard error', e);
                // Fallback
                const input = document.createElement('input');
                input.value = refLink;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                alert('추천 링크가 복사되었습니다!');
            }
        });
    }

    // Check for referral in URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
        sessionStorage.setItem('referrerId', ref);
        // Clean URL to avoid confusion
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Modal handlers
    const nextBtn = document.getElementById('next-booking-btn');
    const modal = document.getElementById('participant-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const confirmBtn = document.getElementById('confirm-booking-btn');

    if (nextBtn && modal) {
        nextBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            // Set base prices in labels (using first selected slot as reference)
            const firstId = Array.from(selectedSlots)[0];
            const firstSlot = allSlots.find(s => s.id === firstId);
            if (firstSlot) {
                document.getElementById('adult-price-label')!.textContent = `${firstSlot.price.toLocaleString()}원`;
                document.getElementById('youth-price-label')!.textContent = `${firstSlot.price_youth.toLocaleString()}원`;
                document.getElementById('child-price-label')!.textContent = `${firstSlot.price_child.toLocaleString()}원`;
            }
            calculateFinalPrice();
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (counts.adult + counts.youth + counts.child === 0) {
                alert('최소 1명 이상의 인원을 선택해주세요.');
                return;
            }

            try {
                const result = await postData('/bookings/multi', {
                    slotIds: Array.from(selectedSlots),
                    counts: counts,
                    totalPrice: calculateFinalPrice()
                });

                if (result.success) {
                    alert('예약이 완료되었습니다! 🎯');
                    selectedSlots.clear();
                    counts = { adult: 0, youth: 0, child: 0 };
                    if (modal) {
                        modal.classList.remove('active');
                        setTimeout(() => { modal.style.display = 'none'; }, 300);
                    }
                    initApplication();
                } else {
                    alert(result.message);
                }
            } catch (e) {
                console.error('Booking failed', e);
            }
        });
    }

    // --- Kakao Auth Code Handling (Redirect Flow) ---
    const code = urlParams.get('code');
    if (code) {
        handleKakaoCode(code);
    }

    // --- Ranking category tabs ---
    const rankingTabs = document.querySelectorAll('.rank-tab');
    rankingTabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            const category = (tab as HTMLElement).dataset.category;
            const target = (tab as HTMLElement).dataset.target;

            // Update UI (active tab)
            rankingTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (target === 'records') {
                await renderMatchRecords();
            } else if (category) {
                await renderRankings(category);
            }
        });
    });

    // --- Coupon & QR ---
    const couponCode = urlParams.get('coupon');
    if (couponCode) {
        // If not logged in yet, save it to session for after login
        if (!localStorage.getItem('user')) {
            sessionStorage.setItem('pending_coupon', couponCode);
            // Also clean URL to prevent loops but keep it in session
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            await processCouponAuto(couponCode);
        }
    }
});

async function processCouponAuto(code: string) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
        console.log('No user ID found for auto-redemption, deferring...');
        sessionStorage.setItem('pending_coupon', code);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/coupons/redeem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, userId: user.id })
        });
        const data = await res.json();
        if (data.success) {
            alert(`[자동 등록] ${data.message}`);
            // Clean up both URL and session
            window.history.replaceState({}, document.title, window.location.pathname);
            sessionStorage.removeItem('pending_coupon');
            initApplication();
        } else {
            console.warn('Auto coupon registration failed:', data.message);
        }
    } catch (e) {
        console.error('Auto coupon failed', e);
    }
}

(window as any).redeemManualCoupon = async () => {
    const input = document.getElementById('coupon-code-input') as HTMLInputElement;
    const code = input.value.trim();
    if (!code) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
        alert('로그인이 필요합니다.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/coupons/redeem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, userId: user.id })
        });
        const data = await res.json();

        if (data.success) {
            alert(data.message);
            input.value = '';
            initApplication();
        } else {
            alert(data.message);
        }
    } catch (e) {
        alert('서버 연결에 실패했습니다.');
    }
};

(window as any).openGroupJoin = (category: string) => {
    const modal = document.getElementById('group-join-modal');
    const title = document.getElementById('group-modal-title');
    const catInput = document.getElementById('group-category-input') as HTMLInputElement;
    if (modal && title && catInput) {
        const labels: any = { team: '팀', family: '가족', taekwondo: '도장' };
        title.textContent = `${labels[category]} 등록/참여`;
        catInput.value = category;
        modal.style.display = 'flex';
    }
};

(window as any).closeGroupModal = () => {
    const modal = document.getElementById('group-join-modal');
    if (modal) modal.style.display = 'none';
};

(window as any).submitGroupJoin = async () => {
    const nameInput = document.getElementById('group-name-input') as HTMLInputElement;
    const catInput = document.getElementById('group-category-input') as HTMLInputElement;
    const name = nameInput.value.trim();
    const category = catInput.value;

    if (!name) {
        alert('이름을 입력해 주세요.');
        return;
    }

    try {
        const res = await postData('/groups/join', { groupName: name, category });
        if (res.success) {
            alert(`[${res.group.name}] 참여가 완료되었습니다.`);
            (window as any).closeGroupModal();
            initApplication();
        } else {
            alert('오류: ' + res.message);
        }
    } catch (e) {
        alert('참여 중 오류가 발생했습니다.');
    }
};
