/**
 * OTP Service - Email OTP authentication using Resend
 */
const { Resend } = require('resend');
const crypto = require('crypto');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// OTP Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;

/**
 * Generate a random 6-digit OTP
 */
function generateOTP() {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < OTP_LENGTH; i++) {
        otp += digits[crypto.randomInt(0, digits.length)];
    }
    return otp;
}

/**
 * Check if email is in the allowed users list
 */
function isEmailAllowed(email) {
    const allowedUsers = (process.env.ALLOWED_USERS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);

    return allowedUsers.includes(email.toLowerCase());
}

/**
 * Send OTP email via Resend
 */
async function sendOTPEmail(email, otp) {
    const from = process.env.RESEND_FROM || 'FLUX <onboarding@resend.dev>';

    const { data, error } = await resend.emails.send({
        from,
        to: email,
        subject: 'Your FLUX Login Code',
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #1a1a2e; font-size: 32px; font-weight: 300; margin: 0 0 24px 0; letter-spacing: 2px;">FLUX</h1>
                <p style="color: #666; font-size: 16px; margin: 0 0 24px 0;">Your login code is:</p>
                <div style="background: #1a1a2e; color: white; font-size: 32px; letter-spacing: 8px; padding: 20px 24px; border-radius: 12px; text-align: center; font-family: monospace;">
                    ${otp}
                </div>
                <p style="color: #999; font-size: 14px; margin: 24px 0 0 0;">This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
            </div>
        `,
        text: `Your FLUX login code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.`
    });

    if (error) {
        console.error('[OTP Service] Email send error:', error);
        throw new Error('Failed to send OTP email');
    }

    console.log(`[OTP Service] OTP email sent to ${email}, id: ${data?.id}`);
    return data;
}

/**
 * Create and store OTP in database
 */
async function createOTP(email, db) {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    // Delete any existing OTPs for this email
    await new Promise((resolve, reject) => {
        db.run('DELETE FROM otp_codes WHERE email = ?', [email.toLowerCase()], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    // Insert new OTP
    await new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO otp_codes (email, code, expires_at, created_at) VALUES (?, ?, ?, ?)',
            [email.toLowerCase(), otp, expiresAt, createdAt],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });

    return otp;
}

/**
 * Verify OTP from database
 */
async function verifyOTP(email, code, db) {
    const record = await new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM otp_codes WHERE email = ? AND code = ?',
            [email.toLowerCase(), code],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });

    if (!record) {
        return { valid: false, error: 'Invalid code' };
    }

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
        // Clean up expired code
        db.run('DELETE FROM otp_codes WHERE id = ?', [record.id]);
        return { valid: false, error: 'Code expired' };
    }

    // Delete used OTP
    await new Promise((resolve, reject) => {
        db.run('DELETE FROM otp_codes WHERE id = ?', [record.id], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    return { valid: true };
}

/**
 * Check rate limiting - max 3 requests per email per 15 minutes
 */
async function checkRateLimit(email, db) {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const count = await new Promise((resolve, reject) => {
        db.get(
            'SELECT COUNT(*) as count FROM otp_codes WHERE email = ? AND created_at > ?',
            [email.toLowerCase(), fifteenMinutesAgo],
            (err, row) => {
                if (err) reject(err);
                else resolve(row?.count || 0);
            }
        );
    });

    return count < 3;
}

module.exports = {
    generateOTP,
    isEmailAllowed,
    sendOTPEmail,
    createOTP,
    verifyOTP,
    checkRateLimit,
    OTP_EXPIRY_MINUTES
};
