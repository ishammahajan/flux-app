import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

// Gravity-based visual styling
const gravityStyles = {
    'High': {
        border: 'border-red-500/40',
        glow: 'shadow-red-500/30',
        bg: 'from-red-950/20 to-transparent',
        indicator: '🔴'
    },
    'Standard': {
        border: 'border-amber-500/40',
        glow: 'shadow-amber-500/30',
        bg: 'from-amber-950/20 to-transparent',
        indicator: '🟡'
    },
    'Low': {
        border: 'border-green-500/40',
        glow: 'shadow-green-500/30',
        bg: 'from-green-950/20 to-transparent',
        indicator: '🟢'
    },
    'default': {
        border: 'border-white/10',
        glow: 'shadow-white/10',
        bg: 'from-white/5 to-transparent',
        indicator: ''
    }
};

export default function Card({ task, onSwipeRight, onSwipeLeft, onOpenDetails, style, isInteractive = true }) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-15, 15]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

    // Visual feedback for swipe direction
    const rightIndicator = useTransform(x, [0, 100], [0, 1]);
    const leftIndicator = useTransform(x, [-100, 0], [1, 0]);

    const gravity = gravityStyles[task.gravity_tag] || gravityStyles.default;

    const handleDragEnd = (event, info) => {
        if (!isInteractive) return;

        const threshold = 100;
        const velocity = info.velocity.x;

        // Use velocity for more responsive feel
        if (info.offset.x > threshold || velocity > 500) {
            // Animate off screen smoothly
            animate(x, 500, {
                type: "spring",
                stiffness: 300,
                damping: 30,
                onComplete: onSwipeRight
            });
        } else if (info.offset.x < -threshold || velocity < -500) {
            animate(x, -500, {
                type: "spring",
                stiffness: 300,
                damping: 30,
                onComplete: onSwipeLeft
            });
        } else {
            // Snap back with spring
            animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
        }
    };

    const handleTap = () => {
        if (isInteractive && onOpenDetails) {
            onOpenDetails(task);
        }
    };

    return (
        <motion.div
            style={{ x, rotate, opacity, ...style }}
            drag={isInteractive ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            onTap={handleTap}
            whileHover={isInteractive ? { scale: 1.02 } : {}}
            whileTap={isInteractive ? { scale: 0.98 } : {}}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`
                absolute w-72 sm:w-80 rounded-3xl shadow-2xl border-2 overflow-hidden
                flex flex-col items-center justify-center p-6 sm:p-8 text-center
                cursor-grab active:cursor-grabbing select-none
                bg-gradient-to-b from-stone to-stone/90
                ${gravity.border} ${gravity.glow}
                ${!isInteractive ? 'pointer-events-none' : ''}
            `}
        >
            {/* Gravity gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-b ${gravity.bg} pointer-events-none`} />

            {/* Swipe indicators */}
            {isInteractive && (
                <>
                    <motion.div
                        style={{ opacity: rightIndicator }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl"
                    >
                        ✓
                    </motion.div>
                    <motion.div
                        style={{ opacity: leftIndicator }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl"
                    >
                        ↩
                    </motion.div>
                </>
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-3">
                {/* Gravity indicator */}
                {gravity.indicator && (
                    <span className="text-lg opacity-60">{gravity.indicator}</span>
                )}

                {/* Task title */}
                <h2 className="text-xl sm:text-2xl font-semibold text-white leading-tight">
                    {task.title || task.content}
                </h2>

                {/* Brief description preview */}
                {task.description && (
                    <p className="text-white/50 text-sm text-center line-clamp-2 px-2">
                        {task.description}
                    </p>
                )}

                {/* Project tag */}
                {task.project_id && (
                    <span className="text-xs text-white/40 mt-2 px-3 py-1 bg-white/5 rounded-full">
                        {task.project_id}
                    </span>
                )}
            </div>

            {/* Tap hint */}
            {isInteractive && (
                <div className="absolute bottom-3 inset-x-0 text-center">
                    <span className="text-white/20 text-xs">tap for details</span>
                </div>
            )}
        </motion.div>
    );
}
