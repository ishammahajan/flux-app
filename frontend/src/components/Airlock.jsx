import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Airlock - Energy Calibration & Task Selection
 * Declarative, autonomy-focused design
 */
export default function Airlock({ onBundleSelected, onGravityChange, onClose }) {
    const [loading, setLoading] = useState(false);
    const [selectedGravity, setSelectedGravity] = useState(null);

    const gravityOptions = [
        {
            id: 'low',
            emoji: '🟢',
            label: 'Float',
            description: 'I can handle anything',
            color: 'green'
        },
        {
            id: 'standard',
            emoji: '🟡',
            label: 'Steady',
            description: 'Normal capacity',
            color: 'amber'
        },
        {
            id: 'high',
            emoji: '🔴',
            label: 'Heavy',
            description: 'Keep it gentle',
            color: 'red'
        }
    ];

    const handleGravitySelect = async (level) => {
        setLoading(true);
        setSelectedGravity(level);

        if (onGravityChange) {
            onGravityChange(level);
        }

        try {
            const response = await fetch(`/api/tasks/bundle?gravity=${level}`);
            if (response.ok) {
                const data = await response.json();
                // Small delay for smoother transition
                setTimeout(() => {
                    onBundleSelected(data.tasks);
                }, 300);
            } else {
                console.error("Failed to fetch bundle");
                setLoading(false);
            }
        } catch (error) {
            console.error("Error fetching bundle:", error);
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center"
                onClick={onClose}
            >
                {/* Atmospheric backdrop */}
                <div className="absolute inset-0 bg-gradient-to-b from-void via-[#0a0a0f] to-void backdrop-blur-md" />

                {/* Ambient glow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl" />
                </div>

                {/* Content */}
                <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="relative z-10 px-6 py-8 max-w-md w-full mx-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Declarative question */}
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-white/50 text-center text-lg mb-8"
                    >
                        How does everything feel right now?
                    </motion.p>

                    {/* Gravity options */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        {gravityOptions.map((option, index) => (
                            <motion.button
                                key={option.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 + index * 0.05 }}
                                onClick={() => handleGravitySelect(option.id)}
                                disabled={loading}
                                className={`
                                    flex-1 group relative overflow-hidden
                                    px-6 py-5 sm:px-4 sm:py-6 rounded-2xl
                                    transition-all duration-300
                                    border disabled:opacity-50
                                    ${selectedGravity === option.id
                                        ? `bg-${option.color}-500/30 border-${option.color}-500/50 scale-105`
                                        : `bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20`
                                    }
                                `}
                            >
                                {/* Glow effect on hover */}
                                <div className={`
                                    absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity
                                    bg-gradient-to-b from-${option.color}-500/10 to-transparent
                                `} />

                                <div className="relative flex sm:flex-col items-center sm:items-center gap-3 sm:gap-2">
                                    <span className="text-2xl sm:text-3xl">{option.emoji}</span>
                                    <div className="text-left sm:text-center">
                                        <div className="font-medium text-white">{option.label}</div>
                                        <div className="text-xs text-white/40 hidden sm:block">{option.description}</div>
                                    </div>
                                </div>
                            </motion.button>
                        ))}
                    </div>

                    {/* Loading state */}
                    <AnimatePresence>
                        {loading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center bg-void/80 rounded-2xl"
                            >
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Subtle close hint */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-center text-white/20 text-xs mt-6"
                    >
                        tap outside to close
                    </motion.p>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
