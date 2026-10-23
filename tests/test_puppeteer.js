const puppeteer = require('puppeteer-core');

async function testAudit() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => pageErrors.push(err.toString()));

  console.log('Navigating to http://localhost:5000/volunteer.html...');
  await page.goto('http://localhost:5000/volunteer.html', { waitUntil: 'networkidle0' });

  const data = await page.evaluate(() => {
    const oppCards = document.querySelectorAll('.opp-card');
    const grid = document.getElementById('opportunitiesGrid');
    const myApps = document.getElementById('myApplicationsContainer');
    const userNavName = document.querySelector('.user-nav-name');
    const navAuth = document.querySelector('.nav-auth-slot');

    return {
      title: document.title,
      oppCardsCount: oppCards.length,
      gridInnerLength: grid ? grid.innerHTML.length : -1,
      gridSnippet: grid ? grid.innerHTML.slice(0, 400) : null,
      myAppsSnippet: myApps ? myApps.innerHTML.slice(0, 200) : null,
      userNavName: userNavName ? userNavName.textContent.trim() : null,
      navAuthSnippet: navAuth ? navAuth.innerHTML.slice(0, 200) : null
    };
  });

  console.log('Volunteer Page Evaluation:');
  console.log(JSON.stringify(data, null, 2));
  console.log('Console messages:', consoleMessages);
  console.log('Page errors:', pageErrors);

  await browser.close();
}

testAudit().catch(console.error);
