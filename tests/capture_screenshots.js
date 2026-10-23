/**
 * ImpactHub - Automated Screenshot Generator
 * Uses local Google Chrome via puppeteer-core to capture proof of all role experiences,
 * public pages, flows, and dashboards.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
const ARTIFACT_DIR = 'C:\\Users\\Jadhav\\.gemini\\antigravity-ide\\brain\\f88499d8-4272-4b56-9c9c-8514d07a4470';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function capture() {
  console.log('📸 Starting ImpactHub Screenshot Capture Pipeline...');

  if (!fs.existsSync(CHROME_PATH)) {
    console.error('Chrome executable not found at:', CHROME_PATH);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  async function takeScreenshot(url, filename, options = {}) {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    if (options.before) {
      await options.before(page);
    }

    await new Promise(r => setTimeout(r, options.delay || 1500));

    const localPath = path.join(OUT_DIR, filename);
    await page.screenshot({ path: localPath, fullPage: options.fullPage || false });
    console.log(` Saved: ${localPath}`);

    // Also copy to artifact directory
    if (fs.existsSync(ARTIFACT_DIR)) {
      const artPath = path.join(ARTIFACT_DIR, filename);
      fs.copyFileSync(localPath, artPath);
    }
  }

  try {
    // 1. Home Page
    await takeScreenshot('http://localhost:5000/', 'screenshot_01_home.png');

    // 2. Campaigns Directory
    await takeScreenshot('http://localhost:5000/campaigns', 'screenshot_02_campaigns.png');

    // 3. Campaign Detail + Donate Modal
    await takeScreenshot('http://localhost:5000/campaigns', 'screenshot_03_campaign_donate.png', {
      before: async (p) => {
        await p.waitForSelector('.campaign-card button', { timeout: 10000 });
        const btns = await p.$$('.campaign-card button');
        if (btns.length > 0) {
          await btns[0].click();
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    });

    // 4. Volunteer Drives Directory
    await takeScreenshot('http://localhost:5000/drives', 'screenshot_04_volunteer_drives.png');

    // 5. Drive Detail + Join Flow Modal
    await takeScreenshot('http://localhost:5000/drives', 'screenshot_05_drive_join_pass.png', {
      before: async (p) => {
        await p.waitForSelector('.opp-card button, .drive-card button', { timeout: 10000 });
        const btns = await p.$$('.opp-card button, .drive-card button');
        if (btns.length > 0) {
          await btns[0].click();
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    });

    // 6. Unified Authentication Page (Sign In & Sign Up)
    await takeScreenshot('http://localhost:5000/auth', 'screenshot_06_auth.png');

    // Helper to log in as specific role persona
    async function loginAs(email, password) {
      await page.goto('http://localhost:5000/auth', { waitUntil: 'networkidle2' });
      await page.evaluate(() => {
        localStorage.clear();
      });
      await page.goto('http://localhost:5000/auth', { waitUntil: 'networkidle2' });
      await page.type('#loginEmail', email);
      await page.type('#loginPassword', password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));
    }

    // 7. Volunteer Dashboard (Aarav Patel)
    await loginAs('aarav@impacthub.org', 'password123');
    await takeScreenshot('http://localhost:5000/dashboard', 'screenshot_07_dashboard_volunteer.png');

    // 8. Donor Dashboard (Priya Sharma)
    await loginAs('priya@impacthub.org', 'password123');
    await takeScreenshot('http://localhost:5000/dashboard', 'screenshot_08_dashboard_donor.png');

    // 9. NGO Dashboard (Dr. Radhika Sen - Green Earth Foundation)
    await loginAs('radhika@impacthub.org', 'password123');
    await takeScreenshot('http://localhost:5000/dashboard', 'screenshot_09_dashboard_ngo.png');

    // 10. Admin Dashboard
    await loginAs('admin@impacthub.org', 'admin12345');
    await takeScreenshot('http://localhost:5000/dashboard', 'screenshot_10_dashboard_admin.png');

    // 11. Rewards & Gamification Leaderboard
    await takeScreenshot('http://localhost:5000/leaderboard', 'screenshot_11_leaderboard_rewards.png');

    console.log(' All 11 screenshots successfully captured and copied to artifacts!');
  } catch (err) {
    console.error('Screenshot capture failure:', err);
  } finally {
    await browser.close();
  }
}

capture();
