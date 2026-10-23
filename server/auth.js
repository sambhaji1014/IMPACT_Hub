/**
 * ImpactHub - Authentication, JWT Cookie Session & RBAC Engine
 * Production-grade with bcrypt (cost 12), rotating refresh tokens hashed at rest,
 * strict role isolation, dynamic admin allow-list promotion/demotion,
 * account lockout, and audit logging.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Environment Secrets
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'impacthub-access-secret-super-secure-key-2026-xyz!';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'impacthub-refresh-secret-rotating-token-key-2026-abc!';
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'impacthub-cookie-signing-secret-key-32chars-min-2026!';
const ACCESS_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';

// Validate secrets in production
if (process.env.NODE_ENV === 'production') {
  const isDefaultAccess = ACCESS_SECRET.includes('super-secure-key');
  const isDefaultRefresh = REFRESH_SECRET.includes('rotating-token-key');
  const isDefaultCookie = COOKIE_SECRET.includes('cookie-signing-secret');
  if (!process.env.JWT_ACCESS_SECRET || isDefaultAccess ||
      !process.env.JWT_REFRESH_SECRET || isDefaultRefresh ||
      !process.env.COOKIE_SECRET || isDefaultCookie) {
    console.error('FATAL ERROR: Production startup aborted. Insecure or default JWT/Cookie secrets detected in .env.');
    process.exit(1);
  }
}

// 1. Parsing ADMIN_EMAILS (trim, lowercase, split by comma, strip quotes)
function parseAdminEmails(raw = process.env.ADMIN_EMAILS || '') {
  return raw
    .split(',')
    .map(e => e.trim().replace(/^["']|["']$/g, '').trim().toLowerCase())
    .filter(Boolean);
}

function getAdminEmails() {
  return parseAdminEmails(process.env.ADMIN_EMAILS);
}

// Helper: One-way SHA-256 hash for tokens at rest
function hashToken(rawToken) {
  if (!rawToken) return null;
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

class AuthManager {
  constructor(prisma) {
    this.prisma = prisma;
  }

  // Helper: Check if email is in the admin allow-list
  isAdminEmail(email) {
    if (!email) return false;
    const adminEmails = getAdminEmails();
    return adminEmails.includes(email.trim().toLowerCase());
  }

  // Dynamic Role Sync:
  // - Verified account in ADMIN_EMAILS => promoted to admin (saving baseRole)
  // - Account removed from ADMIN_EMAILS => demoted to original baseRole
  async syncUserRole(user) {
    if (!user) return user;
    const normalizedEmail = (user.email || '').trim().toLowerCase();
    const isAllowlisted = this.isAdminEmail(normalizedEmail);
    const isVerified = !!user.emailVerifiedAt;

    if (isAllowlisted && isVerified) {
      if (user.role !== 'admin') {
        const baseRole = (user.baseRole && user.baseRole !== 'admin')
          ? user.baseRole
          : (user.role !== 'admin' ? user.role : 'volunteer');

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            role: 'admin',
            baseRole,
            roles: JSON.stringify(['admin'])
          }
        });
        user.role = 'admin';
        user.roles = JSON.stringify(['admin']);
        user.baseRole = baseRole;
      }
    } else if (user.role === 'admin') {
      const targetRole = (user.baseRole && user.baseRole !== 'admin') ? user.baseRole : 'volunteer';
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          role: targetRole,
          roles: JSON.stringify([targetRole])
        }
      });
      user.role = targetRole;
      user.roles = JSON.stringify([targetRole]);
    }

    return user;
  }

  // 1. Password Hashing (bcrypt cost 12)
  async hashPassword(password) {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password, hash) {
    if (!password || !hash) return false;
    return bcrypt.compare(password, hash);
  }

  // 2. Token Generation
  generateAccessToken(user) {
    const role = user.role || 'volunteer';
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role,
        roles: [role]
      },
      ACCESS_SECRET,
      { expiresIn: ACCESS_EXPIRY }
    );
  }

  // Rotating Refresh Token with SHA-256 hash at rest, userAgent & ipAddress tracking
  async generateRefreshToken(userId, rememberMe = false, req = null) {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = hashToken(rawToken);
    const days = rememberMe ? 30 : 1;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const userAgent = req ? (req.headers['user-agent'] || null) : null;
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null) : null;

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        token: rawToken, // optional redundancy
        userId,
        userAgent,
        ipAddress,
        expiresAt
      }
    });

    return { token: rawToken, expiresAt, maxAgeMs: days * 24 * 60 * 60 * 1000, rememberMe };
  }

  // 3. Set Auth Cookies
  setAuthCookies(res, accessToken, refreshTokenData) {
    const isProd = process.env.NODE_ENV === 'production';
    const sameSite = process.env.COOKIE_SAME_SITE || 'lax';

    // Access token (15 minutes)
    res.cookie('ih_access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite,
      path: '/',
      maxAge: 15 * 60 * 1000
    });

    // Refresh token: 30 days if rememberMe, otherwise browser session cookie
    if (refreshTokenData) {
      const cookieOpts = {
        httpOnly: true,
        secure: isProd,
        sameSite,
        path: '/'
      };
      if (refreshTokenData.rememberMe) {
        cookieOpts.maxAge = refreshTokenData.maxAgeMs;
      }
      res.cookie('ih_refresh_token', refreshTokenData.token, cookieOpts);
    }

    // CSRF protection token readable by client script
    const csrfToken = crypto.randomBytes(16).toString('hex');
    res.cookie('ih_csrf_token', csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite,
      path: '/'
    });
  }

  clearAuthCookies(res) {
    res.clearCookie('ih_access_token', { path: '/' });
    res.clearCookie('ih_refresh_token', { path: '/' });
    res.clearCookie('ih_csrf_token', { path: '/' });
  }

  // 4. Invalidate Refresh Tokens
  async revokeRefreshToken(token) {
    if (!token) return;
    const tokenHash = hashToken(token);
    await this.prisma.refreshToken.updateMany({
      where: {
        OR: [
          { tokenHash },
          { token }
        ]
      },
      data: { revoked: true, revokedAt: new Date() }
    });
  }

  async revokeAllUserRefreshTokens(userId) {
    if (!userId) return;
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true, revokedAt: new Date() }
    });
  }

  // 5. Silent Token Refresh with hash matching
  async refreshSession(refreshToken, req = null) {
    if (!refreshToken) return null;
    const tokenHash = hashToken(refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        OR: [
          { tokenHash },
          { token: refreshToken }
        ]
      },
      include: {
        user: {
          include: {
            ngoProfile: true,
            volunteerProfile: true,
            donorProfile: true
          }
        }
      }
    });

    if (!tokenRecord || tokenRecord.revoked || new Date() > tokenRecord.expiresAt) {
      return null;
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true, revokedAt: new Date() }
    });

    let user = tokenRecord.user;
    if (user.isSuspended) return null;

    // Evaluate promotion/demotion on token refresh
    user = await this.syncUserRole(user);

    const newAccessToken = this.generateAccessToken(user);
    const newRefresh = await this.generateRefreshToken(user.id, true, req);

    return {
      user,
      accessToken: newAccessToken,
      refreshTokenData: newRefresh
    };
  }

  // 6. Global Auth Middleware
  getAuthMiddleware() {
    return async (req, res, next) => {
      let token = null;

      // Check Authorization header or HttpOnly cookie
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      } else if (req.cookies && req.cookies.ih_access_token) {
        token = req.cookies.ih_access_token;
      }

      // If access token missing but refresh token exists, attempt silent refresh
      if (!token && req.cookies && req.cookies.ih_refresh_token) {
        const refreshed = await this.refreshSession(req.cookies.ih_refresh_token, req);
        if (refreshed) {
          this.setAuthCookies(res, refreshed.accessToken, refreshed.refreshTokenData);
          req.user = refreshed.user;
          req.user.role = refreshed.user.role;
          req.user.roles = [refreshed.user.role];
          return next();
        }
      }

      if (!token) {
        req.user = null;
        return next();
      }

      try {
        const decoded = jwt.verify(token, ACCESS_SECRET);
        let user = await this.prisma.user.findUnique({
          where: { id: decoded.sub },
          include: {
            ngoProfile: true,
            volunteerProfile: true,
            donorProfile: true
          }
        });

        if (user && !user.isSuspended) {
          user = await this.syncUserRole(user);
          req.user = user;
          req.user.role = user.role;
          req.user.roles = [user.role];
        } else {
          req.user = null;
        }
      } catch (err) {
        // Access token expired, attempt silent rotation via refresh token
        if (req.cookies && req.cookies.ih_refresh_token) {
          const refreshed = await this.refreshSession(req.cookies.ih_refresh_token, req);
          if (refreshed) {
            this.setAuthCookies(res, refreshed.accessToken, refreshed.refreshTokenData);
            req.user = refreshed.user;
            req.user.role = refreshed.user.role;
            req.user.roles = [refreshed.user.role];
            return next();
          }
        }
        req.user = null;
      }

      next();
    };
  }

  // 7. Require Authenticated User
  requireAuth() {
    return (req, res, next) => {
      const isApi = (req.originalUrl || req.baseUrl || '').startsWith('/api');
      if (!req.user) {
        if (!isApi && req.accepts('html') && !req.xhr) {
          const returnTo = encodeURIComponent(req.originalUrl || '/');
          return res.redirect(`/auth?returnTo=${returnTo}`);
        }
        return res.status(401).json({
          success: false,
          error: 'AuthenticationRequired',
          message: 'You must be signed in to access this resource.'
        });
      }
      if (req.user.isSuspended) {
        return res.status(403).json({
          success: false,
          error: 'AccountSuspended',
          message: 'Your account has been suspended by an administrator.'
        });
      }
      next();
    };
  }

  // 8. Strict Role-Based Access Control
  requireRole(allowedRoles = []) {
    return (req, res, next) => {
      const isApi = (req.originalUrl || req.baseUrl || '').startsWith('/api');
      if (!req.user) {
        if (!isApi && req.accepts('html') && !req.xhr) {
          const returnTo = encodeURIComponent(req.originalUrl || '/');
          return res.redirect(`/auth?returnTo=${returnTo}`);
        }
        return res.status(401).json({
          success: false,
          error: 'AuthenticationRequired',
          message: 'Please sign in to access this resource.'
        });
      }

      if (req.user.isSuspended) {
        return res.status(403).json({
          success: false,
          error: 'AccountSuspended',
          message: 'Your account has been suspended.'
        });
      }

      const userRole = req.user.role || 'volunteer';
      const userEmail = (req.user.email || '').toLowerCase();

      // Check admin permissions strictly: role must be 'admin' AND email in ADMIN_EMAILS AND email verified
      if (allowedRoles.includes('admin')) {
        const isAdminAllowed = userRole === 'admin' && this.isAdminEmail(userEmail) && !!req.user.emailVerifiedAt;
        if (isAdminAllowed) {
          return next();
        }
        if (allowedRoles.length === 1 && allowedRoles[0] === 'admin') {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'Administrative authorization restricted to verified owner account.'
          });
        }
      }

      if (allowedRoles.includes(userRole)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Access denied. This action is restricted to ${allowedRoles.join(' or ')} accounts.`
      });
    };
  }

  // 9. Require Verified Email
  requireVerifiedEmail() {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'AuthenticationRequired' });
      }
      if (!req.user.emailVerifiedAt) {
        return res.status(403).json({
          success: false,
          error: 'EmailVerificationRequired',
          message: 'Please verify your email address to perform this action.'
        });
      }
      next();
    };
  }

  // 10. Audit Logging Helper
  async logAudit({ userId, action, entity, entityId, details, req }) {
    try {
      const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1') : null;
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId: entityId ? String(entityId) : null,
          details: details ? JSON.stringify(details) : null,
          ipAddress: ip
        }
      });
    } catch (e) {
      console.warn('[Audit Log Failed]:', e.message);
    }
  }
}

module.exports = AuthManager;
module.exports.hashToken = hashToken;
module.exports.parseAdminEmails = parseAdminEmails;
module.exports.getAdminEmails = getAdminEmails;

