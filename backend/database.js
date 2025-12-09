const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Use DATABASE_PATH env var for production (Railway volume), fallback to local file
const dbPath = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.resolve(__dirname, 'tasks.db');

// Load default user config
let defaultUser = null;
try {
    const configPath = path.resolve(__dirname, 'config/defaultUser.json');
    if (fs.existsSync(configPath)) {
        defaultUser = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        console.log(`[Database] Loaded default user config: ${defaultUser.id}`);
    }
} catch (err) {
    console.warn('[Database] Could not load default user config:', err.message);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ' + dbPath + ': ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Use serialize to ensure operations run in order
        db.serialize(() => {
            // Tasks table
            db.run(`CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                title TEXT,
                description TEXT,
                status TEXT DEFAULT 'inbox',
                gravity_tag TEXT,
                project_id TEXT,
                due_date TEXT,
                tags TEXT,
                confidence_score REAL,
                is_ambiguous INTEGER DEFAULT 0,
                parent_task_id INTEGER,
                shard_order INTEGER,
                created_at TEXT,
                FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
            )`);

            // User profiles table
            db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
                id TEXT PRIMARY KEY,
                password TEXT,
                display_name TEXT,
                high_gravity_keywords TEXT,
                low_gravity_keywords TEXT,
                deepgram_keywords TEXT,
                timezone TEXT DEFAULT 'UTC',
                created_at TEXT,
                updated_at TEXT
            )`);

            // Projects table
            db.run(`CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT,
                description TEXT,
                user_id TEXT,
                created_at TEXT
            )`);

            // Known people table
            db.run(`CREATE TABLE IF NOT EXISTS known_people (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                context TEXT,
                user_id TEXT,
                created_at TEXT
            )`);

            // Task corrections table (for AI learning)
            db.run(`CREATE TABLE IF NOT EXISTS task_corrections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                field_name TEXT NOT NULL,
                original_value TEXT,
                corrected_value TEXT,
                original_transcript TEXT,
                created_at TEXT,
                FOREIGN KEY (task_id) REFERENCES tasks(id)
            )`);

            // Seed default user after tables are created
            if (defaultUser) {
                const now = new Date().toISOString();

                // Insert user profile
                db.run(`INSERT OR REPLACE INTO user_profiles 
                    (id, password, display_name, high_gravity_keywords, low_gravity_keywords, deepgram_keywords, timezone, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    defaultUser.id,
                    defaultUser.password || '',
                    defaultUser.display_name || defaultUser.id,
                    JSON.stringify(defaultUser.high_gravity_keywords || []),
                    JSON.stringify(defaultUser.low_gravity_keywords || []),
                    JSON.stringify(defaultUser.deepgram_keywords || []),
                    defaultUser.timezone || 'UTC',
                    now,
                    now
                ], (err) => {
                    if (err) console.error('Error seeding user:', err.message);
                    else console.log(`[Database] Seeded user: ${defaultUser.id}`);
                });

                // Seed projects
                if (defaultUser.projects?.length) {
                    defaultUser.projects.forEach(project => {
                        db.run(`INSERT OR IGNORE INTO projects (name, color, description, user_id, created_at) 
                                SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS 
                                (SELECT 1 FROM projects WHERE name = ? AND user_id = ?)`, [
                            project.name,
                            project.color,
                            project.description || '',
                            defaultUser.id,
                            now,
                            project.name,
                            defaultUser.id
                        ]);
                    });
                    console.log(`[Database] Seeded ${defaultUser.projects.length} projects`);
                }

                // Seed known people
                if (defaultUser.known_people?.length) {
                    defaultUser.known_people.forEach(person => {
                        db.run(`INSERT OR IGNORE INTO known_people (name, context, user_id, created_at) 
                                SELECT ?, ?, ?, ? WHERE NOT EXISTS 
                                (SELECT 1 FROM known_people WHERE name = ? AND user_id = ?)`, [
                            person.name,
                            person.context,
                            defaultUser.id,
                            now,
                            person.name,
                            defaultUser.id
                        ]);
                    });
                    console.log(`[Database] Seeded ${defaultUser.known_people.length} known people`);
                }

                // Seed a dummy task for testing Magic Breakdown
                db.run(`INSERT OR IGNORE INTO tasks (content, title, description, status, gravity_tag, created_at) 
                        SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS 
                        (SELECT 1 FROM tasks WHERE title = ?)`, [
                    'Clean the kitchen',
                    'Clean the kitchen',
                    'The kitchen needs a good clean - dishes, counters, floor',
                    'inbox',
                    'High',
                    now,
                    'Clean the kitchen'
                ], (err) => {
                    if (!err) console.log('[Database] Seeded dummy task for testing');
                });
            }
        });
    }
});

module.exports = db;
