import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import Current from './components/Current';
import Vault from './components/Vault';
import Airlock from './components/Airlock';
import Login from './components/Login';
import TaskDetails from './components/TaskDetails';
import BreakdownAnimation from './components/BreakdownAnimation';

function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tasks, setTasks] = useState([]);
  const [showAirlock, setShowAirlock] = useState(false);
  const [gravity, setGravity] = useState(null);

  // Side Quest state
  const [isSideQuest, setIsSideQuest] = useState(false);
  const [sideQuestText, setSideQuestText] = useState('');
  const [sideQuestTimer, setSideQuestTimer] = useState(0);
  const [sideQuestHistory, setSideQuestHistory] = useState(() => {
    // Load from localStorage on init
    try {
      const saved = localStorage.getItem('flux_side_quests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showSideQuestLog, setShowSideQuestLog] = useState(false);
  const timerRef = useRef(null);

  // Inbox view state
  const [showInbox, setShowInbox] = useState(false);
  const [inboxTasks, setInboxTasks] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);

  // Jettison confirmation state
  const [showJettisonConfirm, setShowJettisonConfirm] = useState(false);

  // Quick reroll state
  const [showRerollOptions, setShowRerollOptions] = useState(false);

  // Task details modal state
  const [selectedTask, setSelectedTask] = useState(null);
  const [userProjects, setUserProjects] = useState([]);

  // Magic Breakdown state
  const [breakdownTask, setBreakdownTask] = useState(null);
  const [breakdownShards, setBreakdownShards] = useState([]);
  const [isBreakingDown, setIsBreakingDown] = useState(false);

  // Check auth on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('flux_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch {
      // Invalid stored user
      localStorage.removeItem('flux_user');
    }
    setAuthLoading(false);
  }, []);

  // Persist side quest history to localStorage
  useEffect(() => {
    if (sideQuestHistory.length > 0) {
      localStorage.setItem('flux_side_quests', JSON.stringify(sideQuestHistory));
    }
  }, [sideQuestHistory]);

  // Side Quest timer effect
  useEffect(() => {
    if (isSideQuest) {
      timerRef.current = setInterval(() => {
        setSideQuestTimer(t => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setSideQuestTimer(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSideQuest]);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('flux_user');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCapture = (task, transcript) => {
    console.log("Captured task:", task);
    const gravityEmoji = task.gravity === 'High' ? '🔴' : task.gravity === 'Low' ? '🟢' : '🟡';
    const projectInfo = task.project_id ? ` → ${task.project_id}` : '';
    alert(`✨ ${task.task_title}\n\n${gravityEmoji} ${task.gravity}${projectInfo}\n📝 "${transcript}"`);
  };

  const handleBundleSelected = (newTasks) => {
    setTasks(newTasks);
    setShowAirlock(false);
    setShowRerollOptions(false);
  };

  // Select gravity and fetch tasks in one click
  const handleGravitySelect = async (level) => {
    setGravity(level);
    setShowRerollOptions(false);
    try {
      const response = await fetch(`/api/tasks/bundle?gravity=${level}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks);
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  };

  const handleComplete = async (id) => {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'complete' }),
      });
      setTasks(tasks.filter(t => t.id !== id));
    } catch (error) {
      console.error("Error completing task:", error);
    }
  };

  const handleDefer = async (id) => {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'deferred' }),
      });
      setTasks(tasks.filter(t => t.id !== id));
    } catch (error) {
      console.error("Error deferring task:", error);
    }
  };

  const handleBreakdown = async (task) => {
    try {
      setBreakdownTask(task);
      setIsBreakingDown(true);

      const response = await fetch(`/api/tasks/${task.id}/breakdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id || 'ishamm' }),
      });

      if (response.ok) {
        const data = await response.json();
        setBreakdownShards(data.shards || []);
      } else {
        const error = await response.json();
        console.error('Breakdown failed:', error);
        setIsBreakingDown(false);
        setBreakdownTask(null);
        alert('Failed to break down task: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error breaking down task:', error);
      setIsBreakingDown(false);
      setBreakdownTask(null);
    }
  };

  const handleShardComplete = async (shard) => {
    try {
      const response = await fetch(`/api/tasks/${shard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'complete' }),
      });
      if (response.ok) {
        const data = await response.json();
        // Check if parent was auto-completed
        if (data.parentCompleted) {
          // Remove parent from current tasks
          setTasks(tasks.filter(t => t.id !== breakdownTask.id));
        }
      }
    } catch (error) {
      console.error('Error completing shard:', error);
    }
  };

  const handleShardDefer = async (shard) => {
    try {
      await fetch(`/api/tasks/${shard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'deferred' }),
      });
    } catch (error) {
      console.error('Error deferring shard:', error);
    }
  };

  const handleBreakdownComplete = () => {
    // All shards done, remove parent from task list
    setTasks(tasks.filter(t => t.id !== breakdownTask?.id));
    setIsBreakingDown(false);
    setBreakdownTask(null);
    setBreakdownShards([]);
  };

  const cancelBreakdown = () => {
    setIsBreakingDown(false);
    setBreakdownTask(null);
    setBreakdownShards([]);
  };

  const handleJettison = async () => {
    try {
      await fetch('/api/tasks/jettison', { method: 'POST' });
      setTasks([]);
      setShowJettisonConfirm(false);
    } catch (error) {
      console.error("Error jettisoning tasks:", error);
    }
  };

  const startSideQuest = () => {
    setIsSideQuest(true);
    setSideQuestText('');
  };

  const completeSideQuest = () => {
    // Save to history
    if (sideQuestText || sideQuestTimer > 0) {
      setSideQuestHistory(prev => [{
        id: Date.now(),
        text: sideQuestText || '(unexplored)',
        duration: sideQuestTimer,
        timestamp: new Date().toISOString()
      }, ...prev].slice(0, 20)); // Keep last 20
    }
    setIsSideQuest(false);
  };

  // Load inbox tasks
  const loadInbox = async () => {
    setInboxLoading(true);
    try {
      const response = await fetch('/api/tasks/inbox');
      if (response.ok) {
        const data = await response.json();
        setInboxTasks(data.tasks);
      }
    } catch (error) {
      console.error("Error loading inbox:", error);
    }
    setInboxLoading(false);
  };

  const openInbox = () => {
    setShowInbox(true);
    loadInbox();
  };

  // Load user's projects for TaskDetails dropdown
  const loadProjects = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/profile/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setUserProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  };

  // Open task details modal
  const handleOpenDetails = (task) => {
    loadProjects();
    setSelectedTask(task);
  };

  // Save task updates
  const handleSaveTask = (updatedTask) => {
    setTasks(tasks.map(t => t.id === updatedTask.id ? { ...t, ...updatedTask } : t));
    setSelectedTask(null);
  };

  // =========================================================================
  // AUTH CHECK
  // =========================================================================
  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-void flex items-center justify-center">
        <div className="text-white/30 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // =========================================================================
  // SIDE QUEST MODE
  // =========================================================================
  if (isSideQuest) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-purple-950 via-purple-900/50 to-void flex flex-col items-center justify-center text-white p-4 sm:p-8">
        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 text-purple-300/60 font-mono text-xl sm:text-2xl">
          {formatTime(sideQuestTimer)}
        </div>

        <div className="flex flex-col items-center gap-6 sm:gap-8 w-full max-w-lg px-4">
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 opacity-60 animate-pulse" />
            <div className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-purple-500/20 animate-ping" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-light text-purple-200">Side Quest</h1>
          <p className="text-purple-300/60 text-center text-sm sm:text-base">Follow the dopamine. It's okay.</p>

          <input
            type="text"
            value={sideQuestText}
            onChange={(e) => setSideQuestText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && completeSideQuest()}
            placeholder="What caught your attention?"
            className="w-full bg-white/5 border border-purple-500/20 rounded-xl p-4 text-white text-center text-lg placeholder:text-purple-300/30 focus:outline-none focus:border-purple-500/50 transition-colors"
            autoFocus
          />

          <button
            onClick={completeSideQuest}
            className="mt-4 px-8 py-3 sm:px-12 sm:py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-medium text-base sm:text-lg transition-all hover:scale-105 active:scale-95"
          >
            Return to Current
          </button>
        </div>

        <p className="absolute bottom-4 sm:bottom-8 text-purple-400/30 text-xs sm:text-sm">
          Press Enter to return
        </p>
      </div>
    );
  }

  // =========================================================================
  // INBOX VIEW
  // =========================================================================
  if (showInbox) {
    return (
      <div className="h-screen w-screen bg-void text-white p-4 sm:p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-light">📥 Vault Inbox</h1>
            <button
              onClick={() => setShowInbox(false)}
              className="text-white/50 hover:text-white transition-colors text-sm sm:text-base"
            >
              ← Back
            </button>
          </div>

          {inboxLoading ? (
            <div className="text-center text-white/50 py-12">Loading...</div>
          ) : inboxTasks.length === 0 ? (
            <div className="text-center text-white/50 py-12">
              <p className="text-4xl mb-4">🕳️</p>
              <p>Your vault is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inboxTasks.map(task => (
                <div
                  key={task.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">
                      {task.gravity_tag === 'High' ? '🔴' : task.gravity_tag === 'Low' ? '🟢' : '🟡'}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">{task.title || task.content}</div>
                      {task.description && (
                        <div className="text-sm text-white/50 mt-1">{task.description}</div>
                      )}
                      <div className="text-xs text-white/30 mt-2">
                        {task.status === 'inbox_review' && <span className="text-amber-400">Needs review</span>}
                        {task.project_id && <span className="ml-2">📁 {task.project_id}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // SIDE QUEST LOG VIEW
  // =========================================================================
  if (showSideQuestLog) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-purple-950/50 to-void text-white p-4 sm:p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-light">🌀 Side Quest Log</h1>
            <button
              onClick={() => setShowSideQuestLog(false)}
              className="text-white/50 hover:text-white transition-colors text-sm sm:text-base"
            >
              ← Back
            </button>
          </div>

          {sideQuestHistory.length === 0 ? (
            <div className="text-center text-purple-300/50 py-12">
              <p className="text-4xl mb-4">🧭</p>
              <p>No side quests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sideQuestHistory.map(sq => (
                <div
                  key={sq.id}
                  className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-purple-200">{sq.text}</div>
                      <div className="text-xs text-purple-300/50 mt-1">
                        {new Date(sq.timestamp).toLocaleDateString()} • {formatTime(sq.duration)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN APP VIEW
  // =========================================================================
  return (
    <div className="h-screen w-screen relative bg-void text-white overflow-hidden font-sans selection:bg-accent selection:text-white">
      <Current
        tasks={tasks}
        onComplete={handleComplete}
        onDefer={handleDefer}
        onBreakdown={handleBreakdown}
        onOpenDetails={handleOpenDetails}
      />

      {/* Safety Valves (Top Left) */}
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8 flex flex-col sm:flex-row gap-2 sm:gap-3 z-20">
        <button
          onClick={startSideQuest}
          className="text-xs sm:text-sm text-purple-400 border border-purple-400/30 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-purple-400/10 transition-all hover:scale-105"
        >
          🌀 Side Quest
        </button>

        {/* Side Quest Log */}
        {sideQuestHistory.length > 0 && (
          <button
            onClick={() => setShowSideQuestLog(true)}
            className="text-sm text-purple-300/50 hover:text-purple-300 transition-colors"
            title="View side quest history"
          >
            ({sideQuestHistory.length})
          </button>
        )}

        {/* Jettison */}
        {!showJettisonConfirm ? (
          <button
            onClick={() => setShowJettisonConfirm(true)}
            className="text-xs sm:text-sm text-red-400 border border-red-400/30 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-red-400/10 transition-all hover:scale-105"
          >
            ⚡ Jettison
          </button>
        ) : (
          <div className="flex gap-2 animate-pulse">
            <button
              onClick={handleJettison}
              className="text-xs sm:text-sm bg-red-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-red-400 transition-colors font-medium"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowJettisonConfirm(false)}
              className="text-xs sm:text-sm text-gray-400 border border-gray-400/30 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-gray-400/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* User, Inbox & Gravity indicator (top right) */}
      <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4 z-20">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={openInbox}
            className="text-xs sm:text-sm text-white/40 hover:text-white/80 transition-colors"
          >
            📥 Inbox
          </button>
          {gravity && (
            <div className="text-xs sm:text-sm text-white/50">
              {gravity === 'low' ? '🟢' : gravity === 'high' ? '🔴' : '🟡'} {gravity}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 sm:ml-2 sm:pl-4 sm:border-l border-white/10">
          <span className="text-xs sm:text-sm text-white/50">{user.display_name || user.id}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
            title="Logout"
          >
            ↪
          </button>
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 flex flex-col gap-3 sm:gap-4 items-center z-20">
        {/* Gravity selector - expands on hover */}
        <div
          className="relative flex flex-col items-center"
          onMouseEnter={() => setShowRerollOptions(true)}
          onMouseLeave={() => setShowRerollOptions(false)}
        >
          {/* Expanded gravity options */}
          {showRerollOptions && (
            <div className="absolute bottom-full mb-2 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                onClick={() => handleGravitySelect('low')}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-green-500/20 hover:bg-green-500/40 flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 border border-green-500/30 text-sm sm:text-base"
                title="Low gravity (flow state)"
              >
                🟢
              </button>
              <button
                onClick={() => handleGravitySelect('standard')}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-yellow-500/20 hover:bg-yellow-500/40 flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 border border-yellow-500/30 text-sm sm:text-base"
                title="Standard gravity"
              >
                🟡
              </button>
              <button
                onClick={() => handleGravitySelect('high')}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 border border-red-500/30 text-sm sm:text-base"
                title="High gravity (survival mode)"
              >
                🔴
              </button>
            </div>
          )}

          {/* Main button */}
          <button
            onClick={() => setShowAirlock(true)}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 ${gravity
              ? gravity === 'low' ? 'bg-green-500/20 border border-green-500/30'
                : gravity === 'high' ? 'bg-red-500/20 border border-red-500/30'
                  : 'bg-yellow-500/20 border border-yellow-500/30'
              : 'bg-white/10 hover:bg-white/20'
              }`}
            title="Calibrate / Reroll"
          >
            {gravity ? (
              <span className="text-lg">{gravity === 'low' ? '🟢' : gravity === 'high' ? '🔴' : '🟡'}</span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            )}
          </button>
        </div>

        <Vault onCapture={handleCapture} userId={user.id} />
      </div>

      {/* Overlays */}
      {showAirlock && (
        <Airlock
          onBundleSelected={handleBundleSelected}
          onGravityChange={setGravity}
          onClose={() => setShowAirlock(false)}
        />
      )}

      {/* Task Details Modal */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetails
            task={selectedTask}
            projects={userProjects}
            onClose={() => setSelectedTask(null)}
            onSave={handleSaveTask}
          />
        )}
      </AnimatePresence>

      {/* Magic Breakdown Animation Overlay */}
      {(isBreakingDown || breakdownShards.length > 0) && (
        <BreakdownAnimation
          parentTask={breakdownTask}
          shards={breakdownShards}
          isBreaking={isBreakingDown && breakdownShards.length > 0}
          onShardComplete={handleShardComplete}
          onShardDefer={handleShardDefer}
          onBreakdownComplete={handleBreakdownComplete}
          onCancel={cancelBreakdown}
        />
      )}
    </div>
  );
}

export default App;
