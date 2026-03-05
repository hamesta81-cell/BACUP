import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

export async function initDb() {
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kakao_id INTEGER UNIQUE,
            name TEXT NOT NULL,
            level TEXT DEFAULT 'Scout',
            xp INTEGER DEFAULT 0,
            referrals INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS timeslots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            time_start TEXT,
            time_end TEXT,
            price INTEGER,
            capacity INTEGER,
            booked INTEGER,
            location TEXT,
            price_youth INTEGER,
            price_child INTEGER
        );

        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            slot_id INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(slot_id) REFERENCES timeslots(id)
        );

        CREATE TABLE IF NOT EXISTS missions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            xp_reward INTEGER,
            status TEXT
        );

        CREATE TABLE IF NOT EXISTS rankings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            name TEXT,
            score INTEGER,
            rank_info TEXT
        );

        CREATE TABLE IF NOT EXISTS xp_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            reason TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
    `);

    // Mock Data
    await db.run(`
        INSERT OR IGNORE INTO users (id, name, level, xp, referrals) VALUES (1, '플레이어_원', '정찰병', 650, 2);
    `);

    await db.run(`
        INSERT OR IGNORE INTO rankings (category, name, score, rank_info) VALUES 
        ('individual', '김마스터', 12, '1위'),
        ('individual', '이저격수', 8, '2위'),
        ('individual', '박고스트', 7, '3위'),
        ('individual', '최타격왕', 5, '4위');
    `);

    await db.run(`
        INSERT OR IGNORE INTO rankings (category, name, score, rank_info) VALUES 
        ('team', '델타 포스', 4500, '최강팀'),
        ('team', '섀도우 스쿼드', 4200, '준우승'),
        ('team', '네온 나이츠', 3800, '활동중'),
        ('team', '이지스', 3500, '활동중')
    `);

    await db.run(`
        INSERT OR IGNORE INTO rankings (category, name, score, rank_info) VALUES 
        ('family', '김씨네 가족', 1200, '5인 가족'),
        ('family', '슈퍼 이패밀리', 950, '3인 가족'),
        ('family', '최씨 클랜', 800, '4인 가족')
    `);

    await db.run(`
        INSERT OR IGNORE INTO rankings (category, name, score, rank_info) VALUES 
        ('taekwondo', '블랙벨트 아카데미', 8500, '서울본점'),
        ('taekwondo', '승리 태권도', 7200, '부산지점'),
        ('taekwondo', '스피릿 TKD', 6800, '인천지점'),
        ('taekwondo', '이글 아이', 6000, '평택지점')
    `);

    await db.run(`
        INSERT OR IGNORE INTO timeslots (id, date, time_start, time_end, price, capacity, booked, location, price_youth, price_child)
        VALUES 
        (1, '3월 1일 (일)', '10:00', '12:00', 25000, 20, 5, '김포 메인 게이트 B', 20000, 15000),
        (2, '3월 1일 (일)', '14:00', '16:00', 25000, 20, 18, '서울 고스트 존 A', 20000, 15000),
        (3, '3월 1일 (일)', '18:00', '20:30', 20000, 32, 2, '하남 필드 C', 15000, 10000)
    `);

    await db.run(`
        INSERT OR IGNORE INTO missions (id, title, xp_reward, status) 
        VALUES 
        (1, '1회 매치 참석', 100, 'COMPLETED'),
        (2, '친구 1명 초대', 200, 'WAITING'),
        (3, '스쿼드 팀 플레이', 150, 'WAITING')
    `);

    // Coupons table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            reward_xp INTEGER,
            is_used INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Mock Coupons
    await db.run('INSERT OR IGNORE INTO coupons (code, reward_xp) VALUES (?, ?)', ['WELCOME2026', 1000]);
    await db.run('INSERT OR IGNORE INTO coupons (code, reward_xp) VALUES (?, ?)', ['LASERTAG_PRO', 500]);
    await db.run('INSERT OR IGNORE INTO coupons (code, reward_xp) VALUES (?, ?)', ['EVENT_BOOST', 2000]);

    return db;
}
