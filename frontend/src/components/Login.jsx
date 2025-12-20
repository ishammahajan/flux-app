import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Login - Email OTP Authentication Flow
 * Minimal, atmospheric, no-demand feel
 */
export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState('email'); // 'email' | 'code'
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleRequestOTP = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setLoading(true);

        try {
            const response = await fetch('/api/auth/request-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send code');
            }

            setMessage('Check your email for the login code');
            setStep('code');

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Verification failed');
            }

            localStorage.setItem('flux_user', JSON.stringify(data.user));
            onLogin(data.user);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setStep('email');
        setCode('');
        setError(null);
        setMessage(null);
    };

    return (
        <div className="h-screen w-screen bg-void flex items-center justify-center p-4 sm:p-8 overflow-hidden">
            {/* Ambient background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-void via-[#0a0a0f] to-void" />
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-sm relative z-10"
            >
                {/* Logo */}
                <div className="text-center mb-10 sm:mb-12">
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl sm:text-6xl font-light text-white tracking-wide"
                    >
                        FLUX
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-white/30 text-sm mt-2"
                    >
                        Task flow for divergent minds
                    </motion.p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 'email' ? (
                        /* Email Step */
                        <motion.form
                            key="email-form"
                            onSubmit={handleRequestOTP}
                            className="space-y-4"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email"
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 transition-colors"
                                autoFocus
                                autoComplete="email"
                            />

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-400/80 text-sm text-center py-2"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <motion.button
                                type="submit"
                                disabled={loading || !email}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full bg-white/10 hover:bg-white/15 text-white py-4 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <motion.span
                                        animate={{ opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    >
                                        sending...
                                    </motion.span>
                                ) : (
                                    'send code'
                                )}
                            </motion.button>
                        </motion.form>
                    ) : (
                        /* Code Verification Step */
                        <motion.form
                            key="code-form"
                            onSubmit={handleVerifyOTP}
                            className="space-y-4"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {message && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-white/50 text-sm text-center py-2"
                                >
                                    {message}
                                </motion.div>
                            )}

                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="6-digit code"
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 transition-colors text-center text-2xl tracking-[0.5em] font-mono"
                                autoFocus
                                inputMode="numeric"
                                maxLength={6}
                            />

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-400/80 text-sm text-center py-2"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <motion.button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full bg-white/10 hover:bg-white/15 text-white py-4 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <motion.span
                                        animate={{ opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    >
                                        verifying...
                                    </motion.span>
                                ) : (
                                    'verify'
                                )}
                            </motion.button>

                            <button
                                type="button"
                                onClick={handleBack}
                                className="w-full text-white/30 hover:text-white/50 text-sm py-2 transition-colors"
                            >
                                use a different email
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
