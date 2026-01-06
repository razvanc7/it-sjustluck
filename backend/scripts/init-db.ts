import pool from "../db";

const initDb = async () => {
    try {
        console.log("Starting database initialization...");

        // Drop tables if they exist (Reverse order of dependencies)
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

        console.log("Database initialized successfully with fresh tables (including friends)!");
    } catch (error) {
        console.error("Error initializing database:", error);
    } finally {
        await pool.end();
    }
};

initDb();