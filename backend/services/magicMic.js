/**
 * Magic Mic Service
 * Audio-to-Action Pipeline for FLUX Task Manager
 * 
 * Converts unstructured voice notes into structured task data
 * using Deepgram for transcription and OpenRouter for LLM processing.
 */

const fs = require('fs');
const path = require('path');

// Load the system prompt
const SYSTEM_PROMPT = fs.readFileSync(
    path.join(__dirname, '../prompts/executive-function-proxy.txt'),
    'utf-8'
);

/**
 * Transcribe audio using Deepgram Nova-2
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string[]} keywords - Custom vocabulary for better transcription
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioBuffer, keywords = []) {
    const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

    if (!DEEPGRAM_API_KEY) {
        throw new Error('DEEPGRAM_API_KEY is not configured');
    }

    // Build URL with keywords if provided
    let url = 'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&filler_words=false&punctuate=true';

    // Add keywords for better transcription accuracy
    if (keywords.length > 0) {
        const keywordParam = keywords.map(k => encodeURIComponent(k)).join('&keyterm=');
        url += `&keyterm=${keywordParam}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${DEEPGRAM_API_KEY}`,
            'Content-Type': 'audio/webm',
        },
        body: audioBuffer,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Deepgram transcription failed: ${error}`);
    }

    const result = await response.json();
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    if (!transcript || transcript.trim() === '') {
        throw new Error('UNINTELLIGIBLE_AUDIO');
    }

    return transcript;
}

/**
 * Fetch user context from database
 * @param {object} db - Database instance
 * @param {string} userId - User ID
 * @returns {Promise<object>} - User context object with deepgramKeywords
 */
async function getUserContext(db, userId) {
    // Get user profile (with fallback for missing user)
    const profile = await new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM user_profiles WHERE id = ?',
            [userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            }
        );
    });

    // Get active projects WITH descriptions
    const projects = await new Promise((resolve, reject) => {
        db.all(
            'SELECT name, description FROM projects WHERE user_id = ?',
            [userId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });

    // Get known people
    const people = await new Promise((resolve, reject) => {
        db.all(
            'SELECT name, context FROM known_people WHERE user_id = ?',
            [userId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });

    // Parse JSON fields from profile with safe defaults
    let highGravityKeywords = ['call', 'cancel', 'dispute', 'clean', 'sort out', 'phone'];
    let lowGravityKeywords = ['write', 'design', 'research', 'read', 'code', 'build'];
    let deepgramKeywords = [];

    if (profile) {
        try {
            if (profile.high_gravity_keywords) {
                highGravityKeywords = JSON.parse(profile.high_gravity_keywords);
            }
            if (profile.low_gravity_keywords) {
                lowGravityKeywords = JSON.parse(profile.low_gravity_keywords);
            }
            if (profile.deepgram_keywords) {
                deepgramKeywords = JSON.parse(profile.deepgram_keywords);
            }
        } catch (e) {
            console.warn('[Magic Mic] Failed to parse user profile fields, using defaults');
        }
    }

    // Also add project names and people names to deepgram keywords for better transcription
    const allKeywords = [
        ...deepgramKeywords,
        ...projects.map(p => p.name),
        ...people.map(p => p.name)
    ];

    return {
        current_time: new Date().toISOString(),
        timezone: profile?.timezone || 'UTC',
        user_profile: {
            high_gravity_keywords: highGravityKeywords,
            low_gravity_keywords: lowGravityKeywords,
            known_people: people,
            // Include project descriptions for LLM context
            active_projects: projects.map(p => ({
                name: p.name,
                description: p.description || ''
            })),
        },
        // Separate field for Deepgram keywords
        deepgramKeywords: [...new Set(allKeywords)], // Dedupe
    };
}

/**
 * Fetch recent task corrections for AI learning
 * @param {object} db - Database instance  
 * @param {number} limit - Max corrections to fetch
 * @returns {Promise<Array>} - Recent corrections
 */
async function getRecentCorrections(db, limit = 10) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT field_name, original_value, corrected_value, original_transcript
            FROM task_corrections
            ORDER BY created_at DESC
            LIMIT ?
        `, [limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * Extract structured task using LLM via OpenRouter
 * @param {string} transcript - Transcribed text
 * @param {object} userContext - User context object
 * @param {Array} recentCorrections - Recent user corrections for learning
 * @returns {Promise<object>} - Structured task data
 */
async function extractTaskWithLLM(transcript, userContext, recentCorrections = []) {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not configured');
    }

    // Build corrections context if available
    let correctionsContext = '';
    if (recentCorrections.length > 0) {
        correctionsContext = `\n## Recent Corrections (Learn from these)
The user has corrected the following AI outputs. Use these to calibrate your responses:
${recentCorrections.map(c => `- For transcript "${c.original_transcript?.slice(0, 50)}...": Changed ${c.field_name} from "${c.original_value}" to "${c.corrected_value}"`).join('\n')}
`;
    }

    const userMessage = `## Transcript
"${transcript}"

## User Context
${JSON.stringify(userContext, null, 2)}
${correctionsContext}
Parse this transcript into a structured task. Respond with ONLY valid JSON, no markdown code blocks.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://flux-app.local',
            'X-Title': 'FLUX Magic Mic',
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.3,
            max_tokens: 1000,
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
        throw new Error(`Failed to parse LLM response as JSON: ${content}`);
    }
}

/**
 * Process audio entry through the Magic Mic pipeline
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} userId - User ID
 * @param {object} db - Database instance
 * @param {object} [progress] - Optional progress tracker from progressEmitter
 * @returns {Promise<object>} - Processed task with status
 */
async function processAudioEntry(audioBuffer, userId, db, progress = null) {
    const emit = progress?.emit || (() => { }); // No-op if no progress tracker

    try {
        // Step 1: Get user context first (needed for Deepgram keywords)
        emit('context_loading', { message: 'Loading user profile...' });
        const userContext = await getUserContext(db, userId);
        emit('context_loaded', {
            message: 'User profile loaded',
            projectCount: userContext.user_profile.active_projects.length
        });

        // Step 2: Transcribe audio with custom keywords
        emit('transcription_start', { message: 'Transcribing audio...' });
        const transcript = await transcribeAudio(audioBuffer, userContext.deepgramKeywords);
        console.log('[Magic Mic] Transcript:', transcript);
        emit('transcription_complete', {
            message: 'Audio transcribed',
            transcript
        });

        // Step 3: Fetch recent corrections for AI learning
        const recentCorrections = await getRecentCorrections(db, 10);
        if (recentCorrections.length > 0) {
            console.log(`[Magic Mic] Including ${recentCorrections.length} corrections for AI learning`);
        }

        // Step 4: Extract structured task via LLM
        emit('processing_start', { message: 'Analyzing task...' });
        const extractedTask = await extractTaskWithLLM(transcript, userContext, recentCorrections);
        emit('processing_complete', {
            message: 'Task analyzed',
            title: extractedTask.task_title,
            gravity: extractedTask.gravity
        });

        // Step 4: Determine final status based on confidence/ambiguity
        let finalStatus = 'inbox';
        let finalTags = extractedTask.tags || [];

        if (extractedTask.is_ambiguous || extractedTask.project_confidence < 0.6) {
            finalStatus = 'inbox_review';
            if (!finalTags.includes('needs_sorting')) {
                finalTags.push('needs_sorting');
            }
        }

        // Step 5: Insert into database
        emit('saving', { message: 'Saving task...' });
        const taskRecord = await new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT INTO tasks (
                    content, title, description, status, gravity_tag, 
                    project_id, due_date, tags, confidence_score, 
                    is_ambiguous, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const now = new Date().toISOString();

            stmt.run(
                transcript,
                extractedTask.task_title,
                extractedTask.task_description,
                finalStatus,
                extractedTask.gravity,
                extractedTask.project_id,
                extractedTask.due_date,
                JSON.stringify(finalTags),
                extractedTask.project_confidence,
                extractedTask.is_ambiguous ? 1 : 0,
                now,
                function (err) {
                    if (err) reject(err);
                    else resolve({
                        id: this.lastID,
                        ...extractedTask,
                        status: finalStatus,
                        tags: finalTags,
                        created_at: now,
                    });
                }
            );

            stmt.finalize();
        });

        const result = {
            success: true,
            task: taskRecord,
            transcript,
        };

        if (progress?.complete) {
            progress.complete(result);
        }

        return result;

    } catch (error) {
        // Handle unintelligible audio gracefully
        if (error.message === 'UNINTELLIGIBLE_AUDIO') {
            const errorResult = {
                success: false,
                error: 'Could not understand the audio. Please try speaking more clearly.',
                is_unintelligible: true,
            };
            if (progress?.error) {
                progress.error(errorResult.error);
            }
            return errorResult;
        }

        // Emit error and re-throw
        if (progress?.error) {
            progress.error(error.message);
        }
        throw error;
    }
}

module.exports = {
    processAudioEntry,
    transcribeAudio,
    getUserContext,
    extractTaskWithLLM,
    getRecentCorrections,
};
