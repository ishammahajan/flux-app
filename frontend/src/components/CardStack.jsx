import { AnimatePresence, motion } from 'framer-motion';
import Card from './Card';

export default function CardStack({ tasks, onComplete, onDefer, onOpenDetails }) {
    const activeTask = tasks[0];
    const nextTask = tasks[1];
    const thirdTask = tasks[2];

    if (!activeTask) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                {/* Empty state - inviting, not demanding */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-6 text-center"
                >
                    <div className="w-24 h-24 rounded-full bg-gradient-to-b from-white/5 to-transparent border border-white/10 flex items-center justify-center">
                        <span className="text-4xl opacity-30">∅</span>
                    </div>
                    <div className="space-y-2">
                        <p className="text-white/40 text-lg">Clear waters</p>
                        <p className="text-white/20 text-sm">Calibrate gravity to surface tasks</p>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* Stack container */}
            <div className="relative w-72 sm:w-80 h-[28rem] sm:h-[26rem]">
                <AnimatePresence mode="popLayout">
                    {/* Third Card (Bottom of visible stack) */}
                    {thirdTask && (
                        <motion.div
                            key={`stack-${thirdTask.id}`}
                            initial={{ scale: 0.85, y: 50, opacity: 0 }}
                            animate={{ scale: 0.85, y: 50, opacity: 0.3 }}
                            exit={{ scale: 0.8, y: 60, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ filter: 'blur(2px)' }}
                        >
                            <Card
                                task={thirdTask}
                                isInteractive={false}
                                style={{ position: 'relative' }}
                            />
                        </motion.div>
                    )}

                    {/* Second Card (Middle) */}
                    {nextTask && (
                        <motion.div
                            key={`stack-${nextTask.id}`}
                            initial={{ scale: 0.9, y: 30, opacity: 0.5 }}
                            animate={{ scale: 0.92, y: 28, opacity: 0.5 }}
                            exit={{ scale: 0.85, y: 40, opacity: 0.3 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ filter: 'blur(1px)' }}
                        >
                            <Card
                                task={nextTask}
                                isInteractive={false}
                                style={{ position: 'relative' }}
                            />
                        </motion.div>
                    )}

                    {/* Top Card (Active - Interactive) */}
                    <motion.div
                        key={`active-${activeTask.id}`}
                        initial={{ scale: 0.95, y: 20, opacity: 0.7 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <Card
                            task={activeTask}
                            onSwipeRight={() => onComplete(activeTask.id)}
                            onSwipeLeft={() => onDefer(activeTask.id)}
                            onOpenDetails={onOpenDetails}
                            style={{ position: 'relative' }}
                        />
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Subtle visual indicator of remaining tasks */}
            {tasks.length > 1 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5"
                >
                    {tasks.slice(0, 5).map((_, i) => (
                        <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-white/40' : 'bg-white/15'}`}
                        />
                    ))}
                    {tasks.length > 5 && (
                        <span className="text-white/20 text-xs ml-1">+{tasks.length - 5}</span>
                    )}
                </motion.div>
            )}
        </div>
    );
}
