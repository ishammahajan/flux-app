import { motion } from 'framer-motion';

/**
 * ShardCard - Smaller, visually distinct card for decomposed sub-tasks
 * Shows shard order badge, inherits parent's project, has crystalline styling
 */

// Gravity-based visual styling (same as Card.jsx but with shard modifications)
const gravityStyles = {
    'High': {
        border: 'border-red-400/50',
        glow: 'shadow-red-400/20',
        bg: 'from-red-900/30 to-transparent',
        indicator: '🔴'
    },
    'Standard': {
        border: 'border-amber-400/50',
        glow: 'shadow-amber-400/20',
        bg: 'from-amber-900/30 to-transparent',
        indicator: '🟡'
    },
    'Low': {
        border: 'border-green-400/50',
        glow: 'shadow-green-400/20',
        bg: 'from-green-900/30 to-transparent',
        indicator: '🟢'
    },
    'default': {
        border: 'border-white/10',
        glow: 'shadow-white/5',
        bg: 'from-white/5 to-transparent',
        indicator: ''
    }
};

export default function ShardCard({
    shard,
    index,
    total,
    onComplete,
    onDefer,
    isActive = false
}) {
    const gravity = gravityStyles[shard.gravity_tag] || gravityStyles.default;

    const handleSwipeComplete = () => {
        if (onComplete) onComplete(shard);
    };

    const handleSwipeDefer = () => {
        if (onDefer) onDefer(shard);
    };

    return (
        <motion.div
            initial={{ scale: 0, rotate: -10, opacity: 0 }}
            animate={{
                scale: isActive ? 1 : 0.85 - (index * 0.03),
                rotate: 0,
                opacity: isActive ? 1 : 0.4,
                y: isActive ? 0 : (index - (total > 3 ? 1 : 0)) * 12,
                zIndex: total - index
            }}
            exit={{ scale: 0, opacity: 0, x: 300 }}
            transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
                delay: isActive ? 0 : index * 0.05
            }}
            drag={isActive ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(e, info) => {
                if (info.offset.x > 100) handleSwipeComplete();
                else if (info.offset.x < -100) handleSwipeDefer();
            }}
            whileHover={isActive ? { scale: 1.02 } : {}}
            whileTap={isActive ? { scale: 0.98 } : {}}
            className={`
                absolute left-1/2 -translate-x-1/2
                w-64 sm:w-72 min-h-[180px] rounded-2xl shadow-xl border-2 overflow-hidden
                flex flex-col items-center justify-center p-5 sm:p-6 text-center
                cursor-grab active:cursor-grabbing select-none
                bg-stone
                ${gravity.border} ${gravity.glow}
                ${!isActive ? 'pointer-events-none' : ''}
            `}
        >
            {/* Crystalline/shard texture overlay */}
            <div
                className={`
                    absolute inset-0 bg-gradient-to-br ${gravity.bg}
                    pointer-events-none
                `}
                style={{
                    backgroundImage: `
                        linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%),
                        linear-gradient(225deg, transparent 40%, rgba(255,255,255,0.02) 50%, transparent 60%)
                    `
                }}
            />

            {/* Shard order badge */}
            <div className="absolute top-2 right-2 flex items-center gap-1">
                <span className="text-xs text-white/40 font-mono bg-white/5 px-2 py-0.5 rounded-full">
                    {index + 1}/{total}
                </span>
            </div>

            {/* Gravity indicator */}
            {gravity.indicator && (
                <span className="text-sm opacity-50 mb-1">{gravity.indicator}</span>
            )}

            {/* Shard title */}
            <h3 className="text-base sm:text-lg font-medium text-white leading-tight mb-1">
                {shard.title}
            </h3>

            {/* Brief description */}
            {shard.description && (
                <p className="text-white/40 text-xs text-center line-clamp-2 px-2">
                    {shard.description}
                </p>
            )}

            {/* Time estimate if available */}
            {shard.estimated_minutes && (
                <span className="text-xs text-white/30 mt-2">
                    ~{shard.estimated_minutes} min
                </span>
            )}

            {/* Active indicator */}
            {isActive && (
                <div className="absolute bottom-2 inset-x-0 flex justify-center gap-2">
                    <span className="text-white/20 text-xs">← defer</span>
                    <span className="text-white/20 text-xs">|</span>
                    <span className="text-white/20 text-xs">done →</span>
                </div>
            )}
        </motion.div>
    );
}
