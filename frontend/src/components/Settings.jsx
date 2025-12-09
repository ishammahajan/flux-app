import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Settings - User Profile Editor
 * Edit keywords, projects, and known people
 */
export default function Settings({ user, onClose, onProfileUpdate }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('keywords');

    // Form states
    const [highGravityKeywords, setHighGravityKeywords] = useState([]);
    const [lowGravityKeywords, setLowGravityKeywords] = useState([]);
    const [deepgramKeywords, setDeepgramKeywords] = useState([]);
    const [projects, setProjects] = useState([]);
    const [knownPeople, setKnownPeople] = useState([]);

    // New item inputs
    const [newKeyword, setNewKeyword] = useState('');
    const [newProject, setNewProject] = useState({ name: '', color: '#6B7280', description: '' });
    const [newPerson, setNewPerson] = useState({ name: '', context: '' });

    // Load profile on mount
    useEffect(() => {
        loadProfile();
    }, [user.id]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/profile/${user.id}`);
            if (!response.ok) throw new Error('Failed to load profile');
            const data = await response.json();

            setProfile(data);
            setHighGravityKeywords(data.high_gravity_keywords || []);
            setLowGravityKeywords(data.low_gravity_keywords || []);
            setDeepgramKeywords(data.deepgram_keywords || []);
            setProjects(data.projects || []);
            setKnownPeople(data.known_people || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveKeywords = async () => {
        setSaving(true);
        try {
            const response = await fetch(`/api/profile/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    high_gravity_keywords: highGravityKeywords,
                    low_gravity_keywords: lowGravityKeywords,
                    deepgram_keywords: deepgramKeywords,
                }),
            });
            if (!response.ok) throw new Error('Failed to save');
            onProfileUpdate?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const addKeyword = (type) => {
        if (!newKeyword.trim()) return;
        const keyword = newKeyword.trim().toLowerCase();

        if (type === 'high') {
            if (!highGravityKeywords.includes(keyword)) {
                setHighGravityKeywords([...highGravityKeywords, keyword]);
            }
        } else if (type === 'low') {
            if (!lowGravityKeywords.includes(keyword)) {
                setLowGravityKeywords([...lowGravityKeywords, keyword]);
            }
        } else if (type === 'deepgram') {
            if (!deepgramKeywords.includes(newKeyword.trim())) {
                setDeepgramKeywords([...deepgramKeywords, newKeyword.trim()]);
            }
        }
        setNewKeyword('');
    };

    const removeKeyword = (type, keyword) => {
        if (type === 'high') {
            setHighGravityKeywords(highGravityKeywords.filter(k => k !== keyword));
        } else if (type === 'low') {
            setLowGravityKeywords(lowGravityKeywords.filter(k => k !== keyword));
        } else if (type === 'deepgram') {
            setDeepgramKeywords(deepgramKeywords.filter(k => k !== keyword));
        }
    };

    const addProject = async () => {
        if (!newProject.name.trim()) return;
        try {
            const response = await fetch(`/api/profile/${user.id}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProject),
            });
            if (!response.ok) throw new Error('Failed to add project');
            const project = await response.json();
            setProjects([...projects, project]);
            setNewProject({ name: '', color: '#6B7280', description: '' });
            onProfileUpdate?.();
        } catch (err) {
            setError(err.message);
        }
    };

    const deleteProject = async (projectId) => {
        try {
            const response = await fetch(`/api/profile/${user.id}/projects/${projectId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete project');
            setProjects(projects.filter(p => p.id !== projectId));
            onProfileUpdate?.();
        } catch (err) {
            setError(err.message);
        }
    };

    const addPerson = async () => {
        if (!newPerson.name.trim()) return;
        try {
            const response = await fetch(`/api/profile/${user.id}/people`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPerson),
            });
            if (!response.ok) throw new Error('Failed to add person');
            const person = await response.json();
            setKnownPeople([...knownPeople, person]);
            setNewPerson({ name: '', context: '' });
            onProfileUpdate?.();
        } catch (err) {
            setError(err.message);
        }
    };

    const deletePerson = async (personId) => {
        try {
            const response = await fetch(`/api/profile/${user.id}/people/${personId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete person');
            setKnownPeople(knownPeople.filter(p => p.id !== personId));
            onProfileUpdate?.();
        } catch (err) {
            setError(err.message);
        }
    };

    const tabs = [
        { id: 'keywords', label: 'Keywords', icon: '🏷️' },
        { id: 'projects', label: 'Projects', icon: '📁' },
        { id: 'people', label: 'People', icon: '👤' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />

            {/* Modal */}
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 w-full max-w-2xl max-h-[85vh] bg-stone/90 rounded-2xl border border-white/10 overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-lg font-medium text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-white/50 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'text-white bg-white/5 border-b-2 border-white/50'
                                    : 'text-white/50 hover:text-white/80'
                                }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="text-white/50">Loading...</div>
                        </div>
                    ) : error ? (
                        <div className="text-red-400 text-center py-8">{error}</div>
                    ) : (
                        <AnimatePresence mode="wait">
                            {/* Keywords Tab */}
                            {activeTab === 'keywords' && (
                                <motion.div
                                    key="keywords"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className="space-y-6"
                                >
                                    {/* High Gravity Keywords */}
                                    <div>
                                        <label className="text-sm text-white/60 mb-2 flex items-center gap-2">
                                            <span>🔴</span> High Gravity Keywords
                                            <span className="text-xs text-white/40">(draining tasks)</span>
                                        </label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {highGravityKeywords.map(kw => (
                                                <span
                                                    key={kw}
                                                    className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-sm flex items-center gap-2"
                                                >
                                                    {kw}
                                                    <button onClick={() => removeKeyword('high', kw)} className="hover:text-white">×</button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newKeyword}
                                                onChange={(e) => setNewKeyword(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addKeyword('high')}
                                                placeholder="Add keyword..."
                                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
                                            />
                                            <button
                                                onClick={() => addKeyword('high')}
                                                className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Low Gravity Keywords */}
                                    <div>
                                        <label className="text-sm text-white/60 mb-2 flex items-center gap-2">
                                            <span>🟢</span> Low Gravity Keywords
                                            <span className="text-xs text-white/40">(energizing tasks)</span>
                                        </label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {lowGravityKeywords.map(kw => (
                                                <span
                                                    key={kw}
                                                    className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm flex items-center gap-2"
                                                >
                                                    {kw}
                                                    <button onClick={() => removeKeyword('low', kw)} className="hover:text-white">×</button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newKeyword}
                                                onChange={(e) => setNewKeyword(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addKeyword('low')}
                                                placeholder="Add keyword..."
                                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
                                            />
                                            <button
                                                onClick={() => addKeyword('low')}
                                                className="px-4 py-2 bg-green-500/20 text-green-300 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Deepgram Keywords */}
                                    <div>
                                        <label className="text-sm text-white/60 mb-2 flex items-center gap-2">
                                            <span>🎤</span> Voice Recognition Keywords
                                            <span className="text-xs text-white/40">(custom vocabulary)</span>
                                        </label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {deepgramKeywords.map(kw => (
                                                <span
                                                    key={kw}
                                                    className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-2"
                                                >
                                                    {kw}
                                                    <button onClick={() => removeKeyword('deepgram', kw)} className="hover:text-white">×</button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newKeyword}
                                                onChange={(e) => setNewKeyword(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addKeyword('deepgram')}
                                                placeholder="Add keyword..."
                                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
                                            />
                                            <button
                                                onClick={() => addKeyword('deepgram')}
                                                className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg text-sm hover:bg-purple-500/30 transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Save Button */}
                                    <button
                                        onClick={saveKeywords}
                                        disabled={saving}
                                        className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Saving...' : 'Save Keywords'}
                                    </button>
                                </motion.div>
                            )}

                            {/* Projects Tab */}
                            {activeTab === 'projects' && (
                                <motion.div
                                    key="projects"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className="space-y-4"
                                >
                                    {/* Existing Projects */}
                                    {projects.map(project => (
                                        <div
                                            key={project.id}
                                            className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10"
                                        >
                                            <div
                                                className="w-4 h-4 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: project.color }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-white truncate">{project.name}</div>
                                                {project.description && (
                                                    <div className="text-xs text-white/50 truncate">{project.description}</div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => deleteProject(project.id)}
                                                className="text-white/30 hover:text-red-400 transition-colors"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}

                                    {/* Add New Project */}
                                    <div className="p-4 bg-white/5 rounded-xl border border-dashed border-white/20">
                                        <div className="text-sm text-white/60 mb-3">Add New Project</div>
                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <input
                                                    type="color"
                                                    value={newProject.color}
                                                    onChange={(e) => setNewProject({ ...newProject, color: e.target.value })}
                                                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
                                                />
                                                <input
                                                    type="text"
                                                    value={newProject.name}
                                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                                    placeholder="Project name"
                                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                value={newProject.description}
                                                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                                placeholder="Description (optional)"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
                                            />
                                            <button
                                                onClick={addProject}
                                                className="w-full py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm transition-colors"
                                            >
                                                Add Project
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* People Tab */}
                            {activeTab === 'people' && (
                                <motion.div
                                    key="people"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className="space-y-4"
                                >
                                    {/* Existing People */}
                                    {knownPeople.length === 0 ? (
                                        <div className="text-center text-white/40 py-8">
                                            No known people yet. Add people to help with voice recognition.
                                        </div>
                                    ) : (
                                        knownPeople.map(person => (
                                            <div
                                                key={person.id}
                                                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60">
                                                    👤
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-white truncate">{person.name}</div>
                                                    {person.context && (
                                                        <div className="text-xs text-white/50 truncate">{person.context}</div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => deletePerson(person.id)}
                                                    className="text-white/30 hover:text-red-400 transition-colors"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        ))
                                    )}

                                    {/* Add New Person */}
                                    <div className="p-4 bg-white/5 rounded-xl border border-dashed border-white/20">
                                        <div className="text-sm text-white/60 mb-3">Add Known Person</div>
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={newPerson.name}
                                                onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                                                placeholder="Name"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
                                            />
                                            <input
                                                type="text"
                                                value={newPerson.context}
                                                onChange={(e) => setNewPerson({ ...newPerson, context: e.target.value })}
                                                placeholder="Context (e.g., 'colleague', 'doctor')"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
                                            />
                                            <button
                                                onClick={addPerson}
                                                className="w-full py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm transition-colors"
                                            >
                                                Add Person
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
