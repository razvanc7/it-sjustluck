import pool from "../db";

const initDb = async () => {
    try {
        console.log("Starting database initialization...");

        // Drop tables if they exist (Reverse order of dependencies)
        await pool.query(`DROP TABLE IF EXISTS user_achievements CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS achievements CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS notifications CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS chat_messages CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS neighborhood_ownership CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS friends CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS neighborhood_visits CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS location_points CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS tracking_sessions CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS users CASCADE`);

        console.log("Dropped existing tables.");

        // Create Users Table
        await pool.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                color VARCHAR(20) DEFAULT '#0000FF',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create Friends Table 
        await pool.query(`
            CREATE TABLE friends (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                friend_id INTEGER REFERENCES users(id),
                status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, friend_id)
            );
        `);

        // Create Tracking Sessions Table
        await pool.query(`
            CREATE TABLE tracking_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP,
                total_distance FLOAT DEFAULT 0,
                total_steps INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create Location Points Table
        await pool.query(`
            CREATE TABLE location_points (
                id SERIAL PRIMARY KEY,
                session_id INTEGER REFERENCES tracking_sessions(id),
                latitude FLOAT NOT NULL,
                longitude FLOAT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create Neighborhood Visits Table
        await pool.query(`
            CREATE TABLE neighborhood_visits (
                id SERIAL PRIMARY KEY,
                session_id INTEGER REFERENCES tracking_sessions(id),
                neighborhood_id VARCHAR(50) NOT NULL,
                steps INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(session_id, neighborhood_id)
            );
        `);

        // Create Neighborhood Ownership Table 
        await pool.query(`
            CREATE TABLE neighborhood_ownership (
                id SERIAL PRIMARY KEY,
                neighborhood_id VARCHAR(50) UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id),
                max_steps INTEGER DEFAULT 0,
                captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create Chat Messages Table
        await pool.query(`
            CREATE TABLE chat_messages (
                id SERIAL PRIMARY KEY,
                neighborhood_id VARCHAR(50) NOT NULL,
                user_id INTEGER REFERENCES users(id),
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create Notifications Table
        await pool.query(`
            CREATE TABLE notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id), -- recipient
                actor_id INTEGER REFERENCES users(id), -- who triggered the notification
                neighborhood_id VARCHAR(50),
                message TEXT,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create Achievements Table
        await pool.query(`
            CREATE TABLE achievements (
                id SERIAL PRIMARY KEY,
                code VARCHAR(100) UNIQUE NOT NULL,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                icon VARCHAR(200),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create User Achievements Table
        await pool.query(`
            CREATE TABLE user_achievements (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                achievement_id INTEGER REFERENCES achievements(id),
                awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                meta JSONB,
                UNIQUE(user_id, achievement_id)
            );
        `);

        // Seed some default achievements
        await pool.query(`
            INSERT INTO achievements (code, title, description, icon) VALUES
            ('first_capture', 'First Capture', 'Capture your first turf.', '🏆'),
            ('capture_big', 'Big Capture', 'Capture a turf with over 5,000 steps.', '💪'),
            ('session_marathon', 'Marathon Session', 'Accumulate 10,000 steps in a single session.', '🏃‍♂️')
            ON CONFLICT (code) DO NOTHING;
        `);

        console.log("Database initialized successfully with fresh tables (including friends and chat_messages)!");
    } catch (error) {
        console.error("Error initializing database:", error);
    } finally {
        await pool.end();
    }
};

initDb();