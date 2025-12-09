const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const multer = require('multer');
const crypto = require('crypto');
const db = require('./database');
const { processAudioEntry } = require('./services/magicMic');
const progressEmitter = require('./services/progressEmitter');
const { breakdownTask, getShardsByParentId, checkAndCompleteParent } = require('./services/magicBreakdown');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for audio file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

app.use(cors());
app.use(express.json());

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
    const publicPath = path.join(__dirname, 'public');
    app.use(express.static(publicPath));
}

// =============================================================================
// HEALTHCHECK (No auth required)
// =============================================================================

/**
 * Health check endpoint for Railway
 * GET /health
 */
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'flux-api'
    });
});

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Login endpoint
 * POST /api/auth/login
 */
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    db.get('SELECT * FROM user_profiles WHERE id = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Parse JSON fields
        try {
            user.high_gravity_keywords = JSON.parse(user.high_gravity_keywords || '[]');
            user.low_gravity_keywords = JSON.parse(user.low_gravity_keywords || '[]');
            user.deepgram_keywords = JSON.parse(user.deepgram_keywords || '[]');
        } catch (e) {
            // Leave as strings if parse fails
        }

        // Don't send password back
        delete user.password;

        res.json({
            success: true,
            user
        });
    });
});

/**
 * Validate session / get current user
 * GET /api/auth/me
 */
app.get('/api/auth/me', (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    db.get('SELECT * FROM user_profiles WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Don't send password
        delete user.password;

        res.json({ user });
    });
});

// Routes

// Capture Task (Vault)
app.post('/api/tasks', (req, res) => {
    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    const stmt = db.prepare('INSERT INTO tasks (content, status, created_at) VALUES (?, ?, ?)');
    const now = new Date().toISOString();
    stmt.run(content, 'inbox', now, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, content, status: 'inbox', created_at: now });
    });
    stmt.finalize();
});

// Get Bundle (Airlock)
// Gravity logic: user's energy level determines which task difficulties they can handle
// - User "high gravity" (survival mode) → give LOW gravity tasks (easy)
// - User "low gravity" (flow state) → can handle any tasks
// - User "standard" → standard and low gravity tasks
app.get('/api/tasks/bundle', (req, res) => {
    const userGravity = req.query.gravity || 'standard'; // User's current energy state

    let gravityFilter;
    if (userGravity === 'high') {
        // User is overwhelmed → only give them easy (Low gravity) tasks
        gravityFilter = `AND (gravity_tag = 'Low' OR gravity_tag IS NULL)`;
    } else if (userGravity === 'low') {
        // User has energy → can handle anything, prioritize harder tasks
        gravityFilter = `ORDER BY CASE 
            WHEN gravity_tag = 'High' THEN 1 
            WHEN gravity_tag = 'Standard' THEN 2 
            ELSE 3 END,`;
    } else {
        // Standard → mix of standard and low gravity tasks
        gravityFilter = `AND (gravity_tag != 'High' OR gravity_tag IS NULL)`;
    }

    // Build query based on gravity
    let query;
    if (userGravity === 'low') {
        // For flow state: prioritize by task gravity (harder first)
        query = `SELECT * FROM tasks WHERE status IN ('inbox', 'inbox_review') 
                 ORDER BY CASE 
                    WHEN gravity_tag = 'High' THEN 1 
                    WHEN gravity_tag = 'Standard' THEN 2 
                    ELSE 3 END, RANDOM() 
                 LIMIT 3`;
    } else {
        // For standard/high: filter by allowed gravity levels
        query = `SELECT * FROM tasks WHERE status IN ('inbox', 'inbox_review') ${gravityFilter} ORDER BY RANDOM() LIMIT 3`;
    }

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            tasks: rows,
            gravity: userGravity,
            message: userGravity === 'high'
                ? 'Showing gentle tasks only'
                : userGravity === 'low'
                    ? 'Ready for anything'
                    : 'Balanced selection'
        });
    });
});

// Get all inbox tasks (Vault view)
app.get('/api/tasks/inbox', (req, res) => {
    db.all(
        `SELECT * FROM tasks WHERE status IN ('inbox', 'inbox_review') 
         ORDER BY created_at DESC LIMIT 50`,
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ tasks: rows });
        }
    );
});

// Get single task by ID
app.get('/api/tasks/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        // Parse tags JSON
        try {
            task.tags = JSON.parse(task.tags || '[]');
        } catch (e) {
            task.tags = [];
        }
        res.json({ task });
    });
});

// Update Task (Status, Gravity, Project, Due Date, Tags)
app.patch('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { status, gravity_tag, project_id, due_date, tags } = req.body;

    const updates = [];
    const params = [];

    if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
    }
    if (gravity_tag !== undefined) {
        updates.push('gravity_tag = ?');
        params.push(gravity_tag);
    }
    if (project_id !== undefined) {
        updates.push('project_id = ?');
        params.push(project_id);
    }
    if (due_date !== undefined) {
        updates.push('due_date = ?');
        params.push(due_date);
    }
    if (tags !== undefined) {
        updates.push('tags = ?');
        params.push(JSON.stringify(tags));
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    try {
        // First, get the task to check if it's a shard
        const task = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Update the task
        await new Promise((resolve, reject) => {
            db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params, function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });

        // If this is a shard and status changed to 'complete', check if parent should be completed
        let parentCompleted = false;
        if (status === 'complete' && task.parent_task_id) {
            parentCompleted = await checkAndCompleteParent(task.parent_task_id, db);
        }

        res.json({
            message: 'Task updated',
            parentCompleted,
            parentTaskId: parentCompleted ? task.parent_task_id : null
        });

    } catch (error) {
        console.error('[Task Update] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Log task corrections (for AI learning)
app.post('/api/tasks/:id/corrections', (req, res) => {
    const { id } = req.params;
    const { corrections } = req.body; // Array of { field_name, original_value, corrected_value }

    if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
        return res.status(400).json({ error: 'Corrections array is required' });
    }

    // First get the original transcript for context
    db.get('SELECT content FROM tasks WHERE id = ?', [id], (err, task) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO task_corrections (task_id, field_name, original_value, corrected_value, original_transcript, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        let insertedCount = 0;
        corrections.forEach(c => {
            stmt.run(id, c.field_name, c.original_value, c.corrected_value, task.content, now, (err) => {
                if (!err) insertedCount++;
            });
        });

        stmt.finalize((err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'Corrections logged', count: corrections.length });
        });
    });
});

// Get recent corrections for AI context
app.get('/api/tasks/corrections/recent', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;

    db.all(`
        SELECT tc.*, t.title as task_title 
        FROM task_corrections tc
        LEFT JOIN tasks t ON tc.task_id = t.id
        ORDER BY tc.created_at DESC 
        LIMIT ?
    `, [limit], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ corrections: rows });
    });
});

// =============================================================================
// MAGIC BREAKDOWN - AI-Powered Task Decomposition
// =============================================================================

/**
 * Break down a complex task into actionable shards
 * POST /api/tasks/:id/breakdown
 */
app.post('/api/tasks/:id/breakdown', async (req, res) => {
    const { id } = req.params;
    const userId = req.body.userId || 'ishamm';

    try {
        // Fetch parent task
        const parentTask = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!parentTask) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if already broken down
        const existingShards = await getShardsByParentId(id, db);
        if (existingShards.length > 0) {
            return res.json({
                success: true,
                shards: existingShards,
                message: 'Task already decomposed',
                parentTask: { id: parentTask.id, title: parentTask.title }
            });
        }

        // Perform AI breakdown
        const result = await breakdownTask(parentTask, userId, db);

        res.json(result);

    } catch (error) {
        console.error('[Magic Breakdown] Error:', error);

        if (error.message.includes('OPENROUTER_API_KEY')) {
            return res.status(503).json({
                success: false,
                error: 'LLM service not configured'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to break down task',
            details: error.message
        });
    }
});

/**
 * Get shards for a parent task
 * GET /api/tasks/:id/shards
 */
app.get('/api/tasks/:id/shards', async (req, res) => {
    const { id } = req.params;

    try {
        const shards = await getShardsByParentId(id, db);
        res.json({ shards });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Jettison (Reset all active to inbox)
app.post('/api/tasks/jettison', (req, res) => {
    db.run('UPDATE tasks SET status = "inbox" WHERE status != "complete"', [], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'All tasks jettisoned to vault', changes: this.changes });
    });
});

// =============================================================================
// MAGIC MIC - Audio-to-Action Pipeline
// =============================================================================

/**
 * SSE endpoint for streaming progress updates
 * GET /api/audio/progress/:requestId
 */
app.get('/api/audio/progress/:requestId', (req, res) => {
    const { requestId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onProgress = (event) => {
        if (event.requestId === requestId) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);

            // Close connection when complete or error
            if (event.stage === 'complete' || event.stage === 'error') {
                res.end();
            }
        }
    };

    progressEmitter.on('progress', onProgress);

    // Cleanup on client disconnect
    req.on('close', () => {
        progressEmitter.off('progress', onProgress);
    });

    // Send initial connected event
    res.write(`data: ${JSON.stringify({ stage: 'connected', requestId })}\n\n`);
});

/**
 * Process audio with progress streaming
 * POST /api/audio/process
 * Body: multipart/form-data with 'audio' file and 'user_id' field
 * Response includes requestId for SSE progress tracking
 */
app.post('/api/audio/process', upload.single('audio'), async (req, res) => {
    const requestId = crypto.randomUUID();

    try {
        const audioFile = req.file;
        const userId = req.body?.user_id || 'ishamm'; // Default to ishamm user

        if (!audioFile) {
            return res.status(400).json({
                success: false,
                error: 'No audio file provided'
            });
        }

        console.log(`[Magic Mic] Processing audio: ${audioFile.originalname} (${audioFile.size} bytes) [${requestId}]`);

        // Create progress tracker
        const progress = progressEmitter.createRequest(requestId);

        // Process with progress tracking
        const result = await processAudioEntry(audioFile.buffer, userId, db, progress);

        if (!result.success) {
            return res.status(422).json({ ...result, requestId });
        }

        res.status(201).json({ ...result, requestId });

    } catch (error) {
        console.error('[Magic Mic] Error:', error);

        if (error.message.includes('DEEPGRAM_API_KEY')) {
            return res.status(503).json({
                success: false,
                error: 'Transcription service not configured',
                requestId
            });
        }
        if (error.message.includes('OPENROUTER_API_KEY')) {
            return res.status(503).json({
                success: false,
                error: 'LLM service not configured',
                requestId
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to process audio entry',
            details: error.message,
            requestId
        });
    }
});

// =============================================================================
// USER PROFILE MANAGEMENT
// =============================================================================

/**
 * Get user profile
 * GET /api/profile/:userId
 */
app.get('/api/profile/:userId', (req, res) => {
    const { userId } = req.params;

    db.get('SELECT * FROM user_profiles WHERE id = ?', [userId], (err, profile) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        // Parse JSON fields
        try {
            profile.high_gravity_keywords = JSON.parse(profile.high_gravity_keywords || '[]');
            profile.low_gravity_keywords = JSON.parse(profile.low_gravity_keywords || '[]');
            profile.deepgram_keywords = JSON.parse(profile.deepgram_keywords || '[]');
        } catch (e) {
            // Leave as strings if parse fails
        }

        // Get associated projects
        db.all('SELECT * FROM projects WHERE user_id = ?', [userId], (err, projects) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Get associated people
            db.all('SELECT * FROM known_people WHERE user_id = ?', [userId], (err, people) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                res.json({
                    ...profile,
                    projects: projects || [],
                    known_people: people || []
                });
            });
        });
    });
});

/**
 * Update user profile
 * PUT /api/profile/:userId
 */
app.put('/api/profile/:userId', (req, res) => {
    const { userId } = req.params;
    const { high_gravity_keywords, low_gravity_keywords, deepgram_keywords, timezone } = req.body;

    const updates = [];
    const params = [];

    if (high_gravity_keywords !== undefined) {
        updates.push('high_gravity_keywords = ?');
        params.push(JSON.stringify(high_gravity_keywords));
    }
    if (low_gravity_keywords !== undefined) {
        updates.push('low_gravity_keywords = ?');
        params.push(JSON.stringify(low_gravity_keywords));
    }
    if (deepgram_keywords !== undefined) {
        updates.push('deepgram_keywords = ?');
        params.push(JSON.stringify(deepgram_keywords));
    }
    if (timezone !== undefined) {
        updates.push('timezone = ?');
        params.push(timezone);
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(userId);

    db.run(
        `UPDATE user_profiles SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'User profile not found' });
            }
            res.json({ message: 'Profile updated', changes: this.changes });
        }
    );
});

/**
 * Create user profile
 * POST /api/profile
 */
app.post('/api/profile', (req, res) => {
    const { id, high_gravity_keywords, low_gravity_keywords, deepgram_keywords, timezone } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'User id is required' });
    }

    const now = new Date().toISOString();

    db.run(
        `INSERT INTO user_profiles (id, high_gravity_keywords, low_gravity_keywords, deepgram_keywords, timezone, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            JSON.stringify(high_gravity_keywords || []),
            JSON.stringify(low_gravity_keywords || []),
            JSON.stringify(deepgram_keywords || []),
            timezone || 'UTC',
            now,
            now
        ],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'User already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'Profile created', id });
        }
    );
});

/**
 * Add project to user
 * POST /api/profile/:userId/projects
 */
app.post('/api/profile/:userId/projects', (req, res) => {
    const { userId } = req.params;
    const { name, color, description } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    db.run(
        'INSERT INTO projects (name, color, description, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [name, color || '#6B7280', description || '', userId, new Date().toISOString()],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID, name, color, description, user_id: userId });
        }
    );
});

/**
 * Delete project
 * DELETE /api/profile/:userId/projects/:projectId
 */
app.delete('/api/profile/:userId/projects/:projectId', (req, res) => {
    const { userId, projectId } = req.params;

    db.run('DELETE FROM projects WHERE id = ? AND user_id = ?', [projectId, userId], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({ message: 'Project deleted' });
    });
});

/**
 * Add known person
 * POST /api/profile/:userId/people
 */
app.post('/api/profile/:userId/people', (req, res) => {
    const { userId } = req.params;
    const { name, context } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Person name is required' });
    }

    db.run(
        'INSERT INTO known_people (name, context, user_id, created_at) VALUES (?, ?, ?, ?)',
        [name, context || '', userId, new Date().toISOString()],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID, name, context, user_id: userId });
        }
    );
});

/**
 * Delete known person
 * DELETE /api/profile/:userId/people/:personId
 */
app.delete('/api/profile/:userId/people/:personId', (req, res) => {
    const { userId, personId } = req.params;

    db.run('DELETE FROM known_people WHERE id = ? AND user_id = ?', [personId, userId], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Person not found' });
        }
        res.json({ message: 'Person deleted' });
    });
});

// SPA catch-all route - serve index.html for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database path: ${require('./database').filename || 'in-memory'}`);
});
