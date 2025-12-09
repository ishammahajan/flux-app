/**
 * Magic Breakdown Service
 * AI-Powered Task Decomposition for FLUX Task Manager
 * 
 * Transforms overwhelming tasks into 3-5 actionable "shard" sub-tasks
 * using LLM processing with user context awareness.
 */

const fs = require('fs');
const path = require('path');
const { getUserContext, getRecentCorrections } = require('./magicMic');

// Load the breakdown-specific system prompt
const BREAKDOWN_PROMPT = fs.readFileSync(
    path.join(__dirname, '../prompts/magic-breakdown.txt'),
    'utf-8'
);

/**
 * Generate task breakdown using LLM via OpenRouter
 * @param {object} parentTask - The task to decompose
 * @param {object} userContext - User context object (projects, people, keywords)
 * @param {Array} recentCorrections - Recent user corrections for learning
 * @returns {Promise<object>} - Breakdown result with shards array
 */
async function generateBreakdown(parentTask, userContext, recentCorrections = []) {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not configured');
    }

    // Build corrections context
    let correctionsContext = 'No corrections available yet.';
    if (recentCorrections.length > 0) {
        correctionsContext = recentCorrections
            .map(c => `- Changed ${c.field_name} from "${c.original_value}" to "${c.corrected_value}"`)
            .join('\n');
    }

    // Substitute corrections into prompt
    const systemPrompt = BREAKDOWN_PROMPT.replace('{corrections_context}', correctionsContext);

    const userMessage = `## Parent Task to Decompose
Title: "${parentTask.title || parentTask.content}"
Description: "${parentTask.description || 'No description provided'}"
Current Gravity: ${parentTask.gravity_tag || 'Unknown'}
Project: ${parentTask.project_id || 'None'}

## User Context
${JSON.stringify(userContext, null, 2)}

Break this task into 3-5 actionable shards. Respond with ONLY valid JSON, no markdown code blocks.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://flux-app.local',
            'X-Title': 'FLUX Magic Breakdown',
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.4, // Slightly higher for creative decomposition
            max_tokens: 1500,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter LLM call failed: ${error}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('LLM returned empty response');
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }

    try {
        return JSON.parse(jsonStr);
    } catch (parseError) {
        throw new Error(`Failed to parse LLM breakdown response as JSON: ${content}`);
    }
}

/**
 * Create shard tasks in database linked to parent
 * @param {number} parentTaskId - Parent task ID
 * @param {Array} shards - Array of shard objects from LLM
 * @param {object} parentTask - Original parent task for inheriting fields
 * @param {object} db - Database instance
 * @returns {Promise<Array>} - Created shard task records
 */
async function createShardTasks(parentTaskId, shards, parentTask, db) {
    const now = new Date().toISOString();
    const createdShards = [];

    for (let i = 0; i < shards.length; i++) {
        const shard = shards[i];

        const shardRecord = await new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT INTO tasks (
                    content, title, description, status, gravity_tag,
                    project_id, tags, parent_task_id, shard_order, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                shard.title, // content = title for shards
                shard.title,
                shard.description || '',
                'inbox', // Shards start in inbox
                shard.gravity || 'Low',
                parentTask.project_id, // Inherit parent's project
                JSON.stringify(['shard']),
                parentTaskId,
                i + 1, // shard_order is 1-indexed
                now,
                function (err) {
                    if (err) reject(err);
                    else resolve({
                        id: this.lastID,
                        title: shard.title,
                        description: shard.description || '',
                        gravity_tag: shard.gravity || 'Low',
                        project_id: parentTask.project_id,
                        parent_task_id: parentTaskId,
                        shard_order: i + 1,
                        estimated_minutes: shard.estimated_minutes,
                        status: 'inbox',
                        created_at: now,
                    });
                }
            );

            stmt.finalize();
        });

        createdShards.push(shardRecord);
    }

    return createdShards;
}

/**
 * Main breakdown function - orchestrates the full pipeline
 * @param {object} parentTask - The task to decompose
 * @param {string} userId - User ID for context fetching
 * @param {object} db - Database instance
 * @returns {Promise<object>} - Breakdown result with created shards
 */
async function breakdownTask(parentTask, userId, db) {
    console.log(`[Magic Breakdown] Breaking down task: "${parentTask.title || parentTask.content}"`);

    // Step 1: Get user context (reusing from magicMic)
    const userContext = await getUserContext(db, userId);
    console.log(`[Magic Breakdown] User context loaded (${userContext.user_profile.active_projects.length} projects)`);

    // Step 2: Get recent corrections for AI learning
    const recentCorrections = await getRecentCorrections(db, 10);
    if (recentCorrections.length > 0) {
        console.log(`[Magic Breakdown] Including ${recentCorrections.length} corrections for AI learning`);
    }

    // Step 3: Generate breakdown via LLM
    const breakdownResult = await generateBreakdown(parentTask, userContext, recentCorrections);
    console.log(`[Magic Breakdown] LLM generated ${breakdownResult.shards?.length || 0} shards`);

    if (!breakdownResult.shards || breakdownResult.shards.length === 0) {
        throw new Error('LLM did not return any shards');
    }

    // Step 4: Create shard tasks in database
    const createdShards = await createShardTasks(
        parentTask.id,
        breakdownResult.shards,
        parentTask,
        db
    );
    console.log(`[Magic Breakdown] Created ${createdShards.length} shard tasks in database`);

    return {
        success: true,
        shards: createdShards,
        reasoning: breakdownResult.reasoning,
        parentTask: {
            id: parentTask.id,
            title: parentTask.title || parentTask.content,
        },
    };
}

/**
 * Get existing shards for a parent task
 * @param {number} parentTaskId - Parent task ID
 * @param {object} db - Database instance
 * @returns {Promise<Array>} - Array of shard tasks
 */
async function getShardsByParentId(parentTaskId, db) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY shard_order`,
            [parentTaskId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

/**
 * Check if all shards are complete and update parent if so
 * @param {number} parentTaskId - Parent task ID
 * @param {object} db - Database instance
 * @returns {Promise<boolean>} - Whether parent was marked complete
 */
async function checkAndCompleteParent(parentTaskId, db) {
    const shards = await getShardsByParentId(parentTaskId, db);

    if (shards.length === 0) {
        return false;
    }

    const allComplete = shards.every(s => s.status === 'complete');

    if (allComplete) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE tasks SET status = 'complete' WHERE id = ?`,
                [parentTaskId],
                function (err) {
                    if (err) reject(err);
                    else {
                        console.log(`[Magic Breakdown] All shards complete - parent task ${parentTaskId} marked complete`);
                        resolve(true);
                    }
                }
            );
        });
    }

    return false;
}

module.exports = {
    breakdownTask,
    generateBreakdown,
    createShardTasks,
    getShardsByParentId,
    checkAndCompleteParent,
};
