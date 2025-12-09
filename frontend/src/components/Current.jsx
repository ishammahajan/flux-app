import CardStack from './CardStack';
import { motion } from 'framer-motion';

/**
 * Current - The monotropic execution view
 * "Stack of Cards" metaphor for screen-native task focus
 */
export default function Current({ tasks, onComplete, onDefer, onBreakdown, onOpenDetails }) {
    return (
        <div className="flex flex-col items-center justify-center h-full relative overflow-hidden bg-void pointer-events-none">
            {/* Ambient Background - subtle gradient */}
            <div className="absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-b from-void via-[#0f0f18] to-void" />
                {/* Subtle ambient glow */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.01] rounded-full blur-3xl" />
            </div>

            {/* The Stack - centered, enable pointer events only for cards */}
            <div className="relative z-10 w-full h-full pointer-events-auto">
                <CardStack
                    tasks={tasks}
                    onComplete={onComplete}
                    onDefer={onDefer}
                    onOpenDetails={onOpenDetails}
                    onLongPress={onBreakdown}
                />
            </div>
        </div>
    );
}
