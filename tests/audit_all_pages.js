const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function auditPages() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(os.tmpdir(), 'chrome-audit-' + Date.now());
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 1500));

  async function inspectUrl(url) {
    console.log(`\n========================================\nINSPECTING: ${url}\n========================================`);
    const pageTarget = await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent(url), { method: 'PUT' }).then(r => r.json());
    const wsUrl = pageTarget.webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);
    let idCounter = 1;
    const callbacks = new Map();

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = idCounter++;
        callbacks.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const consoleLogs = [];
    const errors = [];

    await new Promise((resolve) => {
      ws.onopen = async () => {
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Console.enable');
        await send('DOM.enable');

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id && callbacks.has(msg.id)) {
            callbacks.get(msg.id).resolve(msg.result);
            callbacks.delete(msg.id);
          } else if (msg.method === 'Runtime.consoleAPICalled') {
            const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
            consoleLogs.push(`[${msg.params.type}] ${text}`);
          } else if (msg.method === 'Runtime.exceptionThrown') {
            const ex = msg.params.exceptionDetails;
            errors.push(`EXCEPTION: ${ex.text} - ${ex.exception ? ex.exception.description : ''}`);
          }
        };

        // Give page 2.5s to render completely and execute async fetches
        await new Promise(r => setTimeout(r, 2500));

        // Evaluate DOM details
        const domInfo = await send('Runtime.evaluate', {
          expression: `(() => {
            const cards = document.querySelectorAll('.opp-card, .campaign-card, .ngo-card, .card');
            const oppCards = document.querySelectorAll('.opp-card');
            const grid = document.getElementById('opportunitiesGrid');
            const myApps = document.getElementById('myApplicationsContainer');
            const navAuth = document.querySelector('.nav-auth-slot, .user-profile-menu-wrap');
            const userNavName = document.querySelector('.user-nav-name');

            // Audit all buttons and links
            const interactive = Array.from(document.querySelectorAll('button, a, input[type="submit"]')).map(el => {
              const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.className).trim().replace(/\\s+/g, ' ');
              const href = el.getAttribute('href');
              const onclick = el.getAttribute('onclick');
              const id = el.id;
              return { tag: el.tagName, text: text.slice(0, 40), href, onclick: onclick ? onclick.slice(0, 40) : null, id };
            });

            return {
              title: document.title,
              oppCardsCount: oppCards.length,
              gridHtmlSnippet: grid ? grid.innerHTML.slice(0, 300) : null,
              myAppsHtmlSnippet: myApps ? myApps.innerHTML.slice(0, 300) : null,
              navUserText: userNavName ? userNavName.textContent.trim() : (navAuth ? navAuth.textContent.trim() : null),
              interactiveElementsCount: interactive.length,
              interactiveSamples: interactive
            };
          })()`,
          returnByValue: true
        });

        console.log('Result for ' + url + ':');
        console.log('DOM Info:', JSON.stringify(domInfo.result.value, null, 2));
        console.log('Console Logs (' + consoleLogs.length + '):', consoleLogs);
        console.log('Errors/Exceptions (' + errors.length + '):', errors);

        // Close page
        await fetch('http://127.0.0.1:9222/json/close/' + pageTarget.id);
        ws.close();
        resolve();
      };
    });
  }

  try {
    const urls = [
      'http://localhost:5000/index.html',
      'http://localhost:5000/campaigns.html',
      'http://localhost:5000/ngos.html',
      'http://localhost:5000/volunteer.html',
      'http://localhost:5000/about.html',
      'http://localhost:5000/contact.html',
      'http://localhost:5000/dashboard.html'
    ];

    for (const url of urls) {
      await inspectUrl(url);
    }
  } finally {
    chrome.kill();
  }
}

auditPages().catch(console.error);
