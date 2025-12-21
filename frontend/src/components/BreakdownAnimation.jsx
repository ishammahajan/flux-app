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

    useEffect(() => {
        if (isBreaking && shards.length > 0) {
            // Start the breakdown animation sequence if not already showing shards
            if (phase === 'idle') {
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
            }
        } else if (!isBreaking) {
            setPhase('idle');
        } else if (shards.length === 0 && phase === 'shards') {
            // All shards gone
            if (onBreakdownComplete) {
                onBreakdownComplete();
            }
        }
    }, [isBreaking, shards.length]);


    const handleShardComplete = (shard) => {
        if (onShardComplete) {
            onShardComplete(shard);
        }
    };

    const handleShardDefer = (shard) => {
        if (onShardDefer) {
            onShardDefer(shard);
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
                style={{ zIndex: 60 }} // Above cards
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
                {phase === 'shards' && shards.length > 0 && (
                    <div className="relative flex flex-col items-center">
                        {/* Shard counter */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-white/60 text-sm mb-4"
                        >
                            {shards.length} shards remaining
                        </motion.div>

                        {/* Shard stack - centered container */}
                        <div className="relative flex items-center justify-center" style={{ height: '450px', width: '300px' }}>
                            <AnimatePresence mode="popLayout">
                                {shards.slice(0, 3).reverse().map((shard, i) => {
                                    // Calculate actual index based on reverse slice (0 is top)
                                    // slice(0,3) reversed order: [2, 1, 0] visually, but data is [0, 1, 2]
                                    // We need to map visual stacking context
                                    const index = shards.indexOf(shard);
                                    const isTop = index === 0;

                                    return (
                                        <ShardCard
                                            key={shard.id}
                                            shard={shard}
                                            index={index}
                                            total={shards.length}
                                            isActive={isTop}
                                            onComplete={() => handleShardComplete(shard)}
                                            onDefer={() => handleShardDefer(shard)}
                                        />
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
