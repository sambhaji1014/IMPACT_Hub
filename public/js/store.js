
/**
 * ImpactHub - Central Data Store & Client Sync Manager
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
  NGOS: 'impacthub_ngos',
  OPPORTUNITIES: 'impacthub_opportunities',
  CAMPAIGNS: 'impacthub_campaigns',
  USER_STATS: 'impacthub_user_stats',
  USER_REGISTRATIONS: 'impacthub_user_registrations',
  USER_DONATIONS: 'impacthub_user_donations',
  USER_BADGES: 'impacthub_user_badges',
  CURRENT_ROLE: 'impacthub_current_role',
  CURRENT_USER: 'impacthub_current_user',
  AUTH_USERS: 'impacthub_auth_users',
  CAUSES_FOLLOWED: 'impacthub_causes_followed',
  CONTACT_MESSAGES: 'impacthub_contact_messages'
};

const INITIAL_USERS = [];

// Initial Seed Data
const INITIAL_NGOS = [
  {
    id: 'ngo-1',
    name: 'Green Earth Foundation',
    category: 'Environment',
    verified: true,
    location: 'Pune, Maharashtra',
    logo: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=150&auto=format&fit=crop&q=80',
    banner: 'assets/images/green-earth-banner.svg',
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
    title: 'Mega Urban Tree Plantation & Biodiversity Drive',
    ngoId: 'ngo-1',
    ngoName: 'Green Earth Foundation',
    category: 'Environment',
    city: 'Pune',
    location: 'Pune (Taljai Hills Eco Park)',
    date: '25 October 2026',
    time: '07:00 AM – 11:00 AM',
    duration: '4 Hours',
    volunteersNeeded: 35,
    volunteersRegistered: 24,
    availableSpots: 11,
    registrationDeadline: '23 October 2026',
    skillLevel: 'Beginner / Open for all',
    requirements: 'Comfortable outdoor attire, sturdy shoes, reusable water bottle, and passion for nature conservation.',
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80',
    description: 'Join hands to plant 500 native saplings along Pune hillsides to combat heat islands and restore native bird nesting habitats.',
    status: 'upcoming'
  },
  {
    id: 'opp-2',
    title: 'Mula-Mutha Riverbank Cleanup & Plastic Interception',
    ngoId: 'ngo-1',
    ngoName: 'Green Earth Foundation',
    category: 'Environment',
    city: 'Pune',
    location: 'Pune (Mutha Riverbed Promenade, Deccan)',
    date: '28 October 2026',
    time: '06:30 AM – 10:00 AM',
    duration: '3.5 Hours',
    volunteersNeeded: 40,
    volunteersRegistered: 31,
    availableSpots: 9,
    registrationDeadline: '26 October 2026',
    skillLevel: 'Open for all',
    requirements: 'Sturdy shoes, long trousers, and readiness to segregate non-biodegradable plastics. Heavy gloves and disposal sacks provided.',
    image: 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=600&auto=format&fit=crop&q=80',
    description: 'Intercept single-use plastics and debris along the riverbank before they degrade into downstream waterways. Collected plastic is sent for certified recycling.',
    status: 'upcoming'
  },
  {
    id: 'opp-3',
    title: 'Weekend Foundational Coding & STEM Mentorship',
    ngoId: 'ngo-2',
    ngoName: 'Smile Education Trust',
    category: 'Education',
    city: 'Mumbai',
    location: 'Mumbai (Dharavi Community Learning Hub)',
    date: '01 November 2026',
    time: '10:00 AM – 01:00 PM',
    duration: '3 Hours',
    volunteersNeeded: 18,
    volunteersRegistered: 14,
    availableSpots: 4,
    registrationDeadline: '30 October 2026',
    skillLevel: 'Intermediate (Math/Computer basics)',
    requirements: 'Basic familiarity with school mathematics or computer fundamentals; patience and enthusiasm for mentoring 6th-8th grade learners.',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&auto=format&fit=crop&q=80',
    description: 'Teach basic computer literacy, Scratch programming puzzles, and fundamental algebra to 6th-8th grade students from municipal schools.',
    status: 'upcoming'
  },
  {
    id: 'opp-4',
    title: 'Community Diagnostic, Eye Screening & Vitals Triage Camp',
    ngoId: 'ngo-3',
    ngoName: 'HealthBridge Foundation',
    category: 'Healthcare',
    city: 'Delhi NCR',
    location: 'Delhi NCR (East Delhi Community Clinic)',
    date: '04 November 2026',
    time: '08:30 AM – 01:30 PM',
    duration: '5 Hours',
    volunteersNeeded: 25,
    volunteersRegistered: 19,
    availableSpots: 6,
    registrationDeadline: '02 November 2026',
    skillLevel: 'All welcome (Medical & Non-medical)',
    requirements: 'Willingness to support patient triage, token queues, record vitals, and assist elderly beneficiaries with registration forms.',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80',
    description: 'Help register patients, manage queue flow, and assist doctors in recording vitals and vision screenings for over 400 community elders.',
    status: 'upcoming'
  },
  {
    id: 'opp-5',
    title: 'Shelter Dog Socialization, Grooming & Adoption Day',
    ngoId: 'ngo-4',
    ngoName: 'Paws & Care Sanctuary',
    category: 'Animal Welfare',
    city: 'Bengaluru',
    location: 'Bengaluru (Sarjapur Sanctuary Grounds)',
    date: '07 November 2026',
    time: '09:00 AM – 12:30 PM',
    duration: '3.5 Hours',
    volunteersNeeded: 16,
    volunteersRegistered: 13,
    availableSpots: 3,
    registrationDeadline: '05 November 2026',
    skillLevel: 'Animal Lovers',
    requirements: 'Compassion for rescue animals, no fear of friendly vaccinated dogs, comfortable with light brushing and walking on leash.',
    image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=600&auto=format&fit=crop&q=80',
    description: 'Spend an uplifting Sunday morning walking, grooming, feeding, and socializing recovered rescued dogs, and assisting prospective foster families.',
    status: 'upcoming'
  },
  {
    id: 'opp-6',
    title: 'Artisan Women Digital Marketing & E-Commerce Training',
    ngoId: 'ngo-5',
    ngoName: 'Tejaswini Women Collective',
    category: 'Women Empowerment',
    city: 'Mumbai',
    location: 'Mumbai (Andheri Skill Development Center)',
    date: '10 November 2026',
    time: '02:00 PM – 05:30 PM',
    duration: '3.5 Hours',
    volunteersNeeded: 14,
    volunteersRegistered: 9,
    availableSpots: 5,
    registrationDeadline: '08 November 2026',
    skillLevel: 'Social Media / Smartphone basics',
    requirements: 'Smartphone proficiency, basic knowledge of social media cataloging, and passion for women financial self-reliance.',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
    description: 'Train rural women artisans to photograph handmade textiles and handicrafts, write clear pricing details, and set up WhatsApp digital catalogs.',
    status: 'upcoming'
  },
  {
    id: 'opp-7',
    title: 'Community Slum Hot Meal Packaging & Distribution',
    ngoId: 'ngo-6',
    ngoName: 'ChildHope India',
    category: 'Community Development',
    city: 'Pune',
    location: 'Pune (Hadapsar Transit Camp & Kitchen)',
    date: '14 November 2026',
    time: '10:30 AM – 02:30 PM',
    duration: '4 Hours',
    volunteersNeeded: 25,
    volunteersRegistered: 25,
    availableSpots: 0,
    registrationDeadline: '12 November 2026',
    skillLevel: 'High Energy & Caring',
    requirements: 'Adherence to kitchen hygiene (haircaps, aprons provided). Pack, seal, and respectfully distribute nutritious hot meals.',
    image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&auto=format&fit=crop&q=80',
    description: 'Package and distribute 600 wholesome, hot meals to vulnerable migrant families and organize storytelling circles for young kids.',
    status: 'full'
  },
  {
    id: 'opp-8',
    title: 'Emergency Flood Relief Kit Packing & Logistics Staging',
    ngoId: 'ngo-7',
    ngoName: 'Sahara Relief Corps',
    category: 'Disaster Relief',
    city: 'Mumbai',
    location: 'Mumbai (Kurla Central Disaster Logistics Warehouse)',
    date: '18 November 2026',
    time: '09:00 AM – 02:00 PM',
    duration: '5 Hours',
    volunteersNeeded: 30,
    volunteersRegistered: 18,
    availableSpots: 12,
    registrationDeadline: '16 November 2026',
    skillLevel: 'Physical Stamina / Logistics Support',
    requirements: 'Comfortable lifting light-to-medium aid boxes (rations, water purification tablets, hygiene kits). Packing tape and labels provided.',
    image: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&auto=format&fit=crop&q=80',
    description: 'Assemble emergency flood-response survival packets containing dry rations, water filters, tarpaulins, and first-aid kits for disaster-prone coastal villages.',
    status: 'upcoming'
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
    problemStatement: 'Underprivileged school students lack access to digital computers, leaving them years behind in digital fluency and STEM opportunities.',
    plannedActivities: 'Procure 10 verified refurbished student laptops, install curriculum software & offline Khan Academy content, establish solar power backup, and run weekly instructor-led classes.',
    intendedImpact: '200+ primary & middle school children will achieve foundational computer skills, basic coding literacy, and pass standardized academic milestones.',
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
    problemStatement: 'Deforestation and topsoil erosion in catchment areas have depleted ground tables in 4 tribal hamlets, causing acute summer water distress.',
    plannedActivities: 'Construct 6 rock-masonry check dams, remove invasive lantana weeds, establish solar water pumps, and plant 5,000 indigenous broadleaf saplings with community drip lines.',
    intendedImpact: 'Perennial clean drinking water security for 1,200 villagers, stabilized soil fertility, and 5 hectares of biodiverse green canopy.',
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
    problemStatement: 'Elderly residents and pregnant women in isolated villages must travel up to 45 km over broken roads for even basic preventive medical checks.',
    plannedActivities: 'Outfit a reliable utility van with portable ECG, automated blood glucose analyzer, diagnostic tests, sterile dressing bay, and generic pharmaceuticals.',
    intendedImpact: 'Weekly doorstep consultations for 3,000+ villagers, early non-communicable disease detection, and free essential treatments.',
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
    problemStatement: 'Road accidents leave injured community animals in critical pain without emergency orthopedic surgery and safe convalescence shelters.',
    plannedActivities: 'Partner with emergency veterinary hospitals, fund x-ray diagnostics and reconstructive surgeries, and provide foster recovery bays with proper nutrition.',
    intendedImpact: 'Over 80 critically injured animals rehabilitated, vaccinated against rabies, and placed in loving forever homes.',
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
    problemStatement: 'Women artisans have world-class traditional handicraft skills but lack initial capital for raw materials, keeping them dependent on exploitative middlemen.',
    plannedActivities: 'Deliver direct revolving seed micro-grants of ₹2,500 per artisan, conduct bookkeeping training, and establish direct collective sales at craft exhibitions.',
    intendedImpact: '50 self-sufficient women-led micro-enterprises with average 65% household income growth and sustained financial independence.',
    featured: false,
    daysLeft: 30
  }
];

const INITIAL_USER_STATS = {
  campaignsSupported: 0,
  volunteerHours: 0,
  totalContributed: 0,
  badgesEarned: 0,
  impactHistory: []
};

const INITIAL_BADGES = [
  {
    id: 'badge-1',
    title: 'First Step',
    icon: '🌱',
    description: 'Completed your first volunteering activity on ImpactHub.',
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
      console.warn(`[ImpactHub Store] Storage read error for key "${key}", falling back:`, e);
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
      console.warn(`[ImpactHub Store] Storage write error for key "${key}" (quota or private mode):`, e);
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
      console.warn(`[ImpactHub Store] Storage removal error:`, e);
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
      this._safeSet(STORAGE_KEYS.USER_REGISTRATIONS, []);
    }
    if (!this._safeGet(STORAGE_KEYS.USER_DONATIONS, null)) {
      this._safeSet(STORAGE_KEYS.USER_DONATIONS, []);
    }
    if (!this._safeGet(STORAGE_KEYS.CURRENT_ROLE, null)) {
      this._safeSet(STORAGE_KEYS.CURRENT_ROLE, 'volunteer');
    }
    if (!this._safeGet(STORAGE_KEYS.AUTH_USERS, null)) {
      this._safeSet(STORAGE_KEYS.AUTH_USERS, INITIAL_USERS);
    }
    // Do not auto-login any mock user by default; user must explicitly authenticate
    if (!this._safeGet(STORAGE_KEYS.CAUSES_FOLLOWED, null)) {
      this._safeSet(STORAGE_KEYS.CAUSES_FOLLOWED, ['Environment', 'Education', 'Healthcare']);
    }
    if (!this._safeGet(STORAGE_KEYS.CONTACT_MESSAGES, null)) {
      this._safeSet(STORAGE_KEYS.CONTACT_MESSAGES, []);
    }
  }

  // Authentication & Users
  getAuthUsers() {
    return this._safeGet(STORAGE_KEYS.AUTH_USERS, INITIAL_USERS);
  }

  getCurrentUser() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const apiUser = window.localStorage.getItem('ih_user');
        if (apiUser) {
          return JSON.parse(apiUser);
        }
      }
    } catch (e) {}
    return this._safeGet(STORAGE_KEYS.CURRENT_USER, null);
  }

  setCurrentUser(user) {
    if (!user) {
      this._safeRemove(STORAGE_KEYS.CURRENT_USER);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('ih_user');
        }
      } catch (e) {}
    } else {
      this._safeSet(STORAGE_KEYS.CURRENT_USER, user);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('ih_user', JSON.stringify(user));
        }
      } catch (e) {}
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
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('ih_token');
        window.localStorage.removeItem('ih_user');
      }
      if (typeof window !== 'undefined' && window.ImpactHubAPI) {
        window.ImpactHubAPI.logout().catch(() => {});
      }
    } catch (e) {}
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
        description: `Official initiatives organized by ${newUser.name} on ImpactHub.`,
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
    let opps = this._safeGet(STORAGE_KEYS.OPPORTUNITIES, []);
    if (!opps || !Array.isArray(opps) || opps.length === 0) {
      this._safeSet(STORAGE_KEYS.OPPORTUNITIES, INITIAL_OPPORTUNITIES);
      opps = INITIAL_OPPORTUNITIES;
    }
    return opps.map(o => {
      const needed = Number(o.volunteersNeeded !== undefined ? o.volunteersNeeded : (o.volunteers_needed || 20));
      const registered = Number(o.volunteersRegistered !== undefined ? o.volunteersRegistered : (o.volunteers_registered || 0));
      const spots = Math.max(0, needed - registered);
      return {
        ...o,
        volunteersNeeded: needed,
        volunteersRegistered: registered,
        availableSpots: o.availableSpots !== undefined ? o.availableSpots : spots,
        registrationDeadline: o.registrationDeadline || o.registration_deadline || 'Open until drive date',
        status: o.status || (spots <= 0 ? 'full' : 'upcoming')
      };
    });
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
    const camps = this._safeGet(STORAGE_KEYS.CAMPAIGNS, []);
    if (!camps || !Array.isArray(camps) || camps.length === 0) {
      this._safeSet(STORAGE_KEYS.CAMPAIGNS, INITIAL_CAMPAIGNS);
      return INITIAL_CAMPAIGNS;
    }
    return camps;
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

  donateToCampaign(campaignId, amount, donorName = 'Kind Changemaker', donorEmail = '', donorPhone = '', donorMessage = '') {
    const numAmount = Math.max(1, Number(amount) || 100);
    const campaigns = this.getCampaigns();
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign) {
      campaign.raised = (Number(campaign.raised) || 0) + numAmount;
      campaign.supporters = (Number(campaign.supporters) || 0) + 1;
      this._safeSet(STORAGE_KEYS.CAMPAIGNS, campaigns);

      const allDonations = this._safeGet(STORAGE_KEYS.USER_DONATIONS, []);
      const current = this.getCurrentUser();
      const refCode = 'IH-DON-' + Math.floor(100000 + Math.random() * 900000);
      const newDonation = {
        id: 'don-' + Date.now(),
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        ngoName: campaign.ngoName || campaign.ngo_name,
        amount: numAmount,
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        donorName: String(donorName).trim(),
        donorEmail: String(donorEmail || (current ? current.email : '')).trim(),
        donorPhone: String(donorPhone || (current ? current.phone : '')).trim(),
        donorMessage: String(donorMessage || '').trim(),
        donor_id: current ? current.id : null,
        transactionId: refCode,
        referenceCode: refCode,
        receiptNumber: refCode,
        isSimulated: true,
        status: 'completed'
      };
      allDonations.unshift(newDonation);
      this._safeSet(STORAGE_KEYS.USER_DONATIONS, allDonations);

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
    const allRegistrations = this._safeGet(STORAGE_KEYS.USER_REGISTRATIONS, []);
    const current = this.getCurrentUser();
    const newReg = {
      id: 'reg-' + Date.now(),
      ...registrationData,
      name: String(registrationData.name || '').trim(),
      email: String(registrationData.email || '').trim(),
      phone: String(registrationData.phone || '').trim(),
      volunteer_id: current ? current.id : null,
      dateApplied: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'Confirmed'
    };
    allRegistrations.unshift(newReg);
    this._safeSet(STORAGE_KEYS.USER_REGISTRATIONS, allRegistrations);

    const opps = this.getOpportunities();
    const opp = opps.find(o => o.id === registrationData.opportunityId);
    if (opp) {
      opp.volunteersRegistered = (Number(opp.volunteersRegistered) || 0) + 1;
      const needed = Number(opp.volunteersNeeded) || 20;
      opp.availableSpots = Math.max(0, needed - opp.volunteersRegistered);
      if (opp.volunteersRegistered >= needed) {
        opp.status = 'full';
      }
      this._safeSet(STORAGE_KEYS.OPPORTUNITIES, opps);
    }

    const stats = this.getUserStats();
    stats.volunteerHours = (Number(stats.volunteerHours) || 0) + 4;
    this._safeSet(STORAGE_KEYS.USER_STATS, stats);

    return newReg;
  }

  getUserRegistrations() {
    const all = this._safeGet(STORAGE_KEYS.USER_REGISTRATIONS, []);
    const current = this.getCurrentUser();
    if (!current) {
      // For unauthenticated session visitors, show registrations created in this browser
      return all.filter(r => !r.volunteer_id);
    }
    const cleanEmail = (current.email || '').toLowerCase().trim();
    return all.filter(r => (r.volunteer_id && r.volunteer_id === current.id) || (r.email && r.email.toLowerCase().trim() === cleanEmail));
  }

  getUserDonations() {
    const all = this._safeGet(STORAGE_KEYS.USER_DONATIONS, []);
    const current = this.getCurrentUser();
    if (!current) {
      return all.filter(d => !d.donor_id);
    }
    const cleanEmail = (current.email || '').toLowerCase().trim();
    return all.filter(d => (d.donor_id && d.donor_id === current.id) || (d.donorEmail && d.donorEmail.toLowerCase().trim() === cleanEmail) || (d.donor_email && d.donor_email.toLowerCase().trim() === cleanEmail));
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

  // Cancel a Volunteer Registration (Decrements opp counter and updates stats)
  cancelVolunteerRegistration(regId) {
    const all = this._safeGet(STORAGE_KEYS.USER_REGISTRATIONS, []);
    const idx = all.findIndex(r => r.id === regId);
    if (idx === -1) return { success: false, message: 'Registration not found' };

    const reg = all[idx];
    const oppId = reg.opportunityId;

    all.splice(idx, 1);
    this._safeSet(STORAGE_KEYS.USER_REGISTRATIONS, all);

    const opps = this.getOpportunities();
    const opp = opps.find(o => o.id === oppId);
    if (opp && opp.volunteersRegistered > 0) {
      opp.volunteersRegistered = Math.max(0, (Number(opp.volunteersRegistered) || 1) - 1);
      const needed = Number(opp.volunteersNeeded) || 20;
      opp.availableSpots = Math.max(0, needed - opp.volunteersRegistered);
      if (opp.volunteersRegistered < needed) {
        opp.status = 'upcoming';
      }
      this._safeSet(STORAGE_KEYS.OPPORTUNITIES, opps);
    }

    const stats = this.getUserStats();
    stats.volunteerHours = Math.max(0, (Number(stats.volunteerHours) || 4) - 4);
    this._safeSet(STORAGE_KEYS.USER_STATS, stats);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hc:registration-cancelled', { detail: { regId, oppId } }));
    }
    return { success: true, cancelledReg: reg };
  }

  cancelRegistration(regId) {
    return this.cancelVolunteerRegistration(regId);
  }

  // Duplicate Check for Registration
  isUserRegisteredFor(oppId, email) {
    if (!oppId) return false;
    const registrations = this.getUserRegistrations();
    const cleanEmail = String(email || '').toLowerCase().trim();
    return registrations.some(r => r.opportunityId === oppId && (!cleanEmail || String(r.email || '').toLowerCase().trim() === cleanEmail));
  }

  // Causes Followed
  getCausesFollowed() {
    return this._safeGet(STORAGE_KEYS.CAUSES_FOLLOWED, ['Environment', 'Education', 'Healthcare']);
  }

  toggleCauseFollowed(cause) {
    let causes = this.getCausesFollowed();
    if (causes.includes(cause)) {
      causes = causes.filter(c => c !== cause);
    } else {
      causes.push(cause);
    }
    this._safeSet(STORAGE_KEYS.CAUSES_FOLLOWED, causes);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hc:causes-changed', { detail: { causes } }));
    }
    return causes;
  }

  // Contact Messages Store
  saveContactMessage(message) {
    const messages = this.getContactMessages();
    const newMsg = {
      id: 'msg-' + Date.now(),
      ...message,
      name: String(message.name || '').trim(),
      email: String(message.email || '').trim(),
      subject: String(message.subject || 'General Inquiry').trim(),
      message: String(message.message || '').trim(),
      submittedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    messages.unshift(newMsg);
    this._safeSet(STORAGE_KEYS.CONTACT_MESSAGES, messages);
    return newMsg;
  }

  getContactMessages() {
    return this._safeGet(STORAGE_KEYS.CONTACT_MESSAGES, []);
  }

  // Reset Demo Data to Pristine Initial State
  resetDemoData() {
    try {
      localStorage.removeItem(STORAGE_KEYS.NGOS);
      localStorage.removeItem(STORAGE_KEYS.OPPORTUNITIES);
      localStorage.removeItem(STORAGE_KEYS.CAMPAIGNS);
      localStorage.removeItem(STORAGE_KEYS.USER_STATS);
      localStorage.removeItem(STORAGE_KEYS.USER_REGISTRATIONS);
      localStorage.removeItem(STORAGE_KEYS.USER_DONATIONS);
      localStorage.removeItem(STORAGE_KEYS.USER_BADGES);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ROLE);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.AUTH_USERS);
      localStorage.removeItem(STORAGE_KEYS.CAUSES_FOLLOWED);
      localStorage.removeItem(STORAGE_KEYS.CONTACT_MESSAGES);
    } catch (e) {
      this._memoryStore = {};
    }
    this._initSeeds();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hc:auth-changed', { detail: { user: null } }));
      window.dispatchEvent(new CustomEvent('hc:data-reset'));
    }
    return true;
  }
}

// Global Store Instance
window.HCStore = new StoreManager();
window.ImpactHubStore = window.HCStore;
