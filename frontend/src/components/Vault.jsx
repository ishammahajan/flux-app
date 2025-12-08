import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Vault Component - The "Black Hole" Audio Capture
 * Pulsing dark circle that absorbs tasks via voice
 */
export default function Vault({ onCapture, userId }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const streamRef = useRef(null);

    const startRecording = useCallback(async () => {
        try {
            setStatus('recording');

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                streamRef.current?.getTracks().forEach(track => track.stop());
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                await processAudio(audioBlob);
            };

            mediaRecorder.start(100);
            setIsRecording(true);

        } catch (err) {
            console.error('Error starting recording:', err);
            setStatus('error');
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    const processAudio = async (audioBlob) => {
        setIsProcessing(true);
        setStatus('processing');

        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            formData.append('user_id', userId || 'ishamm');

            const response = await fetch('/api/audio/process', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to process audio');
            }

            // Success animation
            setShowSuccess(true);
            setStatus('done');

            if (onCapture) {
                onCapture(data.task, data.transcript);
            }

            setTimeout(() => {
                setShowSuccess(false);
                setStatus(null);
                setIsProcessing(false);
            }, 1500);

        } catch (err) {
            console.error('Error processing audio:', err);
            setStatus('error');
            setTimeout(() => {
                setStatus(null);
                setIsProcessing(false);
            }, 2000);
        }
    };

    const handleClick = () => {
        if (isProcessing) return;
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <div className="relative flex flex-col items-center">
            {/* Status text - minimal */}
            <AnimatePresence>
                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`
                            absolute -top-8 text-xs px-3 py-1 rounded-full backdrop-blur-sm
                            ${status === 'error' ? 'text-red-300 bg-red-500/20' :
                                status === 'done' ? 'text-green-300 bg-green-500/20' :
                                    'text-white/50 bg-white/5'}
                        `}
                    >
                        {status === 'recording' ? 'listening...' :
                            status === 'processing' ? 'absorbing...' :
                                status === 'done' ? 'captured' :
                                    status === 'error' ? 'failed' : ''}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* The Black Hole Button */}
            <motion.button
                onClick={handleClick}
                disabled={isProcessing && !isRecording}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full focus:outline-none disabled:cursor-wait"
                aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
                {/* Outer glow ring - always pulsing subtly */}
                <motion.div
                    animate={{
                        scale: isRecording ? [1, 1.3, 1] : [1, 1.1, 1],
                        opacity: isRecording ? [0.6, 0.2, 0.6] : [0.2, 0.1, 0.2]
                    }}
                    transition={{
                        duration: isRecording ? 1 : 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className={`
                        absolute inset-0 rounded-full
                        ${isRecording ? 'bg-red-500' : showSuccess ? 'bg-green-500' : 'bg-white/20'}
                    `}
                />

                {/* Inner circle - the "black hole" */}
                <motion.div
                    animate={{
                        scale: showSuccess ? [1, 0.8, 1] : 1
                    }}
                    className={`
                        absolute inset-2 rounded-full flex items-center justify-center
                        transition-colors duration-300
                        ${isRecording ? 'bg-red-600' :
                            isProcessing ? 'bg-stone' :
                                showSuccess ? 'bg-green-600' :
                                    'bg-gradient-to-b from-stone to-void border border-white/10'}
                    `}
                >
                    {isRecording ? (
                        // Stop icon
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-5 h-5 bg-white rounded-sm"
                        />
                    ) : isProcessing ? (
                        // Spinner
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full"
                        />
                    ) : showSuccess ? (
                        // Checkmark
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-white text-lg"
                        >
                            ✓
                        </motion.span>
                    ) : (
                        // Mic icon
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-white/70">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                        </svg>
                    )}
                </motion.div>
            </motion.button>
        </div>
    );
}
