
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function check() {
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });
    const slots = await db.all('SELECT * FROM timeslots');
    console.log('Current slots in DB:', slots);
    await db.close();
}
check();
