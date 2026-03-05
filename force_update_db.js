
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function update() {
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    await db.run('DELETE FROM timeslots');
    await db.run(`
        INSERT INTO timeslots (id, date, time_start, time_end, price, capacity, booked, location, price_youth, price_child)
        VALUES 
        (1, '3월 1일 (일)', '10:00', '12:00', 25000, 20, 5, '김포 메인 게이트 B', 20000, 15000),
        (2, '3월 1일 (일)', '14:00', '16:00', 25000, 20, 18, '서울 고스트 존 A', 20000, 15000),
        (3, '3월 1일 (일)', '18:00', '20:30', 20000, 32, 2, '하남 필드 C', 15000, 10000);
    `);

    const slots = await db.all('SELECT * FROM timeslots');
    console.log('Updated slots in DB:', slots);
    await db.close();
}
update();
