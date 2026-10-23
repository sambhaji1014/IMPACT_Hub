/**
 * ImpactHub - Auth API Routes
 * Single sign-on/sign-up ecosystem with cookie JWT, CSRF, Password reset,
 * email verification, account lockout, and admin allow-list promotion.
 */

const express = require('express');
const crypto = require('crypto');
const {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} = require('../validators');
const mailbox = require('../mailbox');
const { hashToken } = require('../auth');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

function createAuthRouter(prisma, authManager) {
  const router = express.Router();

  // 1. Sign Up (wrapped in transaction)
  router.post('/signup', async (req, res) => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          errors: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
          message: parsed.error.issues[0]?.message || 'Validation failed.'
        });
      }

      const { name, email, password, role, orgName, registrationNumber, website, city, cause } = parsed.data;
      const normalizedEmail = email.trim().toLowerCase();

      // Ensure admin cannot be passed via public sign-up
      if (role === 'admin' || req.body.role === 'admin') {
        return res.status(400).json({
          success: false,
          error: 'InvalidRole',
          message: 'The Administrator role cannot be chosen at registration.'
        });
      }

      // Check unique email case-insensitive
      const existing = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail } }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'EmailAlreadyExists',
          message: 'An account with this email address is already registered.'
        });
      }

      const passwordHash = await authManager.hashPassword(password);

      // Generate single-use email verification token expiring in 24 hours
      const rawVerificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenHash = hashToken(rawVerificationToken);
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Multi-step write wrapped in database transaction
      const user = await prisma.$transaction(async (tx) => {
        return tx.user.create({
          data: {
            name,
            email: normalizedEmail,
            passwordHash,
            role,
            baseRole: role,
            roles: JSON.stringify([role]),
            city: city || 'Pune, India',
            emailVerificationToken: rawVerificationToken,
            emailVerificationTokenHash: verificationTokenHash,
            emailVerificationExpires: verificationExpires,
            emailVerifiedAt: null, // Starts unverified
            volunteerProfile: role === 'volunteer' ? {
              create: { skills: 'Community Mobilization', totalHours: 0, points: 0, level: 'Bronze' }
            } : undefined,
            donorProfile: role === 'donor' ? {
              create: { totalDonated: 0, points: 0, tier: 'Supporter' }
            } : undefined,
            ngoProfile: role === 'ngo' ? {
              create: {
                orgName: orgName || `${name}'s Organization`,
                registrationNumber: registrationNumber || 'MH/REG/PENDING',
                website: website || null,
                description: cause ? `Initiative focused on ${cause}.` : `Community initiative founded by ${name}.`,
                cause: cause || 'Community Empowerment',
                city: city || 'Pune',
                verificationStatus: 'PENDING'
              }
            } : undefined
          },
          include: {
            ngoProfile: true,
            volunteerProfile: true,
            donorProfile: true
          }
        });
      });

      // Issue session cookies
      const accessToken = authManager.generateAccessToken(user);
      const refreshTokenData = await authManager.generateRefreshToken(user.id, false, req);
      authManager.setAuthCookies(res, accessToken, refreshTokenData);

      await authManager.logAudit({
        userId: user.id,
        action: 'SIGNUP',
        entity: 'User',
        entityId: user.id,
        details: { email: normalizedEmail, role },
        req
      });

      // Send Verification Email
      const verifyLink = `${BASE_URL}/api/v1/auth/verify-email?token=${rawVerificationToken}`;
      await mailbox.sendMail({
        to: user.email,
        subject: 'Verify Your ImpactHub Account',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #059669;">Welcome to ImpactHub, ${user.name}!</h2>
            <p>Your account has been created as a <strong>${role.toUpperCase()}</strong>. To participate in initiatives and verify your identity, please confirm your email address:</p>
            <p style="margin: 30px 0;">
              <a href="${verifyLink}" style="background: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
            </p>
            <p style="font-size: 0.85rem; color: #64748B;">Or copy and paste this link into your browser:<br>${verifyLink}</p>
            <p style="font-size: 0.8rem; color: #94A3B8;">This single-use link expires in 24 hours.</p>
          </div>
        `
      });

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        baseRole: user.baseRole,
        roles: [user.role],
        city: user.city,
        emailVerified: false,
        emailVerifiedAt: null
      };

      res.status(201).json({
        success: true,
        message: 'Account created successfully. Please check your email to verify your account.',
        user: safeUser,
        token: accessToken
      });
    } catch (err) {
      console.error('Signup Error:', err);
      res.status(500).json({ success: false, message: 'Signup failed due to internal error', error: err.message });
    }
  });

  // 2. Sign In
  router.post('/login', async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Valid email and password are required.'
        });
      }

      const { email, password, rememberMe } = parsed.data;
      const normalizedEmail = email.trim().toLowerCase();

      const user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail } },
        include: {
          ngoProfile: true,
          volunteerProfile: true,
          donorProfile: true
        }
      });

      // Generic error on missing user to prevent user enumeration
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'InvalidCredentials',
          message: 'Invalid email or password.'
        });
      }

      // Check account lockout
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingMinutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000)));
        return res.status(429).json({
          success: false,
          error: 'AccountLocked',
          message: `Too many attempts. Try again in ${remainingMinutes} minutes.`
        });
      }

      // Check account suspension
      if (user.isSuspended) {
        return res.status(403).json({
          success: false,
          error: 'AccountSuspended',
          message: `Your account has been suspended by an administrator. Reason: ${user.suspensionReason || 'Violation of terms.'}`
        });
      }

      const isMatch = await authManager.verifyPassword(password, user.passwordHash);

      if (!isMatch) {
        const newAttempts = (user.failedLoginAttempts || 0) + 1;
        const updates = { failedLoginAttempts: newAttempts };

        if (newAttempts >= 5) {
          updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-min lockout
        }

        await prisma.user.update({
          where: { id: user.id },
          data: updates
        });

        await authManager.logAudit({
          userId: user.id,
          action: 'LOGIN_FAILED',
          entity: 'User',
          entityId: user.id,
          details: { attempt: newAttempts, locked: newAttempts >= 5 },
          req
        });

        if (newAttempts >= 5) {
          return res.status(429).json({
            success: false,
            error: 'AccountLocked',
            message: 'Too many attempts. Try again in 15 minutes.'
          });
        }

        return res.status(401).json({
          success: false,
          error: 'InvalidCredentials',
          message: 'Invalid email or password.'
        });
      }

      // Password matches: Check email verification status
      if (!user.emailVerifiedAt) {
        const rawToken = user.emailVerificationToken;
        const devVerificationLink = rawToken ? `${BASE_URL}/api/v1/auth/verify-email?token=${rawToken}` : null;
        return res.status(403).json({
          success: false,
          error: 'EmailNotVerified',
          message: 'Please verify your email first. In development, click the dev mailbox or instant verify below.',
          email: user.email,
          canResend: true,
          devMailboxUrl: '/dev-mailbox',
          devVerificationLink: (process.env.NODE_ENV !== 'production') ? devVerificationLink : undefined
        });
      }

      // Login success: Reset failed attempts and lockout in DB
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });

      // Synchronize role dynamically (promotes verified allow-listed user or demotes removed user)
      const syncedUser = await authManager.syncUserRole(user);

      // Issue tokens
      const accessToken = authManager.generateAccessToken(syncedUser);
      const refreshTokenData = await authManager.generateRefreshToken(syncedUser.id, !!rememberMe, req);
      authManager.setAuthCookies(res, accessToken, refreshTokenData);

      await authManager.logAudit({
        userId: syncedUser.id,
        action: 'LOGIN_SUCCESS',
        entity: 'User',
        entityId: syncedUser.id,
        details: { role: syncedUser.role, rememberMe },
        req
      });

      const safeUser = {
        id: syncedUser.id,
        name: syncedUser.name,
        email: syncedUser.email,
        role: syncedUser.role,
        baseRole: syncedUser.baseRole,
        roles: [syncedUser.role],
        avatar: syncedUser.avatar,
        city: syncedUser.city,
        emailVerified: !!syncedUser.emailVerifiedAt,
        emailVerifiedAt: syncedUser.emailVerifiedAt,
        ngoProfile: syncedUser.ngoProfile,
        volunteerProfile: syncedUser.volunteerProfile,
        donorProfile: syncedUser.donorProfile
      };

      res.json({
        success: true,
        message: 'Signed in successfully.',
        user: safeUser,
        token: accessToken
      });
    } catch (err) {
      console.error('Login Error:', err);
      res.status(500).json({ success: false, message: 'Login failed due to internal error', error: err.message });
    }
  });

  // 3. Email Verification (hashes token for DB lookup)
  router.all('/verify-email', async (req, res) => {
    try {
      const token = (req.query.token || req.body?.token || '').trim();
      if (!token) {
        return res.status(400).json({ success: false, message: 'Verification token required.' });
      }

      const tokenHashed = hashToken(token);

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { emailVerificationTokenHash: tokenHashed },
            { emailVerificationToken: token }
          ],
          emailVerificationExpires: { gt: new Date() }
        }
      });

      const isBrowserHtml = req.headers['accept'] && req.headers['accept'].includes('text/html') && !req.headers['accept'].includes('application/json');

      if (!user) {
        if (isBrowserHtml) {
          return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Verification Failed</title><style>body{font-family:sans-serif;text-align:center;padding:50px;background:#F8FAFC;}</style></head>
            <body>
              <h2 style="color:#EF4444;">Verification Link Expired or Invalid</h2>
              <p>This verification link is invalid or has already been used.</p>
              <a href="/auth" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;">Go to Sign In</a>
            </body>
            </html>
          `);
        }
        return res.status(400).json({ success: false, message: 'Verification link expired or invalid.' });
      }

      // Mark verified and clear tokens
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: new Date(),
          emailVerificationToken: null,
          emailVerificationTokenHash: null,
          emailVerificationExpires: null
        }
      });

      user.emailVerifiedAt = new Date();
      // Role promotion evaluated upon verification
      const updatedUser = await authManager.syncUserRole(user);

      await authManager.logAudit({
        userId: user.id,
        action: 'EMAIL_VERIFIED',
        entity: 'User',
        entityId: user.id,
        details: { role: updatedUser.role },
        req
      });

      // Issue session tokens so verifying automatically authenticates the user
      const accessToken = authManager.generateAccessToken(updatedUser);
      const refreshData = await authManager.generateRefreshToken(updatedUser.id, true, req);
      authManager.setAuthCookies(res, accessToken, refreshData);

      if (isBrowserHtml) {
        return res.redirect('/dashboard?verified=true');
      }

      res.json({
        success: true,
        message: 'Email address verified successfully!',
        role: updatedUser.role,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role
        },
        token: accessToken
      });
    } catch (err) {
      console.error('Verify Email Error:', err);
      res.status(500).json({ success: false, message: 'Email verification failed.' });
    }
  });

  // 3b. Quick Verify for Development Testing
  router.post('/dev-quick-verify', async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ success: false, message: 'Only available in development.' });
      }
      const email = (req.body?.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email required.' });
      }

      const user = await prisma.user.findFirst({
        where: { email: { equals: email } }
      });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User account not found.' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: new Date(),
          emailVerificationToken: null,
          emailVerificationTokenHash: null,
          emailVerificationExpires: null
        }
      });

      user.emailVerifiedAt = new Date();
      const updatedUser = await authManager.syncUserRole(user);
      const accessToken = authManager.generateAccessToken(updatedUser);
      const refreshData = await authManager.generateRefreshToken(updatedUser.id, true, req);
      authManager.setAuthCookies(res, accessToken, refreshData);

      await authManager.logAudit({
        userId: user.id,
        action: 'EMAIL_VERIFIED_DEV',
        entity: 'User',
        entityId: user.id,
        details: { email, role: updatedUser.role },
        req
      });

      res.json({
        success: true,
        message: `Account for ${email} has been verified successfully!`,
        role: updatedUser.role,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role
        },
        token: accessToken
      });
    } catch (err) {
      console.error('Dev Quick Verify Error:', err);
      res.status(500).json({ success: false, message: 'Verification failed.' });
    }
  });

  // 4. Resend Verification Email (supports authenticated user OR explicit email)
  router.post('/resend-verification', async (req, res) => {
    try {
      let targetEmail = null;
      if (req.user && req.user.email) {
        targetEmail = req.user.email;
      } else if (req.body && req.body.email) {
        targetEmail = String(req.body.email).trim().toLowerCase();
      }

      if (!targetEmail) {
        return res.status(400).json({ success: false, message: 'Email address is required.' });
      }

      const user = await prisma.user.findFirst({
        where: { email: { equals: targetEmail } }
      });

      // Avoid enumeration: return generic message if user not found
      if (!user) {
        return res.json({
          success: true,
          message: 'If this email is registered and unverified, a new verification link has been dispatched.'
        });
      }

      if (user.emailVerifiedAt) {
        return res.json({
          success: true,
          message: 'Your email address is already verified. Please sign in.'
        });
      }

      // 60-second cooldown check
      if (user.emailVerificationExpires) {
        const timeSinceCreatedMs = (24 * 60 * 60 * 1000) - (user.emailVerificationExpires.getTime() - Date.now());
        if (timeSinceCreatedMs < 60000 && timeSinceCreatedMs > 0) {
          return res.status(429).json({
            success: false,
            message: 'Please wait at least 60 seconds before requesting another verification email.'
          });
        }
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: rawToken,
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpires: newExpires
        }
      });

      const verifyLink = `${BASE_URL}/api/v1/auth/verify-email?token=${rawToken}`;
      await mailbox.sendMail({
        to: user.email,
        subject: 'Verify Your ImpactHub Account',
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>ImpactHub Email Verification</h2>
            <p>You requested a new verification link. Click the button below to confirm your email:</p>
            <p><a href="${verifyLink}" style="background:#059669;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">Verify Email</a></p>
            <p style="font-size:0.85rem;color:#666;">Or link: ${verifyLink}</p>
          </div>
        `
      });

      res.json({
        success: true,
        message: 'Verification link resent. In development, find it in the Dev Mailbox.',
        devMailboxUrl: '/dev-mailbox',
        devVerificationLink: (process.env.NODE_ENV !== 'production') ? verifyLink : undefined
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to resend verification email.' });
    }
  });

  // 5. Forgot Password (hashes token at rest)
  router.post('/forgot-password', async (req, res) => {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Valid email required.' });
      }

      const { email } = parsed.data;
      const normalizedEmail = email.trim().toLowerCase();

      const user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail } }
      });

      // Avoid user enumeration: Always return generic success message
      if (!user) {
        return res.json({
          success: true,
          message: 'If this email is registered, password reset instructions have been dispatched.'
        });
      }

      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = hashToken(rawResetToken);
      const resetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30-min expiry

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: rawResetToken,
          passwordResetTokenHash: resetTokenHash,
          passwordResetExpires: resetExpires
        }
      });

      const resetLink = `${BASE_URL}/auth?tab=reset&token=${rawResetToken}`;
      await mailbox.sendMail({
        to: user.email,
        subject: 'Reset Your ImpactHub Password',
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #059669;">ImpactHub Password Reset</h2>
            <p>Hello ${user.name},</p>
            <p>A request was received to reset your password. Click below to choose a new password:</p>
            <p style="margin: 25px 0;">
              <a href="${resetLink}" style="background: #059669; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
            </p>
            <p style="font-size:0.85rem; color:#64748B;">This link is single-use and will expire in 30 minutes.<br>If you did not make this request, you can safely ignore this email.</p>
          </div>
        `
      });

      res.json({
        success: true,
        message: 'If this email is registered, password reset instructions have been dispatched.'
      });
    } catch (err) {
      console.error('Forgot Password Error:', err);
      res.status(500).json({ success: false, message: 'Failed to process password reset request.' });
    }
  });

  // 6. Reset Password (invalidates all active sessions and clears lockout)
  router.post('/reset-password', async (req, res) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: parsed.error.issues[0]?.message || 'Invalid password policy.'
        });
      }

      const { token, password } = parsed.data;
      const tokenHashed = hashToken(token);

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { passwordResetTokenHash: tokenHashed },
            { passwordResetToken: token }
          ],
          passwordResetExpires: { gt: new Date() }
        }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'InvalidToken',
          message: 'Password reset link is invalid or has expired.'
        });
      }

      const newHash = await authManager.hashPassword(password);

      // Update password, clear reset token, and reset failed attempts/lockout
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          passwordResetToken: null,
          passwordResetTokenHash: null,
          passwordResetExpires: null,
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });

      // Invalidate all active sessions for security
      await authManager.revokeAllUserRefreshTokens(user.id);
      authManager.clearAuthCookies(res);

      await authManager.logAudit({
        userId: user.id,
        action: 'PASSWORD_RESET',
        entity: 'User',
        entityId: user.id,
        req
      });

      res.json({
        success: true,
        message: 'Password has been reset successfully. Please sign in with your new credentials.'
      });
    } catch (err) {
      console.error('Reset Password Error:', err);
      res.status(500).json({ success: false, message: 'Failed to reset password.' });
    }
  });

  // 7. Sign Out
  router.all('/logout', async (req, res) => {
    try {
      const refreshToken = req.cookies?.ih_refresh_token;
      if (refreshToken) {
        await authManager.revokeRefreshToken(refreshToken);
      }
      authManager.clearAuthCookies(res);

      if (req.user) {
        await authManager.logAudit({
          userId: req.user.id,
          action: 'LOGOUT',
          entity: 'User',
          entityId: req.user.id,
          req
        });
      }

      if (req.method === 'GET' && req.accepts('html') && !req.xhr) {
        return res.redirect('/auth');
      }

      res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Logout failed.' });
    }
  });

  // 8. Current Session Profile (/api/v1/auth/me)
  router.get('/me', async (req, res) => {
    if (!req.user) {
      return res.json({ success: false, user: null });
    }

    // Role synchronization on request
    const syncedUser = await authManager.syncUserRole(req.user);

    const safeUser = {
      id: syncedUser.id,
      name: syncedUser.name,
      email: syncedUser.email,
      role: syncedUser.role,
      baseRole: syncedUser.baseRole,
      roles: [syncedUser.role],
      avatar: syncedUser.avatar,
      city: syncedUser.city,
      bio: syncedUser.bio,
      emailVerified: !!syncedUser.emailVerifiedAt,
      emailVerifiedAt: syncedUser.emailVerifiedAt,
      isSuspended: syncedUser.isSuspended,
      ngoProfile: syncedUser.ngoProfile,
      volunteerProfile: syncedUser.volunteerProfile,
      donorProfile: syncedUser.donorProfile
    };

    res.json({ success: true, user: safeUser });
  });

  return router;
}

module.exports = createAuthRouter;

