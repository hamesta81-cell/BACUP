import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, supabaseAdmin } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Helper to log XP changes
async function logXP(userId, amount, reason) {
    // 1. Check for Elite Membership Boost (1.2x)
    const { data: user } = await supabaseAdmin.from('users').select('membership_type, membership_expiry').eq('id', userId).single();

    let finalAmount = amount;
    let finalReason = reason;

    if (user && user.membership_type === 'ELITE') {
        // Check expiry
        const now = new Date();
        const expiry = user.membership_expiry ? new Date(user.membership_expiry) : null;

        if (!expiry || expiry > now) {
            finalAmount = Math.floor(amount * 1.2);
            finalReason = `${reason} (Elite Pass 1.2x Boost Applied)`;
        } else {
            // Membership expired, demote to STANDARD
            await supabaseAdmin.from('users').update({ membership_type: 'STANDARD' }).eq('id', userId);
        }
    }

    await supabaseAdmin.from('xp_history').insert({
        user_id: userId,
        amount: finalAmount,
        reason: finalReason
    });

    // 2. Automatic Group Point Update (10% of XP)
    const gpAmount = Math.floor(finalAmount * 0.1);
    if (gpAmount > 0) {
        const { data: memberships } = await supabaseAdmin.from('group_members').select('group_id').eq('user_id', userId);
        if (memberships && memberships.length > 0) {
            for (const m of memberships) {
                const { data: group } = await supabaseAdmin.from('groups').select('score').eq('id', m.group_id).single();
                await supabaseAdmin.from('groups').update({ score: (group?.score || 0) + gpAmount }).eq('id', m.group_id);
            }
        }
    }

    // 3. Update User Total XP
    const { data: u } = await supabaseAdmin.from('users').select('xp').eq('id', userId).single();
    await supabaseAdmin.from('users').update({ xp: (u?.xp || 0) + finalAmount }).eq('id', userId);
}

app.use(cors());
app.use(express.json());

// Static file serving
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));

// Serve landing page as default
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'landing.html'));
});

// Explicit route for dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Endpoints
app.post('/api/auth/kakao', async (req, res) => {
    const { accessToken, referrerId } = req.body;
    await processKakaoUser(accessToken, res, referrerId);
});

app.post('/api/auth/kakao/code', async (req, res) => {
    const { code, redirectUri, referrerId } = req.body;
    const KAKAO_KEY = process.env.KAKAO_REST_KEY || 'da0bd96f8c51605a3ec56c195081016f';
    const KAKAO_SECRET = process.env.KAKAO_CLIENT_SECRET;

    try {
        // Exchange code for token
        const params = {
            grant_type: 'authorization_code',
            client_id: KAKAO_KEY,
            redirect_uri: redirectUri,
            code: code
        };

        if (KAKAO_SECRET) {
            params.client_secret = KAKAO_SECRET;
        }

        const tokenResponse = await axios.post('https://kauth.kakao.com/oauth/token', null, {
            params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;
        await processKakaoUser(accessToken, res, referrerId);
    } catch (error) {
        console.error('Kakao code exchange error:', error.response?.data || error.message);
        res.status(401).json({ success: false, message: '카카오 코드 인증 실패' });
    }
});

async function processKakaoUser(accessToken, res, referrerId) {
    try {
        const response = await axios.get('https://kapi.kakao.com/v2/user/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const { id, properties } = response.data;
        const nickname = properties?.nickname || `Player_${id}`;

        // Upsert user
        let { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('kakao_id', id)
            .single();

        if (!user) {
            const { data: newUser, error: insertError } = await supabaseAdmin
                .from('users')
                .insert({ kakao_id: id, name: nickname, level: 'Scout', xp: 0 })
                .select()
                .single();
            user = newUser;

            // Handle referral bonus if it's a new user
            if (referrerId) {
                console.log(`[Referral] New user ${user.id} joined via referrer ${referrerId}`);
                const xpBonus = 200;
                const { data: referrer, error: refError } = await supabaseAdmin
                    .from('users')
                    .select('referrals, xp')
                    .eq('id', referrerId)
                    .single();

                if (referrer && !refError) {
                    await supabaseAdmin
                        .from('users')
                        .update({
                            referrals: (referrer.referrals || 0) + 1,
                            xp: (referrer.xp || 0) + xpBonus
                        })
                        .eq('id', referrerId);

                    await logXP(referrerId, xpBonus, `신규 대원 가입 추천 보상 (신규 ID: ${user.id})`);
                    console.log(`[Referral] Awarded ${xpBonus} XP to ${referrerId}`);
                }
            }
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error('Kakao profile error:', error.message);
        res.status(401).json({ success: false, message: '프로필 정보 가져오기 실패' });
    }
}

app.get('/api/user/profile', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: '로그인이 필요합니다.' });

    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    res.json(user);
});

app.post('/api/user/update', async (req, res) => {
    const { userId, name } = req.body;
    if (!userId || !name) return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' });

    const { data: user, error } = await supabaseAdmin
        .from('users')
        .update({ name: name })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        console.error('Update profile error:', error.message);
        return res.status(500).json({ success: false, message: '프로필 업데이트 실패' });
    }

    res.json({ success: true, user });
});

// Group APIs
app.get('/api/groups', async (req, res) => {
    const { category } = req.query;
    let query = supabase.from('groups').select('*');
    if (category) query = query.eq('category', category);
    const { data: groups } = await query.order('score', { ascending: false });
    res.json(groups || []);
});

app.post('/api/groups/join', async (req, res) => {
    const { userId, groupName, category } = req.body;
    if (!userId || !groupName) return res.status(400).json({ success: false });

    try {
        // Find or Create group
        let { data: group } = await supabaseAdmin.from('groups').select('*').eq('name', groupName).single();
        if (!group) {
            const { data: newGroup, error: groupErr } = await supabaseAdmin
                .from('groups')
                .insert({ name: groupName, category: category || 'team' })
                .select()
                .single();
            if (groupErr) throw groupErr;
            group = newGroup;
        }

        // Join member
        const { error: joinErr } = await supabaseAdmin.from('group_members').insert({
            group_id: group.id,
            user_id: userId,
            role: 'member'
        });

        if (joinErr && joinErr.code !== '23505') throw joinErr; // Ignore duplicate join

        res.json({ success: true, group });
    } catch (e) {
        console.error('Group join error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

app.get('/api/timeslots', async (req, res) => {
    const { data: slots } = await supabase.from('timeslots').select('*').order('id', { ascending: true });
    res.json(slots || []);
});

app.get('/api/missions', async (req, res) => {
    const { data: missions } = await supabase.from('missions').select('*');
    res.json(missions || []);
});

app.get('/api/rankings/:category', async (req, res) => {
    const { category } = req.params;
    const { data: rankings } = await supabase
        .from('rankings')
        .select('*')
        .eq('category', category)
        .order('score', { ascending: false });
    res.json(rankings || []);
});

app.post('/api/bookings/multi', async (req, res) => {
    const { slotIds, counts, totalPrice, userId } = req.body;
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

    const totalPeople = (counts.adult || 0) + (counts.youth || 0) + (counts.child || 0);

    if (totalPeople === 0) {
        return res.status(400).json({ success: false, message: '최소 1명 이상의 인원을 선택해야 합니다.' });
    }

    try {
        for (const slotId of slotIds) {
            const { data: slot } = await supabaseAdmin
                .from('timeslots')
                .select('*')
                .eq('id', slotId)
                .single();

            if (!slot) throw new Error(`시간대 정보를 찾을 수 없습니다. (ID: ${slotId})`);
            if (slot.capacity - slot.booked < totalPeople) {
                throw new Error(`${slot.date} ${slot.time_start} 슬롯의 잔여 인원이 부족합니다.`);
            }

            await supabaseAdmin
                .from('timeslots')
                .update({ booked: slot.booked + totalPeople })
                .eq('id', slotId);

            await supabaseAdmin
                .from('bookings')
                .insert({ user_id: userId, slot_id: slotId, status: 'PENDING' });
        }

        res.json({ success: true, message: '예약 신청이 완료되었습니다. 입금 확인 후 확정됩니다!' });
    } catch (error) {
        console.error('Booking error:', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
});

app.post('/api/referrals', async (req, res) => {
    // This endpoint no longer awards automatic XP to prevent abuse.
    // XP is now awarded upon actual registration in processKakaoUser.
    res.json({ success: true, message: '추천 링크 시스템이 업데이트되었습니다.' });
});

app.post('/api/checkin', async (req, res) => {
    const { qrCode, userId } = req.body;
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

    try {
        // 1. Find the current or upcoming PAID booking for this user
        const now = new Date();
        const { data: bookings, error: bookingErr } = await supabaseAdmin
            .from('bookings')
            .select('*, timeslots(*)')
            .eq('user_id', userId)
            .eq('status', 'PAID')
            .eq('checked_in', false);

        if (bookingErr || !bookings || bookings.length === 0) {
            return res.status(400).json({ success: false, message: '체크인 가능한 확정된 예약이 없습니다.' });
        }

        // Ideally find the one closest to now, but for simplicity take the first one
        const booking = bookings[0];

        // 2. Assign Team and Squad
        // Strategy: Get all checked-in people for this slot and distribute
        const { data: checkedInCount } = await supabaseAdmin
            .from('bookings')
            .select('id', { count: 'exact' })
            .eq('slot_id', booking.slot_id)
            .eq('checked_in', true);

        const count = checkedInCount?.length || 0;
        const teamId = (count % 2 === 0) ? 'RED' : 'BLUE';
        const squadNum = Math.floor(count / 2) + 1; // 1 to 8

        if (squadNum > 16) { // Safety cap for 32 players
            return res.status(400).json({ success: false, message: '정원이 초과되었습니다.' });
        }

        // 3. Update booking
        const xpBonus = 500;
        const { error: updateErr } = await supabaseAdmin
            .from('bookings')
            .update({
                checked_in: true,
                checked_in_at: new Date().toISOString(),
                team_id: teamId,
                squad_num: squadNum
            })
            .eq('id', booking.id);

        if (updateErr) throw updateErr;

        // 4. Award XP
        const { data: user } = await supabaseAdmin.from('users').select('xp').eq('id', userId).single();
        await supabaseAdmin.from('users').update({ xp: (user?.xp || 0) + xpBonus }).eq('id', userId);
        await logXP(userId, xpBonus, `QR 체크인 완료 (${booking.timeslots.location}) - ${teamId}팀 ${squadNum}번 배정`);

        const { data: updatedUser } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();

        res.json({
            success: true,
            message: `체크인 완료! ${teamId}팀 ${squadNum}번 요원으로 배정되었습니다.`,
            user: updatedUser,
            assignment: { teamId, squadNum },
            location: booking.timeslots.location
        });
    } catch (error) {
        console.error('Checkin error:', error);
        res.status(500).json({ success: false, message: '체크인 처리 중 오류가 발생했습니다.' });
    }
});

app.get('/api/sessions/live', async (req, res) => {
    // Get stats for the most recent/current slot checking in
    try {
        const { data: slots } = await supabaseAdmin
            .from('timeslots')
            .select('*')
            .order('id', { ascending: false })
            .limit(1);

        if (!slots || slots.length === 0) return res.json({ slot: null, teams: [] });

        const slot = slots[0];
        const { data: bookings } = await supabaseAdmin
            .from('bookings')
            .select('*, users(name)')
            .eq('slot_id', slot.id)
            .eq('checked_in', true);

        res.json({
            slot,
            checkedIn: bookings || []
        });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/user/xp-history', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.json([]);

    const { data: history } = await supabaseAdmin
        .from('xp_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(5);
    res.json(history || []);
});

app.post('/api/coupons/redeem', async (req, res) => {
    const { code, userId } = req.body;
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

    try {
        const { data: coupon } = await supabaseAdmin
            .from('coupons')
            .select('*')
            .eq('code', code)
            .single();

        if (!coupon) {
            return res.status(404).json({ success: false, message: '유효하지 않은 쿠폰 코드입니다.' });
        }

        if (coupon.is_used) {
            return res.status(400).json({ success: false, message: '이미 사용된 쿠폰입니다.' });
        }

        // Mark as used and award XP
        await supabaseAdmin.from('coupons').update({ is_used: true }).eq('id', coupon.id);
        const { data: user } = await supabaseAdmin.from('users').select('xp').eq('id', userId).single();
        await supabaseAdmin.from('users').update({ xp: (user?.xp || 0) + coupon.reward_xp }).eq('id', userId);

        await logXP(userId, coupon.reward_xp, `쿠폰 등록 완료 (${code})`);

        const { data: updatedUser } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
        res.json({ success: true, message: `${coupon.reward_xp} XP가 지급되었습니다!`, user: updatedUser });
    } catch (error) {
        console.error('Redeem error:', error);
        res.status(500).json({ success: false, message: '쿠폰 등록 중 오류가 발생했습니다.' });
    }
});

// --- Admin APIs ---

app.get('/api/admin/users', async (req, res) => {
    const { data: users } = await supabaseAdmin.from('users').select('*');
    res.json(users || []);
});

app.post('/api/admin/users/update', async (req, res) => {
    const { id, level, xp } = req.body;
    await supabaseAdmin.from('users').update({ level, xp }).eq('id', id);
    res.json({ success: true });
});

app.post('/api/admin/users/update-membership', async (req, res) => {
    const { userId, type, expiryDays } = req.body;
    if (!userId || !type) return res.status(400).json({ success: false });

    const expiryDate = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString() : null;

    try {
        const { error } = await supabaseAdmin
            .from('users')
            .update({
                membership_type: type,
                membership_expiry: expiryDate
            })
            .eq('id', userId);

        if (error) throw error;
        res.json({ success: true, message: `Membership updated to ${type}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/users/update-role', async (req, res) => {
    const { userId, role } = req.body;
    if (!userId || !role) return res.status(400).json({ success: false });

    try {
        const { error } = await supabaseAdmin
            .from('users')
            .update({ role: role })
            .eq('id', userId);

        if (error) throw error;
        res.json({ success: true, message: `User role updated to ${role}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/users/award-performance', async (req, res) => {
    const { userId, type } = req.body; // type: 'win' or 'mvp'
    if (!userId || !type) return res.status(400).json({ success: false });

    try {
        const { data: user } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
        if (!user) return res.status(404).json({ success: false });

        let xpBonus = 0;
        let updateData = {};
        let reason = '';

        if (type === 'win') {
            xpBonus = 300;
            updateData = {
                xp: (user.xp || 0) + xpBonus,
                total_wins: (user.total_wins || 0) + 1
            };
            reason = '매치 승리 보상 (WIN)';
        } else if (type === 'mvp') {
            xpBonus = 500;
            updateData = {
                xp: (user.xp || 0) + xpBonus,
                mvp_count: (user.mvp_count || 0) + 1
            };
            reason = '매치 MVP 보상';
        }

        await supabaseAdmin.from('users').update(updateData).eq('id', userId);
        await logXP(userId, xpBonus, reason);
        res.json({ success: true, message: `${reason}로 인해 ${xpBonus} XP가 지급되었습니다.` });
    } catch (error) {
        console.error('Award error:', error);
        res.status(500).json({ success: false });
    }
});

// Group Management
app.get('/api/admin/groups', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('groups').select('*').order('name');
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.get('/api/admin/slots', async (req, res) => {
    const { data: slots } = await supabaseAdmin.from('timeslots').select('*').order('id', { ascending: true });
    res.json(slots || []);
});
app.post('/api/admin/slots/add', async (req, res) => {
    const { date, time_start, time_end, price, capacity, location, price_youth, price_child, label } = req.body;
    await supabaseAdmin.from('timeslots').insert({
        date, time_start, time_end, price, capacity, booked: 0, location, price_youth, price_child, label
    });
    res.json({ success: true });
});

app.post('/api/admin/slots/batch-add', async (req, res) => {
    const { slots } = req.body;
    if (!slots || !Array.isArray(slots)) return res.status(400).json({ success: false });

    try {
        const { error } = await supabaseAdmin.from('timeslots').insert(slots);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Batch slot error:', error);
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/slots/delete', async (req, res) => {
    const { id } = req.body;
    await supabaseAdmin.from('timeslots').delete().eq('id', id);
    res.json({ success: true });
});

app.post('/api/admin/coupons/generate', async (req, res) => {
    const { rewardXp, prefix, count = 1 } = req.body;
    console.log(`[Admin] Generating ${count} coupons with prefix "${prefix}" and reward ${rewardXp} XP`);
    const generatedCodes = [];

    try {
        for (let i = 0; i < count; i++) {
            const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            const code = `${prefix || 'CPN'}_${randomSuffix}`;
            generatedCodes.push({ code, reward_xp: rewardXp });
        }

        const { data, error } = await supabaseAdmin.from('coupons').insert(generatedCodes).select();

        if (error) {
            console.error('Coupon gen error:', error);
            return res.status(500).json({ success: false, message: '쿠폰 생성 실패' });
        }

        res.json({ success: true, codes: data.map(c => c.code) });
    } catch (error) {
        console.error('Batch coupon gen error:', error);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

app.get('/api/admin/stats', async (req, res) => {
    const { count: users } = await supabaseAdmin.from('users').select('*', { count: 'exact', head: true });
    const { count: slots } = await supabaseAdmin.from('timeslots').select('*', { count: 'exact', head: true }).lt('booked', 'capacity');
    const { count: bookings } = await supabaseAdmin.from('bookings').select('*', { count: 'exact', head: true });

    res.json({
        users: users || 0,
        slots: slots || 0,
        bookings: bookings || 0
    });
});

app.get('/api/admin/bookings', async (req, res) => {
    const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select(`
            id,
            created_at,
            users ( name ),
            timeslots ( date, time_start, time_end, location )
        `)
        .order('id', { ascending: false });

    // Flatten the result to match existing frontend expectations
    const flattened = bookings.map(b => ({
        id: b.id,
        user_name: b.users?.name,
        date: b.timeslots?.date,
        time_start: b.timeslots?.time_start,
        time_end: b.timeslots?.time_end,
        location: b.timeslots?.location,
        created_at: b.created_at
    }));

    res.json(flattened);
});

app.post('/api/admin/bookings/delete', async (req, res) => {
    const { id } = req.body;
    try {
        const { data: booking } = await supabaseAdmin.from('bookings').select('*').eq('id', id).single();
        if (booking) {
            // Restore slot capacity
            const { data: slot } = await supabaseAdmin.from('timeslots').select('booked').eq('id', booking.slot_id).single();
            await supabaseAdmin.from('timeslots').update({ booked: (slot?.booked || 1) - 1 }).eq('id', booking.slot_id);
            await supabaseAdmin.from('bookings').delete().eq('id', id);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/bookings/update-status', async (req, res) => {
    const { id, status } = req.body;
    if (!id || !status) return res.status(400).json({ success: false });

    const updateData = { status };
    if (status === 'PAID') updateData.paid_at = new Date().toISOString();
    if (status === 'REFUNDED') updateData.refunded_at = new Date().toISOString();

    try {
        // Get current booking to check status change
        const { data: booking, error: fetchError } = await supabaseAdmin
            .from('bookings')
            .select('*, timeslots(*)')
            .eq('id', id)
            .single();

        if (fetchError || !booking) throw new Error('예약을 찾을 수 없습니다.');

        const { error } = await supabaseAdmin.from('bookings').update(updateData).eq('id', id);
        if (error) throw error;

        // Award XP if status changed to PAID
        if (status === 'PAID' && booking.status !== 'PAID') {
            const xpBonus = 500; // Increased XP for booking confirmation
            await logXP(booking.user_id, xpBonus, `입금 확인: 매치 예약 확정 (ID: ${id})`);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/match-records/save', async (req, res) => {
    const { slotId, winningTeam, redScore, blueScore, mvpUserId, matchReport, photoUrls, redGroupId, blueGroupId } = req.body;

    try {
        // 1. Save match record
        const { data: record, error } = await supabaseAdmin
            .from('match_records')
            .insert([{
                slot_id: slotId,
                winning_team: winningTeam,
                red_score: redScore,
                blue_score: blueScore,
                red_group_id: redGroupId || null,
                blue_group_id: blueGroupId || null,
                mvp_user_id: mvpUserId,
                match_report: matchReport,
                photo_urls: photoUrls || []
            }])
            .select()
            .single();

        if (error) throw error;

        // 2. Update Group Stats (Wins/Losses/Draws)
        if (redGroupId && blueGroupId) {
            if (winningTeam === 'RED') {
                await supabaseAdmin.rpc('increment_group_stat', { group_id: redGroupId, column_name: 'wins' });
                await supabaseAdmin.rpc('increment_group_stat', { group_id: blueGroupId, column_name: 'losses' });
            } else if (winningTeam === 'BLUE') {
                await supabaseAdmin.rpc('increment_group_stat', { group_id: blueGroupId, column_name: 'wins' });
                await supabaseAdmin.rpc('increment_group_stat', { group_id: redGroupId, column_name: 'losses' });
            } else if (winningTeam === 'DRAW') {
                await supabaseAdmin.rpc('increment_group_stat', { group_id: redGroupId, column_name: 'draws' });
                await supabaseAdmin.rpc('increment_group_stat', { group_id: blueGroupId, column_name: 'draws' });
            }
        }

        // 3. Award Points to winning team members
        const { data: participants } = await supabaseAdmin
            .from('bookings')
            .select('user_id, team_id')
            .eq('slot_id', slotId)
            .eq('checked_in', true);

        const WIN_XP = 1000;
        const MVP_XP = 2000;

        for (const p of participants || []) {
            if (p.team_id === winningTeam) {
                await logXP(p.user_id, WIN_XP, `팀 승리 보상 (${winningTeam}팀)`);
                // Update user win count
                const { data: u } = await supabaseAdmin.from('users').select('total_wins').eq('id', p.user_id).single();
                await supabaseAdmin.from('users').update({ total_wins: (u?.total_wins || 0) + 1 }).eq('id', p.user_id);
            }
        }

        // 4. Award MVP Bonus
        if (mvpUserId) {
            await logXP(mvpUserId, MVP_XP, '경기 최고의 대원 (MVP) 선정!');
            const { data: u } = await supabaseAdmin.from('users').select('mvp_count').eq('id', mvpUserId).single();
            await supabaseAdmin.from('users').update({ mvp_count: (u?.mvp_count || 0) + 1 }).eq('id', mvpUserId);
        }

        res.json({ success: true, record });
    } catch (error) {
        console.error('Failed to save match record:', error);
        res.status(500).json({ success: false, message: '기록 저장 중 오류가 발생했습니다.' });
    }
});

app.get('/api/match-records', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('match_records')
            .select('*, timeslots(*), users!match_records_mvp_user_id_fkey(name)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/users/update-role', async (req, res) => {
    const { userId, role } = req.body;
    try {
        const { error } = await supabaseAdmin.from('users').update({ role }).eq('id', userId);
        if (error) throw error;
        res.json({ success: true, message: `권한이 ${role}로 변경되었습니다.` });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/admin/users/update-membership', async (req, res) => {
    const { userId, type } = req.body;
    const newType = type === 'ELITE' ? 'STANDARD' : 'ELITE';
    const expiry = newType === 'ELITE' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
    try {
        const { error } = await supabaseAdmin.from('users').update({
            membership_type: newType,
            membership_expiry: expiry
        }).eq('id', userId);
        if (error) throw error;
        res.json({ success: true, message: `멤버십이 ${newType}으로 변경되었습니다.` });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.get('/api/admin/analytics', async (req, res) => {
    try {
        const { data: slots } = await supabaseAdmin.from('timeslots').select('*');
        const { data: bookings } = await supabaseAdmin.from('bookings').select('*, users(*)');

        if (!slots || !bookings) return res.status(500).json({ success: false });

        // KPI Calculations
        const totalCap = slots.reduce((acc, s) => acc + (s.capacity || 0), 0);
        const totalBooked = slots.reduce((acc, s) => acc + (s.booked || 0), 0);
        const fulfillmentRate = totalCap > 0 ? (totalBooked / totalCap) * 100 : 0;

        // External ratio (assuming users have is_external or logic)
        // For now, let's treat everyone as potentially external or internal based on something simple
        // If no field, we return placeholders or calculated based on data we have
        const externalCount = bookings.filter(b => b.users?.is_external).length;
        const externalRatio = bookings.length > 0 ? (externalCount / bookings.length) * 100 : 0;

        res.json({
            fulfillmentRate: fulfillmentRate.toFixed(1),
            externalRatio: externalRatio.toFixed(1),
            waitlistConversion: "45.2", // Placeholder for now
            rebookingRate: "12.5" // Placeholder for now
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/admin/groups', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('groups').select('*');
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// Public Event APIs
app.get('/api/events', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('events').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/events/:id/details', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: event } = await supabaseAdmin.from('events').select('*').eq('id', id).single();
        const { data: squads } = await supabaseAdmin.from('event_squads').select('*').eq('event_id', id).order('squad_num');
        const { data: matches } = await supabaseAdmin.from('event_matches').select('*').eq('event_id', id).order('match_order');
        const { data: bookings } = await supabaseAdmin.from('bookings').select('*, users(name)').eq('event_id', id);

        // Calculate Standings
        const standings = (squads || []).map(s => ({
            squad_num: s.squad_num,
            name: s.name,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            points: 0,
            goals_for: 0,
            goals_against: 0,
            members: (bookings || []).filter(b => b.squad_num === s.squad_num)
        }));

        (matches || []).forEach(m => {
            const red = standings.find(s => s.squad_num === m.red_squad_num);
            const blue = standings.find(s => s.squad_num === m.blue_squad_num);

            if (red && blue && m.winning_squad_num !== null) {
                red.played++;
                blue.played++;
                red.goals_for += (m.red_score || 0);
                red.goals_against += (m.blue_score || 0);
                blue.goals_for += (m.blue_score || 0);
                blue.goals_against += (m.red_score || 0);

                if (m.winning_squad_num === m.red_squad_num) {
                    red.wins++;
                    red.points += 3;
                    blue.losses++;
                } else if (m.winning_squad_num === m.blue_squad_num) {
                    blue.wins++;
                    blue.points += 3;
                    red.losses++;
                } else if (m.winning_squad_num === 0) {
                    red.draws++;
                    blue.draws++;
                    red.points += 1;
                    blue.points += 1;
                }
            }
        });

        standings.sort((a, b) => b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against));

        res.json({ event, squads, matches, standings, checkedIn: bookings });
    } catch (e) {
        console.error('Public event details error:', e);
        res.status(500).json({ success: false });
    }
});

// Event Management
app.get('/api/admin/events', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('events').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/events/create', async (req, res) => {
    const { name, date, location, squadCount } = req.body;
    try {
        console.log(`[Admin] Creating event: ${name} with ${squadCount} squads`);
        // 1. 대회 생성
        const { data: event, error: eventError } = await supabaseAdmin.from('events').insert({ name, date, location }).select().single();
        if (eventError) {
            console.error('[Admin] Event insert error:', eventError);
            throw eventError;
        }

        const eventId = event.id;

        // 2. 조(Squads) 자동 생성
        const squads = [];
        for (let i = 1; i <= squadCount; i++) {
            squads.push({ event_id: eventId, squad_num: i, name: `${i}조` });
        }
        const { error: squadError } = await supabaseAdmin.from('event_squads').insert(squads);
        if (squadError) {
            console.error('[Admin] Squads insert error:', squadError);
            throw squadError;
        }

        // 3. Round Robin 기반 경기 일정(Matches) 자동 생성
        const matches = [];
        const count = Number(squadCount) || 0;
        const teams = Array.from({ length: count }, (_, i) => i + 1);
        if (squadCount % 2 !== 0) teams.push(null); // 홀수면 Bye(부전승) 추가용

        const numTeams = teams.length;
        const rounds = numTeams - 1;
        const half = numTeams / 2;

        for (let round = 0; round < rounds; round++) {
            for (let i = 0; i < half; i++) {
                const team1 = teams[i];
                const team2 = teams[numTeams - 1 - i];

                if (team1 !== null && team2 !== null) {
                    matches.push({
                        event_id: eventId,
                        red_squad_num: team1,
                        blue_squad_num: team2,
                        red_score: 0,
                        blue_score: 0,
                        winning_squad_num: null,
                        match_order: matches.length + 1
                    });
                }
            }
            // Rotate teams (keep the first team fixed)
            teams.splice(1, 0, teams.pop());
        }

        if (matches.length > 0) {
            const { error: matchError } = await supabaseAdmin.from('event_matches').insert(matches);
            if (matchError) {
                console.error('[Admin] Matches insert error (Check if match_order column exists):', matchError);
                throw new Error(`대진표 저장 실패: ${matchError.message} (DB 스키마 업데이트가 필요할 수 있습니다)`);
            }
        }

        res.json({ success: true, event });
    } catch (e) {
        console.error('Event creation technical error:', e);
        res.status(500).json({ success: false, message: e.message || '행사 생성 중 서버 오류 발생' });
    }
});

app.post('/api/admin/events/squads/create-batch', async (req, res) => {
    const { eventId, count } = req.body;
    const squads = [];
    for (let i = 1; i <= count; i++) {
        squads.push({ event_id: eventId, squad_num: i, name: `${i}조` });
    }
    try {
        const { error } = await supabaseAdmin.from('event_squads').upsert(squads, { onConflict: 'event_id, squad_num' });
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.get('/api/admin/events/:id/details', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: event } = await supabaseAdmin.from('events').select('*').eq('id', id).single();
        const { data: squads } = await supabaseAdmin.from('event_squads').select('*').eq('event_id', id).order('squad_num');
        const { data: matches } = await supabaseAdmin.from('event_matches').select('*').eq('event_id', id).order('match_order');
        const { data: bookings } = await supabaseAdmin.from('bookings').select('*, users(name)').eq('event_id', id);

        // Calculate Standings
        const standings = (squads || []).map(s => ({
            squad_num: s.squad_num,
            name: s.name,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            points: 0,
            goals_for: 0,
            goals_against: 0,
            members: (bookings || []).filter(b => b.squad_num === s.squad_num)
        }));

        (matches || []).forEach(m => {
            const red = standings.find(s => s.squad_num === m.red_squad_num);
            const blue = standings.find(s => s.squad_num === m.blue_squad_num);

            if (red && blue && m.winning_squad_num !== null) {
                red.played++;
                blue.played++;
                red.goals_for += (m.red_score || 0);
                red.goals_against += (m.blue_score || 0);
                blue.goals_for += (m.blue_score || 0);
                blue.goals_against += (m.red_score || 0);

                if (m.winning_squad_num === m.red_squad_num) {
                    red.wins++;
                    red.points += 3;
                    blue.losses++;
                } else if (m.winning_squad_num === m.blue_squad_num) {
                    blue.wins++;
                    blue.points += 3;
                    red.losses++;
                } else if (m.winning_squad_num === 0) {
                    red.draws++;
                    blue.draws++;
                    red.points += 1;
                    blue.points += 1;
                }
            }
        });

        // Sort standings
        standings.sort((a, b) => b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against));

        res.json({ event, squads, matches, standings, checkedIn: bookings });
    } catch (e) {
        console.error('Event details error:', e);
        res.status(500).json({ success: false });
    }
});

// Duplicate matches/save entry removed. Verified and integrated below at line 1060.

app.post('/api/admin/events/delete', async (req, res) => {
    const { id } = req.body;
    try {
        // Cascading delete would be better, but let's handle it manually if FKs not SET
        await supabaseAdmin.from('event_matches').delete().eq('event_id', id);
        await supabaseAdmin.from('event_squads').delete().eq('event_id', id);
        await supabaseAdmin.from('bookings').update({ event_id: null, squad_num: null }).eq('event_id', id);
        const { error } = await supabaseAdmin.from('events').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/admin/events/assign-user', async (req, res) => {
    const { eventId, userId, squadNum } = req.body;
    try {
        // Upsert or Update booking for this event
        // First check if booking exists for this user and event
        const { data: booking } = await supabaseAdmin.from('bookings').select('id').eq('event_id', eventId).eq('user_id', userId).single();

        if (booking) {
            await supabaseAdmin.from('bookings').update({ squad_num: squadNum }).eq('id', booking.id);
        } else {
            // Find a slot for this event (or assume event has a slot_id)
            // For now, let's just update ANY booking for this user to have this event_id if they booked something on that day
            // Or create a special booking.
            // Simplified: update the most recent booking for this user that doesn't have an event_id
            const { data: latestBooking } = await supabaseAdmin.from('bookings').select('id').eq('user_id', userId).is('event_id', null).order('created_at', { ascending: false }).limit(1).single();

            if (latestBooking) {
                await supabaseAdmin.from('bookings').update({ event_id: eventId, squad_num: squadNum }).eq('id', latestBooking.id);
            } else {
                return res.status(400).json({ success: false, message: '배정할 수 있는 예약 내역이 없습니다.' });
            }
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/admin/events/matches/save', async (req, res) => {
    const { eventId, redSquadNum, blueSquadNum, redScore, blueScore, winningSquadNum } = req.body;
    try {
        // 1. Update the match record
        const { error: matchError } = await supabaseAdmin
            .from('event_matches')
            .update({
                red_score: redScore,
                blue_score: blueScore,
                winning_squad_num: winningSquadNum
            })
            .eq('event_id', eventId)
            .eq('red_squad_num', redSquadNum)
            .eq('blue_squad_num', blueSquadNum);

        if (matchError) throw matchError;

        // 2. Update Squad Statistics (Red)
        const redDraw = redScore === blueScore ? 1 : 0;
        const redWin = winningSquadNum === redSquadNum ? 1 : 0;
        const redLoss = (winningSquadNum !== null && winningSquadNum !== redSquadNum) ? 1 : 0;
        const redPoints = redWin * 3 + redDraw * 1;

        const { data: redSquad } = await supabaseAdmin.from('event_squads').select('*').eq('event_id', eventId).eq('squad_num', redSquadNum).single();
        if (redSquad) {
            await supabaseAdmin.from('event_squads').update({
                wins: (redSquad.wins || 0) + redWin,
                losses: (redSquad.losses || 0) + redLoss,
                draws: (redSquad.draws || 0) + redDraw,
                points: (redSquad.points || 0) + redPoints
            }).eq('id', redSquad.id);
        }

        // 3. Update Squad Statistics (Blue)
        const blueDraw = redScore === blueScore ? 1 : 0;
        const blueWin = winningSquadNum === blueSquadNum ? 1 : 0;
        const blueLoss = (winningSquadNum !== null && winningSquadNum !== blueSquadNum) ? 1 : 0;
        const bluePoints = blueWin * 3 + blueDraw * 1;

        const { data: blueSquad } = await supabaseAdmin.from('event_squads').select('*').eq('event_id', eventId).eq('squad_num', blueSquadNum).single();
        if (blueSquad) {
            await supabaseAdmin.from('event_squads').update({
                wins: (blueSquad.wins || 0) + blueWin,
                losses: (blueSquad.losses || 0) + blueLoss,
                draws: (blueSquad.draws || 0) + blueDraw,
                points: (blueSquad.points || 0) + bluePoints
            }).eq('id', blueSquad.id);
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.listen(port, () => {
    console.log(`K서바이벌스포츠클럽 Backend running with Supabase at port ${port}`);
});
