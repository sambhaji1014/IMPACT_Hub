/**
 * HopeConnect AI - Central Data Store & LocalStorage Manager
 * Production-Grade Architecture with Defensive Exception Handling, Safe Storage Wrappers,
 * and In-Memory Fallback for Private Browsing / Quota Constraints.
 */

// Global Security Utility: HTML Entity Escaping to prevent Cross-Site Scripting (XSS)
window.escapeHTML = function(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const STORAGE_KEYS = {
  NGOS: 'hopeconnect_ngos',
  OPPORTUNITIES: 'hopeconnect_opportunities',
  CAMPAIGNS: 'hopeconnect_campaigns',
  USER_STATS: 'hopeconnect_user_stats',
  USER_REGISTRATIONS: 'hopeconnect_user_registrations',
  USER_DONATIONS: 'hopeconnect_user_donations',
  USER_BADGES: 'hopeconnect_user_badges',
  CURRENT_ROLE: 'hopeconnect_current_role',
  CURRENT_USER: 'hopeconnect_current_user',
  AUTH_USERS: 'hopeconnect_auth_users'
};

const INITIAL_USERS = [
  {
    id: 'user-1',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    password: 'password123',
    role: 'volunteer',
    phone: '+91 98765 43210',
    skills: 'Gardening, Teaching, Photography',
    city: 'Pune, Maharashtra',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    joinedDate: 'June 2026'
  },
  {
    id: 'user-2',
    name: 'Priya Patel',
    email: 'priya.patel@example.com',
    password: 'password123',
    role: 'donor',
    phone: '+91 91234 56789',
    skills: 'Philanthropy, CSR Mentorship',
    city: 'Mumbai, Maharashtra',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    joinedDate: 'July 2026'
  },
  {
    id: 'user-3',
    name: 'Dr. Radhika Sen',
    email: 'contact@greenearth.org',
    password: 'password123',
    role: 'ngo',
    orgName: 'Green Earth Foundation',
    phone: '+91 99887 76655',
    skills: 'Afforestation, NGO Administration',
    city: 'Pune, Maharashtra',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
    joinedDate: 'March 2026'
  }
];

// Initial Seed Data
const INITIAL_NGOS = [
  {
    id: 'ngo-1',
    name: 'Green Earth Foundation',
    category: 'Environment',
    verified: true,
    location: 'Pune, Maharashtra',
    logo: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1511497584788-87676104235f?w=600&auto=format&fit=crop&q=80',
    description: 'Dedicated to urban afforestation, organic farming advocacy, and community waste segregation across Western India.',
    volunteersCount: 420,
    activeCampaignsCount: 3,
    foundedYear: 2017,
    rating: 4.9,
    website: 'https://greenearth.example.org'
  },
  {
    id: 'ngo-2',
    name: 'Smile Education Trust',
    category: 'Education',
    verified: true,
    location: 'Mumbai, Maharashtra',
    logo: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&auto=format&fit=crop&q=80',
    description: 'Empowering underprivileged youth through digital literacy, after-school mentoring, and scholarships for higher studies.',
    volunteersCount: 680,
    activeCampaignsCount: 4,
    foundedYear: 2015,
    rating: 4.8,
    website: 'https://smileeducation.example.org'
  },
  {
    id: 'ngo-3',
    name: 'HealthBridge Foundation',
    category: 'Healthcare',
    verified: true,
    location: 'Delhi NCR',
    logo: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80',
    description: 'Organizing rural medical checkup camps, maternal healthcare initiatives, and subsidizing critical life-saving medications.',
    volunteersCount: 310,
    activeCampaignsCount: 2,
    foundedYear: 2019,
    rating: 4.9,
    website: 'https://healthbridge.example.org'
  },
  {
    id: 'ngo-4',
    name: 'Paws & Care Sanctuary',
    category: 'Animal Welfare',
    verified: true,
    location: 'Bengaluru, Karnataka',
    logo: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=600&auto=format&fit=crop&q=80',
    description: 'Rescuing injured stray animals, conducting rabies vaccination drives, and facilitating compassionate pet adoptions.',
    volunteersCount: 250,
    activeCampaignsCount: 2,
    foundedYear: 2020,
    rating: 4.7,
    website: 'https://pawsandcare.example.org'
  },
  {
    id: 'ngo-5',
    name: 'Tejaswini Women Collective',
    category: 'Women Empowerment',
    verified: true,
    location: 'Jaipur, Rajasthan',
    logo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    description: 'Providing vocational skill development, financial literacy workshops, and micro-grant mentorship to rural artisan women.',
    volunteersCount: 190,
    activeCampaignsCount: 3,
    foundedYear: 2018,
    rating: 4.9,
    website: 'https://tejaswini.example.org'
  },
  {
    id: 'ngo-6',
    name: 'ChildHope India',
    category: 'Child Welfare',
    verified: true,
    location: 'Kolkata, West Bengal',
    logo: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&auto=format&fit=crop&q=80',
    description: 'Nutritional meal distribution, safe shelter homes, and emotional support networks for children in vulnerable slums.',
    volunteersCount: 520,
    activeCampaignsCount: 3,
    foundedYear: 2016,
    rating: 4.8,
    website: 'https://childhope.example.org'
  },
  {
    id: 'ngo-7',
    name: 'Sahara Relief Corps',
    category: 'Disaster Relief',
    verified: true,
    location: 'Chennai, Tamil Nadu',
    logo: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&auto=format&fit=crop&q=80',
    description: 'Rapid response emergency disaster assistance, emergency flood relief kits, clean water supply, and rehabilitation.',
    volunteersCount: 380,
    activeCampaignsCount: 1,
    foundedYear: 2014,
    rating: 4.9,
    website: 'https://sahararelief.example.org'
  }
];

const INITIAL_OPPORTUNITIES = [
  {
    id: 'opp-1',
    title: 'Mega Urban Tree Plantation Drive',
    ngoId: 'ngo-1',
    ngoName: 'Green Earth Foundation',
    category: 'Environment',
    location: 'Pune (Taljai Hills)',
    date: '12 September 2026',
    volunteersNeeded: 35,
    volunteersRegistered: 28,
    skillLevel: 'Beginner / Open for all',
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80',
    description: 'Join hands to plant 500 native saplings in Pune. Tools, saplings, gloves, and refreshments will be provided.'
  },
  {
    id: 'opp-2',
    title: 'Weekend Math & Coding Mentorship',
    ngoId: 'ngo-2',
    ngoName: 'Smile Education Trust',
    category: 'Education',
    location: 'Mumbai (Dharavi Learning Hub)',
    date: 'Every Saturday (Ongoing)',
    volunteersNeeded: 15,
    volunteersRegistered: 11,
    skillLevel: 'Intermediate (Math/Computer basics)',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&auto=format&fit=crop&q=80',
    description: 'Teach basic computer literacy, logical puzzles, and fundamental algebra to 6th-8th grade enthusiastic students.'
  },
  {
    id: 'opp-3',
    title: 'Community Health Screening Assistant',
    ngoId: 'ngo-3',
    ngoName: 'HealthBridge Foundation',
    category: 'Healthcare',
    location: 'Delhi (East Delhi Clinic)',
    date: '18 September 2026',
    volunteersNeeded: 20,
    volunteersRegistered: 14,
    skillLevel: 'All welcome (Medical/Non-medical)',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80',
    description: 'Help register patients, manage queue flow, and assist doctors in recording vitals for over 400 rural elders.'
  },
  {
    id: 'opp-4',
    title: 'Shelter Dog Socialization & Grooming',
    ngoId: 'ngo-4',
    ngoName: 'Paws & Care Sanctuary',
    category: 'Animal Welfare',
    location: 'Bengaluru (Sarjapur Shelter)',
    date: '20 September 2026',
    volunteersNeeded: 12,
    volunteersRegistered: 9,
    skillLevel: 'Animal Lovers',
    image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=600&auto=format&fit=crop&q=80',
    description: 'Spend an uplifting Sunday morning walking, grooming, feeding, and socializing recovered rescued stray dogs.'
  },
  {
    id: 'opp-5',
    title: 'Artisan Women Digital Marketing Training',
    ngoId: 'ngo-5',
    ngoName: 'Tejaswini Women Collective',
    category: 'Women Empowerment',
    location: 'Jaipur / Hybrid Online',
    date: '25 September 2026',
    volunteersNeeded: 10,
    volunteersRegistered: 6,
    skillLevel: 'Social Media / E-commerce basics',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
    description: 'Train rural women artisans to photograph handmade textiles and list them on social marketplaces.'
  },
  {
    id: 'opp-6',
    title: 'Sunday Slum Nutrition & Fun Camp',
    ngoId: 'ngo-6',
    ngoName: 'ChildHope India',
    category: 'Child Welfare',
    location: 'Kolkata (Howrah Center)',
    date: '27 September 2026',
    volunteersNeeded: 25,
    volunteersRegistered: 18,
    skillLevel: 'Energetic & Caring',
    image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&auto=format&fit=crop&q=80',
    description: 'Conduct fun drawing competitions, distribute healthy hot meals, and engage kids in storytelling games.'
  }
];

const INITIAL_CAMPAIGNS = [
  {
    id: 'camp-1',
    title: 'Help Build a Digital Classroom for 200 Students',
    ngoId: 'ngo-2',
    ngoName: 'Smile Education Trust',
    category: 'Education',
    location: 'Mumbai, Maharashtra',
    raised: 78500,
    goal: 100000,
    supporters: 142,
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&auto=format&fit=crop&q=80',
    description: 'Equipping a community learning center with 10 refurbished laptops, high-speed internet, and solar backup power.',
    featured: true,
    daysLeft: 14
  },
  {
    id: 'camp-2',
    title: 'Clean Water & Afforestation Project in Western Ghats',
    ngoId: 'ngo-1',
    ngoName: 'Green Earth Foundation',
    category: 'Environment',
    location: 'Pune & Sahyadri Foothills',
    raised: 135000,
    goal: 180000,
    supporters: 215,
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80',
    description: 'Restoring damaged water catchment areas, creating check dams, and planting 5,000 broadleaf endemic trees.',
    featured: true,
    daysLeft: 22
  },
  {
    id: 'camp-3',
    title: 'Mobile Health Van for Remote Village Clinics',
    ngoId: 'ngo-3',
    ngoName: 'HealthBridge Foundation',
    category: 'Healthcare',
    location: 'Delhi & NCR Outskirts',
    raised: 245000,
    goal: 300000,
    supporters: 380,
    image: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=80',
    description: 'Deploying an equipped medical van with diagnostic kits, ultrasound, ECG, and essential free medicines to 15 remote villages.',
    featured: true,
    daysLeft: 9
  },
  {
    id: 'camp-4',
    title: 'Emergency Medical Care for Rescued Street Animals',
    ngoId: 'ngo-4',
    ngoName: 'Paws & Care Sanctuary',
    category: 'Animal Welfare',
    location: 'Bengaluru, Karnataka',
    raised: 42000,
    goal: 60000,
    supporters: 96,
    image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=600&auto=format&fit=crop&q=80',
    description: 'Funding critical orthopedic surgeries, medicines, and specialized foster care for injured community strays.',
    featured: false,
    daysLeft: 18
  },
  {
    id: 'camp-5',
    title: 'Micro-grants for 50 Rural Women Entrepreneurs',
    ngoId: 'ngo-5',
    ngoName: 'Tejaswini Women Collective',
    category: 'Women Empowerment',
    location: 'Jaipur, Rajasthan',
    raised: 89000,
    goal: 125000,
    supporters: 130,
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
    description: 'Seed funding of ₹2,500 each to help women purchase sewing machines, dairy equipment, or organic seed kits.',
    featured: false,
    daysLeft: 30
  }
];

const INITIAL_USER_STATS = {
  campaignsSupported: 12,
  volunteerHours: 48,
  totalContributed: 8500,
  badgesEarned: 6,
  impactHistory: [
    { month: 'Apr', hours: 8, donation: 1500, events: 2 },
    { month: 'May', hours: 12, donation: 2000, events: 3 },
    { month: 'Jun', hours: 6, donation: 1000, events: 1 },
    { month: 'Jul', hours: 10, donation: 1500, events: 2 },
    { month: 'Aug', hours: 12, donation: 2500, events: 3 }
  ]
};

const INITIAL_BADGES = [
  {
    id: 'badge-1',
    title: 'First Step',
    icon: '🌱',
    description: 'Completed your first volunteering activity on HopeConnect AI.',
    unlocked: true,
    unlockedAt: '15 June 2026'
  },
  {
    id: 'badge-2',
    title: 'Change Maker',
    icon: '🔥',
    description: 'Completed 5 volunteering activities and supported community drives.',
    unlocked: true,
    unlockedAt: '28 July 2026'
  },
  {
    id: 'badge-3',
    title: 'Community Hero',
    icon: '💛',
    description: 'Contributed more than 20 dedicated hours of volunteer work.',
    unlocked: true,
    unlockedAt: '10 August 2026'
  },
  {
    id: 'badge-4',
    title: 'Impact Champion',
    icon: '🌍',
    description: 'Supported multiple community campaigns across different causes.',
    unlocked: true,
    unlockedAt: '18 August 2026'
  },
  {
    id: 'badge-5',
    title: 'Super Supporter',
    icon: '❤️',
    description: 'Donated over ₹5,000 to verified grassroots social initiatives.',
    unlocked: true,
    unlockedAt: '20 August 2026'
  },
  {
    id: 'badge-6',
    title: 'AI Eco-Pioneer',
    icon: '✨',
    description: 'Completed recommendations matching your passionate environmental interests.',
    unlocked: true,
    unlockedAt: '21 August 2026'
  },
  {
    id: 'badge-7',
    title: 'Century Achiever',
    icon: '🏆',
    description: 'Reach 100 volunteer hours to unlock this prestigious gold recognition.',
    unlocked: false,
    unlockedAt: null
  },
  {
    id: 'badge-8',
    title: 'Master Organizer',
    icon: '🏢',
    description: 'Create and successfully complete 3 verified community campaigns.',
    unlocked: false,
    unlockedAt: null
  }
];

class StoreManager {
  constructor() {
    this._memoryFallback = {};
    this.init();
  }

  // Safe Storage Accessors
  _safeGet(key, defaultVal) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key);
        if (item === null || item === undefined || item === 'undefined') return defaultVal;
        return JSON.parse(item);
      }
    } catch (e) {
      console.warn(`[HopeConnect Store] Storage read error for key "${key}", falling back:`, e);
    }
    return this._memoryFallback[key] !== undefined ? this._memoryFallback[key] : defaultVal;
  }

  _safeSet(key, val) {
    this._memoryFallback[key] = val;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(val));
        return true;
      }
    } catch (e) {
      console.warn(`[HopeConnect Store] Storage write error for key "${key}" (quota or private mode):`, e);
    }
    return false;
  }

  _safeRemove(key) {
    delete this._memoryFallback[key];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[HopeConnect Store] Storage removal error:`, e);
    }
  }

  init() {
    if (!this._safeGet(STORAGE_KEYS.NGOS, null)) {
      this._safeSet(STORAGE_KEYS.NGOS, INITIAL_NGOS);
    }
    if (!this._safeGet(STORAGE_KEYS.OPPORTUNITIES, null)) {
      this._safeSet(STORAGE_KEYS.OPPORTUNITIES, INITIAL_OPPORTUNITIES);
    }
    if (!this._safeGet(STORAGE_KEYS.CAMPAIGNS, null)) {
      this._safeSet(STORAGE_KEYS.CAMPAIGNS, INITIAL_CAMPAIGNS);
    }
    if (!this._safeGet(STORAGE_KEYS.USER_STATS, null)) {
      this._safeSet(STORAGE_KEYS.USER_STATS, INITIAL_USER_STATS);
    }
    if (!this._safeGet(STORAGE_KEYS.USER_BADGES, null)) {
      this._safeSet(STORAGE_KEYS.USER_BADGES, INITIAL_BADGES);
    }
    if (!this._safeGet(STORAGE_KEYS.USER_REGISTRATIONS, null)) {
      this._safeSet(STORAGE_KEYS.USER_REGISTRATIONS, [
        {
          id: 'reg-init-1',
          opportunityId: 'opp-1',
          opportunityTitle: 'Mega Urban Tree Plantation Drive',
          ngoName: 'Green Earth Foundation',
          name: 'Aarav Sharma',
          email: 'aarav.sharma@example.com',
          phone: '+91 98765 43210',
          skills: 'Gardening, Photography',
          availability: 'Weekends',
          dateApplied: '2026-08-15',
          status: 'Confirmed'
        }
      ]);
    }
    if (!this._safeGet(STORAGE_KEYS.USER_DONATIONS, null)) {
      this._safeSet(STORAGE_KEYS.USER_DONATIONS, [
        {
          id: 'don-init-1',
          campaignId: 'camp-1',
          campaignTitle: 'Help Build a Digital Classroom for 200 Students',
          ngoName: 'Smile Education Trust',
          amount: 2500,
          date: '2026-08-18',
          donorName: 'Aarav Sharma',
          transactionId: 'TXN_HC_892144'
        },
        {
          id: 'don-init-2',
          campaignId: 'camp-2',
          campaignTitle: 'Clean Water & Afforestation Project in Western Ghats',
          ngoName: 'Green Earth Foundation',
          amount: 1500,
          date: '2026-08-10',
          donorName: 'Aarav Sharma',
          transactionId: 'TXN_HC_652190'
        }
      ]);
    }
    if (!this._safeGet(STORAGE_KEYS.CURRENT_ROLE, null)) {
      this._safeSet(STORAGE_KEYS.CURRENT_ROLE, 'volunteer');
    }
    if (!this._safeGet(STORAGE_KEYS.AUTH_USERS, null)) {
      this._safeSet(STORAGE_KEYS.AUTH_USERS, INITIAL_USERS);
    }
    if (!this._safeGet(STORAGE_KEYS.CURRENT_USER, null)) {
      this._safeSet(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]);
    }
  }

  // Authentication & Users
  getAuthUsers() {
    return this._safeGet(STORAGE_KEYS.AUTH_USERS, INITIAL_USERS);
  }

  getCurrentUser() {
    return this._safeGet(STORAGE_KEYS.CURRENT_USER, null);
  }

  setCurrentUser(user) {
    if (!user) {
      this._safeRemove(STORAGE_KEYS.CURRENT_USER);
    } else {
      this._safeSet(STORAGE_KEYS.CURRENT_USER, user);
      if (user.role) {
        this.setCurrentRole(user.role);
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hc:auth-changed', { detail: { user } }));
    }
  }

  logoutUser() {
    this._safeRemove(STORAGE_KEYS.CURRENT_USER);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hc:auth-changed', { detail: { user: null } }));
    }
  }

  loginUser(email, password) {
    const users = this.getAuthUsers();
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return { success: false, message: 'No registered account found with this email address.' };
    }

    if (user.password && user.password !== password) {
      return { success: false, message: 'Invalid password. Please check your credentials.' };
    }

    this.setCurrentUser(user);
    return { success: true, user };
  }

  registerUser(userData) {
    const users = this.getAuthUsers();
    const cleanEmail = (userData.email || '').trim().toLowerCase();

    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, message: 'An account with this email address already exists. Please sign in instead.' };
    }

    const newUser = {
      id: 'user-' + Date.now(),
      name: userData.name ? String(userData.name).trim() : 'Kind Changemaker',
      email: cleanEmail,
      password: userData.password || 'password123',
      role: userData.role || 'volunteer',
      phone: userData.phone ? String(userData.phone).trim() : '+91 98765 00000',
      orgName: userData.orgName ? String(userData.orgName).trim() : '',
      city: userData.city ? String(userData.city).trim() : 'Pune, India',
      skills: userData.skills ? String(userData.skills).trim() : 'Community Outreach',
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80`,
      joinedDate: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    };

    users.push(newUser);
    this._safeSet(STORAGE_KEYS.AUTH_USERS, users);
    this.setCurrentUser(newUser);

    if (newUser.role === 'ngo' && newUser.orgName) {
      this.addNGO({
        name: newUser.orgName,
        category: 'Community Development',
        location: newUser.city,
        verified: true,
        logo: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=150&auto=format&fit=crop&q=80',
        banner: 'https://images.unsplash.com/photo-1511497584788-87676104235f?w=600&auto=format&fit=crop&q=80',
        description: `Official initiatives organized by ${newUser.name} on HopeConnect AI.`,
        volunteersCount: 1,
        activeCampaignsCount: 0,
        foundedYear: 2026,
        rating: 5.0
      });
    }

    return { success: true, user: newUser };
  }

  updateUserProfile(updates) {
    const current = this.getCurrentUser();
    if (!current) return null;

    const updated = { ...current, ...updates };
    this.setCurrentUser(updated);

    const users = this.getAuthUsers();
    const idx = users.findIndex(u => u.id === updated.id);
    if (idx !== -1) {
      users[idx] = updated;
      this._safeSet(STORAGE_KEYS.AUTH_USERS, users);
    }
    return updated;
  }

  updateNGO(ngoId, updates) {
    const ngos = this.getNGOs();
    const idx = ngos.findIndex(n => n.id === ngoId || n.name.toLowerCase() === (updates.name || '').toLowerCase());
    if (idx !== -1) {
      ngos[idx] = { ...ngos[idx], ...updates };
      this._safeSet(STORAGE_KEYS.NGOS, ngos);
      return ngos[idx];
    }
    return null;
  }

  updateRegistrationStatus(regId, newStatus) {
    const registrations = this.getUserRegistrations();
    const reg = registrations.find(r => r.id === regId);
    if (reg) {
      reg.status = newStatus;
      this._safeSet(STORAGE_KEYS.USER_REGISTRATIONS, registrations);
      return reg;
    }
    return null;
  }

  deleteCampaign(campaignId) {
    let campaigns = this.getCampaigns();
    campaigns = campaigns.filter(c => c.id !== campaignId);
    this._safeSet(STORAGE_KEYS.CAMPAIGNS, campaigns);
    return campaigns;
  }

  // NGOs
  getNGOs() {
    return this._safeGet(STORAGE_KEYS.NGOS, []);
  }

  getNGOById(id) {
    return this.getNGOs().find(n => n.id === id);
  }

  addNGO(ngo) {
    const ngos = this.getNGOs();
    const newNgo = {
      ...ngo,
      id: 'ngo-' + Date.now(),
      name: String(ngo.name || 'Grassroots Foundation').trim(),
      volunteersCount: Number(ngo.volunteersCount) || 1,
      activeCampaignsCount: Number(ngo.activeCampaignsCount) || 0
    };
    ngos.unshift(newNgo);
    this._safeSet(STORAGE_KEYS.NGOS, ngos);
    return newNgo;
  }

  // Opportunities
  getOpportunities() {
    return this._safeGet(STORAGE_KEYS.OPPORTUNITIES, []);
  }

  getOpportunityById(id) {
    return this.getOpportunities().find(o => o.id === id);
  }

  addOpportunity(opp) {
    const opps = this.getOpportunities();
    const newOpp = { 
      ...opp, 
      id: 'opp-' + Date.now(),
      volunteersRegistered: Number(opp.volunteersRegistered) || 0,
      volunteersNeeded: Math.max(1, Number(opp.volunteersNeeded) || 20)
    };
    opps.unshift(newOpp);
    this._safeSet(STORAGE_KEYS.OPPORTUNITIES, opps);
    return newOpp;
  }

  // Campaigns
  getCampaigns() {
    return this._safeGet(STORAGE_KEYS.CAMPAIGNS, []);
  }

  getCampaignById(id) {
    return this.getCampaigns().find(c => c.id === id);
  }

  addCampaign(campaign) {
    const campaigns = this.getCampaigns();
    const newCampaign = {
      ...campaign,
      id: 'camp-' + Date.now(),
      raised: Number(campaign.raised) || 0,
      goal: Math.max(100, Number(campaign.goal) || 50000),
      supporters: Number(campaign.supporters) || 0,
      daysLeft: Number(campaign.daysLeft) || 30
    };
    campaigns.unshift(newCampaign);
    this._safeSet(STORAGE_KEYS.CAMPAIGNS, campaigns);
    return newCampaign;
  }

  donateToCampaign(campaignId, amount, donorName = 'Kind Changemaker') {
    const numAmount = Math.max(1, Number(amount) || 100);
    const campaigns = this.getCampaigns();
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign) {
      campaign.raised = (Number(campaign.raised) || 0) + numAmount;
      campaign.supporters = (Number(campaign.supporters) || 0) + 1;
      this._safeSet(STORAGE_KEYS.CAMPAIGNS, campaigns);

      const donations = this.getUserDonations();
      const newDonation = {
        id: 'don-' + Date.now(),
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        ngoName: campaign.ngoName,
        amount: numAmount,
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        donorName: String(donorName).trim(),
        transactionId: 'TXN_HC_' + Math.floor(100000 + Math.random() * 900000)
      };
      donations.unshift(newDonation);
      this._safeSet(STORAGE_KEYS.USER_DONATIONS, donations);

      const stats = this.getUserStats();
      stats.totalContributed = (Number(stats.totalContributed) || 0) + numAmount;
      stats.campaignsSupported = (Number(stats.campaignsSupported) || 0) + 1;
      this._safeSet(STORAGE_KEYS.USER_STATS, stats);

      return { success: true, campaign, donation: newDonation };
    }
    return { success: false };
  }

  // Volunteer Registrations
  registerVolunteer(registrationData) {
    const registrations = this.getUserRegistrations();
    const newReg = {
      id: 'reg-' + Date.now(),
      ...registrationData,
      name: String(registrationData.name || '').trim(),
      email: String(registrationData.email || '').trim(),
      phone: String(registrationData.phone || '').trim(),
      dateApplied: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'Confirmed'
    };
    registrations.unshift(newReg);
    this._safeSet(STORAGE_KEYS.USER_REGISTRATIONS, registrations);

    const opps = this.getOpportunities();
    const opp = opps.find(o => o.id === registrationData.opportunityId);
    if (opp) {
      opp.volunteersRegistered = (Number(opp.volunteersRegistered) || 0) + 1;
      this._safeSet(STORAGE_KEYS.OPPORTUNITIES, opps);
    }

    const stats = this.getUserStats();
    stats.volunteerHours = (Number(stats.volunteerHours) || 0) + 4;
    this._safeSet(STORAGE_KEYS.USER_STATS, stats);

    return newReg;
  }

  getUserRegistrations() {
    return this._safeGet(STORAGE_KEYS.USER_REGISTRATIONS, []);
  }

  getUserDonations() {
    return this._safeGet(STORAGE_KEYS.USER_DONATIONS, []);
  }

  getUserStats() {
    return this._safeGet(STORAGE_KEYS.USER_STATS, INITIAL_USER_STATS);
  }

  getUserBadges() {
    return this._safeGet(STORAGE_KEYS.USER_BADGES, INITIAL_BADGES);
  }

  unlockBadge(badgeId) {
    const badges = this.getUserBadges();
    const badge = badges.find(b => b.id === badgeId);
    if (badge && !badge.unlocked) {
      badge.unlocked = true;
      badge.unlockedAt = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      this._safeSet(STORAGE_KEYS.USER_BADGES, badges);
      
      const stats = this.getUserStats();
      stats.badgesEarned = badges.filter(b => b.unlocked).length;
      this._safeSet(STORAGE_KEYS.USER_STATS, stats);
      return badge;
    }
    return null;
  }

  getCurrentRole() {
    return this._safeGet(STORAGE_KEYS.CURRENT_ROLE, 'volunteer');
  }

  setCurrentRole(role) {
    const cleanRole = ['volunteer', 'donor', 'ngo'].includes(role) ? role : 'volunteer';
    this._safeSet(STORAGE_KEYS.CURRENT_ROLE, cleanRole);
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.role !== cleanRole) {
      currentUser.role = cleanRole;
      this._safeSet(STORAGE_KEYS.CURRENT_USER, currentUser);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hc:auth-changed', { detail: { user: currentUser } }));
      }
    }
  }
}

// Global Store Instance
window.HCStore = new StoreManager();
