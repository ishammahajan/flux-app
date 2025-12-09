import { motion, AnimatePresence } from 'framer-motion';

/**
 * ProcessingStatus - Global processing indicator banner
 * Shows during audio processing, magic breakdown, etc.
 */
export default function ProcessingStatus({ status, type }) {
    if (!status) return null;

    const configs = {
        audio: {
            recording: { text: 'Listening...', color: 'red', icon: '🎙️', pulse: true },
            transcribing: { text: 'Transcribing audio...', color: 'amber', icon: '📝', pulse: true },
            analyzing: { text: 'Understanding task...', color: 'purple', icon: '🧠', pulse: true },
            saving: { text: 'Saving task...', color: 'green', icon: '💾', pulse: false },
            done: { text: 'Task captured!', color: 'green', icon: '✓', pulse: false },
            error: { text: 'Processing failed', color: 'red', icon: '✕', pulse: false },
        },
        breakdown: {
            analyzing: { text: 'Breaking down task...', color: 'purple', icon: '🔮', pulse: true },
            creating: { text: 'Creating sub-tasks...', color: 'amber', icon: '✨', pulse: true },
            done: { text: 'Breakdown complete!', color: 'green', icon: '✓', pulse: false },
            error: { text: 'Breakdown failed', color: 'red', icon: '✕', pulse: false },
        },
    };

    const config = configs[type]?.[status] || { text: 'Processing...', color: 'amber', icon: '⏳', pulse: true };

    const colorClasses = {
        red: 'bg-red-500/20 border-red-500/40 text-red-300',
        amber: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
        purple: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
        green: 'bg-green-500/20 border-green-500/40 text-green-300',
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`
                    fixed top-4 left-1/2 -translate-x-1/2 z-50
                    px-6 py-3 rounded-full border backdrop-blur-md
                    flex items-center gap-3
                    ${colorClasses[config.color]}
                `}
            >
                {/* Icon */}
                <span className={`text-lg ${config.pulse ? 'animate-pulse' : ''}`}>
                    {config.icon}
                </span>

                {/* Text */}
                <span className="font-medium text-sm">
                    {config.text}
                </span>

                {/* Spinner for active states */}
                {config.pulse && (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full"
                    />
                )}
            </motion.div>
        </AnimatePresence>
    );
}
