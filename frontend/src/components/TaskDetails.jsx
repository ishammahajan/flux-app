import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const gravityOptions = [
    { value: 'Low', label: '🟢 Low', color: 'green' },
    { value: 'Standard', label: '🟡 Standard', color: 'amber' },
    { value: 'High', label: '🔴 High', color: 'red' },
];

/**
 * TaskDetails - Full-screen modal for viewing and editing task details
 * Editable: gravity_tag, project_id, due_date, tags
 * Read-only: title, description, content (transcript), confidence_score, created_at
 */
export default function TaskDetails({ task, projects = [], onClose, onSave }) {
    const [isLoading, setIsLoading] = useState(false);

    // Editable fields state
    const [gravityTag, setGravityTag] = useState(task.gravity_tag || 'Standard');
    const [projectId, setProjectId] = useState(task.project_id || '');
    const [dueDate, setDueDate] = useState(task.due_date?.split('T')[0] || '');
    const [tags, setTags] = useState(
        Array.isArray(task.tags) ? task.tags.join(', ') : (task.tags || '')
    );

    // Track original values for corrections
    const originalValues = {
        gravity_tag: task.gravity_tag || 'Standard',
        project_id: task.project_id || '',
        due_date: task.due_date || '',
        tags: Array.isArray(task.tags) ? task.tags : [],
    };

    const hasChanges =
        gravityTag !== originalValues.gravity_tag ||
        projectId !== originalValues.project_id ||
        dueDate !== (originalValues.due_date?.split('T')[0] || '') ||
        tags !== (Array.isArray(originalValues.tags) ? originalValues.tags.join(', ') : '');

    const handleSave = async () => {
        setIsLoading(true);

        try {
            // Build updates object
            const tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);
            const updates = {
                gravity_tag: gravityTag,
                project_id: projectId || null,
                due_date: dueDate ? `${dueDate}T12:00:00` : null,
                tags: tagsArray,
            };

            // Build corrections array for AI learning
            const corrections = [];
            if (gravityTag !== originalValues.gravity_tag) {
                corrections.push({
                    field_name: 'gravity_tag',
                    original_value: originalValues.gravity_tag,
                    corrected_value: gravityTag,
                });
            }
            if (projectId !== originalValues.project_id) {
                corrections.push({
                    field_name: 'project_id',
                    original_value: originalValues.project_id,
                    corrected_value: projectId,
                });
            }
            if (dueDate !== (originalValues.due_date?.split('T')[0] || '')) {
                corrections.push({
                    field_name: 'due_date',
                    original_value: originalValues.due_date,
                    corrected_value: dueDate,
                });
            }
            const originalTagsStr = Array.isArray(originalValues.tags) ? originalValues.tags.join(', ') : '';
            if (tags !== originalTagsStr) {
                corrections.push({
                    field_name: 'tags',
                    original_value: originalTagsStr,
                    corrected_value: tags,
                });
            }

            // Save task updates
            const updateRes = await fetch(`/api/tasks/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!updateRes.ok) throw new Error('Failed to update task');

            // Log corrections for AI learning
            if (corrections.length > 0) {
                await fetch(`/api/tasks/${task.id}/corrections`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ corrections }),
                });
            }

            onSave?.({ ...task, ...updates, tags: tagsArray });
            onClose();
        } catch (error) {
            console.error('Error saving task:', error);
            alert('Failed to save changes');
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return 'N/A';
        return new Date(isoString).toLocaleString();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-stone border border-white/10 rounded-2xl shadow-2xl"
            >
                {/* Header */}
                <div className="sticky top-0 bg-stone border-b border-white/10 p-4 flex items-center justify-between">
                    <h2 className="text-lg font-medium text-white">Task Details</h2>
                    <button
                        onClick={onClose}
                        className="text-white/50 hover:text-white transition-colors text-xl"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-4 space-y-5">
                    {/* Read-only: Title */}
                    <div>
                        <label className="block text-xs text-white/40 mb-1">Title</label>
                        <div className="text-white text-lg font-medium">
                            {task.title || task.content}
                        </div>
                    </div>

                    {/* Read-only: Description */}
                    {task.description && (
                        <div>
                            <label className="block text-xs text-white/40 mb-1">Description</label>
                            <div className="text-white/70 text-sm">
                                {task.description}
                            </div>
                        </div>
                    )}

                    {/* Read-only: Original Transcript */}
                    {task.content && task.content !== task.title && (
                        <div>
                            <label className="block text-xs text-white/40 mb-1">Original Transcript</label>
                            <div className="text-white/50 text-sm italic bg-white/5 rounded-lg p-3">
                                "{task.content}"
                            </div>
                        </div>
                    )}

                    <hr className="border-white/10" />

                    {/* Editable: Gravity */}
                    <div>
                        <label className="block text-xs text-white/40 mb-2">Gravity (Effort Level)</label>
                        <div className="flex gap-2">
                            {gravityOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setGravityTag(opt.value)}
                                    className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-all ${gravityTag === opt.value
                                            ? `bg-${opt.color}-500/20 border-${opt.color}-500/50 text-white`
                                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Editable: Project */}
                    <div>
                        <label className="block text-xs text-white/40 mb-2">Project</label>
                        <select
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                        >
                            <option value="">No project</option>
                            {projects.map(p => (
                                <option key={p.id || p.name} value={p.name}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Editable: Due Date */}
                    <div>
                        <label className="block text-xs text-white/40 mb-2">Due Date</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                        />
                    </div>

                    {/* Editable: Tags */}
                    <div>
                        <label className="block text-xs text-white/40 mb-2">Tags (comma-separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="urgent, work, admin"
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                        />
                    </div>

                    <hr className="border-white/10" />

                    {/* Read-only: Metadata */}
                    <div className="flex gap-4 text-xs text-white/40">
                        {task.confidence_score !== undefined && (
                            <span>Confidence: {Math.round(task.confidence_score * 100)}%</span>
                        )}
                        <span>Created: {formatDate(task.created_at)}</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-stone border-t border-white/10 p-4 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || isLoading}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${hasChanges && !isLoading
                                ? 'bg-accent text-white hover:bg-accent/80'
                                : 'bg-white/10 text-white/30 cursor-not-allowed'
                            }`}
                    >
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
