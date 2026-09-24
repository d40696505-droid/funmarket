const { chromium } = require('/root/funmarket/frontend/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('file:///root/funmarket/docs/investor-deck/deck.html', { waitUntil: 'networkidle' });
  await p.pdf({ path: '/root/funmarket/docs/investor-deck/HobbyHub-investor-deck.pdf', width: '1280px', height: '720px', printBackground: true });
  await b.close();
})();
