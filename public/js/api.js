/**
 * ImpactHub - Unified Client API Service
 * Handles seamless communication with the backend REST API v1
 * Provides automatic fallback to local storage if running in standalone static mode.
 */

(function(window) {
  'use strict';

  const isDirectFile = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const isWrongPort = typeof window !== 'undefined' && window.location.port && window.location.port !== '5000';
  
  if (isDirectFile || isWrongPort) {
    window.addEventListener('DOMContentLoaded', () => {
      const banner = document.createElement('div');
      banner.id = 'unsupportedEnvironmentBanner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#DC2626;color:#FFF;padding:12px 20px;font-family:sans-serif;font-size:14px;font-weight:600;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;gap:10px;';
      banner.innerHTML = '<span>⚠️ <strong>Unsupported Environment:</strong> ImpactHub must be served by the Express server at <a href="http://localhost:5000" style="color:#FEF08A;text-decoration:underline;">http://localhost:5000</a>. Opening via file:// or Live Server (port ' + (window.location.port || 'other') + ') is unsupported and API features will not function properly.</span>';
      document.body.prepend(banner);
    });
  }

  const API_BASE = (isDirectFile || isWrongPort)
    ? 'http://localhost:5000/api/v1'
    : '/api/v1';

  class ImpactHubClient {
    constructor() {
      this.token = localStorage.getItem('ih_token') || null;
      this.currentUser = null;
      try {
        const cached = localStorage.getItem('ih_user');
        if (cached) this.currentUser = JSON.parse(cached);
      } catch (e) {
        this.currentUser = null;
      }
    }

    setToken(token, user) {
      this.token = token;
      this.currentUser = user;
      if (token) {
        localStorage.setItem('ih_token', token);
      } else {
        localStorage.removeItem('ih_token');
      }
      if (user) {
        localStorage.setItem('ih_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('ih_user');
      }
    }

    // Synchronous accessor for user state
    getCurrentUser() {
      if (this.currentUser) return this.currentUser;
      try {
        const cached = localStorage.getItem('ih_user');
        if (cached) {
          this.currentUser = JSON.parse(cached);
          return this.currentUser;
        }
      } catch (e) {}
      if (window.HCStore && typeof window.HCStore.getCurrentUser === 'function') {
        return window.HCStore.getCurrentUser();
      }
      return null;
    }

    async request(endpoint, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const timeoutMs = options.timeout || 10000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          signal: controller.signal,
          credentials: 'include', // sends httpOnly session cookies
          headers
        });

        clearTimeout(timeoutId);

        let data;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          data = { message: await res.text() };
        }

        if (!res.ok) {
          const err = new Error(data.message || `Request failed with status ${res.status}`);
          err.status = res.status;
          err.code = data.error || (res.status === 401 ? 'Unauthorized' : (res.status === 403 ? 'Forbidden' : 'RequestError'));
          throw err;
        }

        return data;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          const timeoutErr = new Error(`Request to ${endpoint} timed out after ${timeoutMs / 1000}s`);
          timeoutErr.status = 408;
          timeoutErr.code = 'TimeoutError';
          throw timeoutErr;
        }
        console.warn(`[ImpactHub API] Request to ${endpoint} failed:`, err.message);
        throw err;
      }
    }

    // 1. Auth: Login
    async login(email, password, remember = true) {
      try {
        const data = await this.request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password, remember })
        });
        if (data.success) {
          this.setToken(data.token, data.user);
          if (window.HCStore && typeof window.HCStore.setCurrentUser === 'function') {
            window.HCStore.setCurrentUser(data.user);
          }
          window.dispatchEvent(new CustomEvent('ih:auth-changed', { detail: { user: data.user } }));
          return { success: true, user: data.user };
        }
        return { success: false, message: data.message };
      } catch (err) {
        return this.offlineLogin(email, password);
      }
    }

    // 2. Auth: Sign Up
    async signup(payload) {
      try {
        const data = await this.request('/auth/signup', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (data.success) {
          this.setToken(data.token, data.user);
          if (window.HCStore && typeof window.HCStore.setCurrentUser === 'function') {
            window.HCStore.setCurrentUser(data.user);
          }
          window.dispatchEvent(new CustomEvent('ih:auth-changed', { detail: { user: data.user } }));
          return { success: true, user: data.user };
        }
        return { success: false, message: data.message };
      } catch (err) {
        return this.offlineSignup(payload);
      }
    }

    // 3. Auth: Logout
    async logout() {
      try {
        await this.request('/auth/logout', { method: 'POST' });
      } catch (e) {}
      this.setToken(null, null);
      if (window.HCStore && typeof window.HCStore.logoutUser === 'function') {
        window.HCStore.logoutUser();
      }
      window.dispatchEvent(new CustomEvent('ih:auth-changed', { detail: { user: null } }));
      return { success: true };
    }

    // 4. Auth: Fetch Current User from Server
    async fetchCurrentUser() {
      const data = await this.request('/auth/me');
      if (data && data.success && data.user) {
        this.currentUser = data.user;
        localStorage.setItem('ih_user', JSON.stringify(data.user));
        return data.user;
      }
      // If server explicitly returned no user / unauthenticated session
      this.currentUser = null;
      localStorage.removeItem('ih_user');
      localStorage.removeItem('ih_token');
      return null;
    }

    // 5. Update Profile
    async updateProfile(profileData) {
      const data = await this.request('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      if (data.success && data.user) {
        this.currentUser = data.user;
        localStorage.setItem('ih_user', JSON.stringify(data.user));
        window.dispatchEvent(new CustomEvent('ih:auth-changed', { detail: { user: data.user } }));
        return data.user;
      }
      throw new Error(data.message || 'Failed to update profile');
    }

    // 6. NGOs
    async getNGOs(params = {}) {
      try {
        const q = new URLSearchParams(params).toString();
        const data = await this.request(q ? `/ngos?${q}` : '/ngos');
        return data.ngos || [];
      } catch (e) {
        return window.HCStore ? window.HCStore.getNGOs() : [];
      }
    }

    // 7. Campaigns
    async getCampaigns(params = {}) {
      try {
        const q = new URLSearchParams(params).toString();
        const data = await this.request(q ? `/campaigns?${q}` : '/campaigns');
        return data.campaigns || [];
      } catch (e) {
        return window.HCStore ? window.HCStore.getCampaigns() : [];
      }
    }

    async createCampaign(campaignData) {
      const data = await this.request('/campaigns', {
        method: 'POST',
        body: JSON.stringify(campaignData)
      });
      window.dispatchEvent(new CustomEvent('ih:campaign-created', { detail: data.campaign }));
      return data.campaign;
    }

    // 8. Donations
    async makeDonation(donationData) {
      const data = await this.request('/donations', {
        method: 'POST',
        body: JSON.stringify(donationData)
      });
      window.dispatchEvent(new CustomEvent('ih:donation-made', { detail: data.donation }));
      return data;
    }

    async getDonations() {
      try {
        const data = await this.request('/donations/my');
        return data.donations || [];
      } catch (e) {
        return window.HCStore ? window.HCStore.getDonations() : [];
      }
    }

    // 9. Volunteer Drives / Opportunities
    async getOpportunities(params = {}) {
      try {
        const q = new URLSearchParams(params).toString();
        const data = await this.request(q ? `/drives?${q}` : '/drives');
        return data.opportunities || data.drives || [];
      } catch (e) {
        return window.HCStore ? window.HCStore.getOpportunities() : [];
      }
    }

    async getDrives(params = {}) {
      return this.getOpportunities(params);
    }

    async createOpportunity(oppData) {
      const data = await this.request('/drives', {
        method: 'POST',
        body: JSON.stringify(oppData)
      });
      window.dispatchEvent(new CustomEvent('ih:opportunity-created', { detail: data.drive || data.opportunity }));
      return data.drive || data.opportunity;
    }

    // 10. Drive Applications / Registrations
    async applyForOpportunity(appData) {
      const driveId = appData.opportunityId || appData.driveId || appData.id;
      const data = await this.request(`/drives/${driveId}/join`, {
        method: 'POST',
        body: JSON.stringify(appData)
      });
      window.dispatchEvent(new CustomEvent('ih:application-created', { detail: data.registration }));
      return data;
    }

    async getMyApplications() {
      try {
        const data = await this.request('/drives/registrations/my');
        return data.registrations || [];
      } catch (e) {
        return window.HCStore ? window.HCStore.getUserRegistrations() : [];
      }
    }

    async getApplications() {
      return this.getMyApplications();
    }

    async cancelApplication(regId) {
      return await this.request(`/drives/registrations/${regId}`, {
        method: 'DELETE'
      });
    }

    // 11. Rewards & Leaderboard
    async getRewards() {
      try {
        return await this.request('/rewards/me');
      } catch (e) {
        return null;
      }
    }

    async getLeaderboard() {
      try {
        return await this.request('/rewards/leaderboard');
      } catch (e) {
        return null;
      }
    }

    // 12. Admin Controls
    async getAdminData() {
      return await this.request('/admin/overview');
    }

    async getAdminNgos(status = null, search = '') {
      const params = new URLSearchParams();
      if (status && status !== 'ALL') params.append('status', status);
      if (search && search.trim()) params.append('search', search.trim());
      const q = params.toString();
      return await this.request(q ? `/admin/ngos?${q}` : '/admin/ngos');
    }

    async verifyNgo(ngoId, status, rejectionReason = null, adminPassword = null) {
      return await this.request(`/admin/ngos/${ngoId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ status, rejectionReason, adminPassword })
      });
    }

    async getAdminAuditLogs(params = {}) {
      const q = new URLSearchParams(params).toString();
      return await this.request(q ? `/admin/audit-logs?${q}` : '/admin/audit-logs');
    }

    async getAdminLeaderboard() {
      return await this.request('/admin/leaderboard');
    }

    async updateAdminUserRole(userId, role) {
      return await this.request(`/admin/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify({ role })
      });
    }

    // 13. NGO Participant Attendance
    async markAttendance(registrationId, hours) {
      return await this.request(`/drives/registrations/${registrationId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ hours })
      });
    }

    // 14. Contact Message
    async sendContactMessage(msgData) {
      return await this.request('/contact', {
        method: 'POST',
        body: JSON.stringify(msgData)
      });
    }

    // 15. Real Authenticated Me & Settings Endpoints
    async getMe(role) {
      return await this.request(`/me/${role}`);
    }

    async getMyProfile() {
      return await this.request('/me/profile');
    }

    async updateMyProfile(profileData) {
      return await this.request('/me/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
    }

    async changePassword(currentPassword, newPassword) {
      return await this.request('/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
    }

    async changeEmail(newEmail) {
      return await this.request('/me/change-email', {
        method: 'POST',
        body: JSON.stringify({ newEmail })
      });
    }

    async logoutAllDevices() {
      return await this.request('/me/sessions/logout-all', { method: 'POST' });
    }

    async exportMyData() {
      return await this.request('/me/export-data');
    }

    async deleteMyAccount(password) {
      return await this.request('/me/delete-account', {
        method: 'POST',
        body: JSON.stringify({ password })
      });
    }

    async toggleSaveCampaign(campaignId) {
      return await this.request(`/me/campaigns/save/${campaignId}`, { method: 'POST' });
    }

    async submitReport(targetType, targetId, reason, description) {
      return await this.request('/reports', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId, reason, description })
      });
    }

    async resendVerification() {
      return await this.request('/auth/resend-verification', { method: 'POST' });
    }

    async forgotPassword(email) {
      return await this.request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    }

    async resetPassword(token, password) {
      return await this.request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
    }

    // Offline / Standalone Mock Helpers (Fallback with no demo accounts)
    offlineLogin(email, password) {
      return { success: false, message: 'Server connection failed. Ensure Express server is running on http://localhost:5000' };
    }

    offlineSignup(payload) {
      return { success: false, message: 'Server connection failed. Ensure Express server is running on http://localhost:5000' };
    }
  }

  window.ImpactHubAPI = new ImpactHubClient();

})(window);
