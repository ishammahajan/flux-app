import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import ShardCard from './ShardCard';

/**
 * BreakdownAnimation - Orchestrates the visual "shatter" effect
 * Shows parent card cracking/exploding into shard cards
 */

export default function BreakdownAnimation({
    parentTask,
    shards,
    isBreaking,
    onShardComplete,
    onShardDefer,
    onBreakdownComplete,
    onCancel
}) {
    const [phase, setPhase] = useState('idle'); // idle | cracking | exploding | shards
    const [activeShardIndex, setActiveShardIndex] = useState(0);

    useEffect(() => {
        if (isBreaking && shards.length > 0) {
            // Start the breakdown animation sequence
            setPhase('cracking');

            const crackTimer = setTimeout(() => {
                setPhase('exploding');
            }, 300);

            const shardTimer = setTimeout(() => {
                setPhase('shards');
            }, 600);

            return () => {
                clearTimeout(crackTimer);
                clearTimeout(shardTimer);
            };
        } else if (!isBreaking) {
            setPhase('idle');
            setActiveShardIndex(0);
        }
    }, [isBreaking, shards.length]);

    const handleShardComplete = (shard) => {
        if (onShardComplete) {
            onShardComplete(shard);
        }

        // Move to next shard
        if (activeShardIndex < shards.length - 1) {
            setActiveShardIndex(prev => prev + 1);
        } else {
            // All shards complete
            if (onBreakdownComplete) {
                onBreakdownComplete();
            }
        }
    };

    const handleShardDefer = (shard) => {
        if (onShardDefer) {
            onShardDefer(shard);
        }
        // Move shard to end or skip
        if (activeShardIndex < shards.length - 1) {
            setActiveShardIndex(prev => prev + 1);
        }
    };

    // Parent card animation variants
    const parentVariants = {
        normal: {
            scale: 1,
            rotate: 0,
            filter: 'brightness(1)'
        },
        cracking: {
            scale: 1.05,
            filter: 'brightness(1.5)',
            transition: { duration: 0.2 }
        },
        exploding: {
            scale: 0,
            rotate: 15,
            opacity: 0,
            filter: 'brightness(2)',
            transition: {
                type: 'spring',
                stiffness: 400,
                damping: 20,
                duration: 0.3
            }
        }
    };

    if (!isBreaking && phase === 'idle') {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            {/* Cancel button */}
            <button
                onClick={onCancel}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white/80 transition-colors"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Parent task being broken down (shows during cracking/exploding phases) */}
            <AnimatePresence>
                {(phase === 'cracking' || phase === 'exploding') && (
                    <motion.div
                        key="parent"
                        variants={parentVariants}
                        initial="normal"
                        animate={phase}
                        exit="exploding"
                        className={`
                            absolute w-72 sm:w-80 rounded-3xl shadow-2xl border-2 overflow-hidden
                            flex flex-col items-center justify-center p-6 sm:p-8 text-center
                            bg-gradient-to-b from-stone to-stone/90
                            border-white/20
                        `}
                    >
                        {/* Crack overlay effect */}
                        {phase === 'cracking' && (
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                    backgroundImage: `
                                        linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 31%, transparent 32%),
                                        linear-gradient(-60deg, transparent 50%, rgba(255,255,255,0.2) 51%, transparent 52%),
                                        linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.25) 41%, transparent 42%)
                                    `
                                }}
                            />
                        )}

                        <h2 className="text-xl sm:text-2xl font-semibold text-white leading-tight">
                            {parentTask?.title || parentTask?.content}
                        </h2>

                        <p className="text-white/40 text-sm mt-2">
                            Breaking down...
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Shards stack (shows after parent explodes) */}
            <AnimatePresence>
                {phase === 'shards' && (
                    <div className="relative flex flex-col items-center">
                        {/* Active shard indicator */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-white/60 text-sm mb-4"
                        >
                            Shard {activeShardIndex + 1} of {shards.length}
                        </motion.div>

                        {/* Shard stack - centered container */}
                        <div className="relative flex items-center justify-center" style={{ height: '280px', width: '300px' }}>
                            {shards.map((shard, index) => (
                                <ShardCard
                                    key={shard.id || index}
                                    shard={shard}
                                    index={index}
                                    total={shards.length}
                                    isActive={index === activeShardIndex}
                                    onComplete={handleShardComplete}
                                    onDefer={handleShardDefer}
                                />
                            ))}
                        </div>

                        {/* Progress dots */}
                        <div className="flex gap-2 mt-4">
                            {shards.map((_, index) => (
                                <motion.div
                                    key={index}
                                    className={`
                                        w-2 h-2 rounded-full
                                        ${index < activeShardIndex ? 'bg-green-500' :
                                            index === activeShardIndex ? 'bg-white' : 'bg-white/30'}
                                    `}
                                    animate={{
                                        scale: index === activeShardIndex ? 1.2 : 1
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
