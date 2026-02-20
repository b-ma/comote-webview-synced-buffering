import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/browser.js';
import { html, render } from 'lit';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-status.js';
import '@ircam/sc-components/sc-number.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

async function main($container) {
  const config = loadConfig();
  const client = new Client(config);

  // cf. https://soundworks.dev/tools/helpers.html#browserlauncher
  launcher.register(client, {
    initScreensContainer: $container,
    reloadOnVisibilityChange: false,
  });

  await client.start();

  const comoteCollection = await client.stateManager.getCollection('comote');
  comoteCollection.onChange(() => renderApp(), true);

  function renderApp() {
    render(html`
      <div class="controller-layout">
        <header>
          <h1>${client.config.app.name} | ${client.role}</h1>
          <sw-audit .client="${client}"></sw-audit>
        </header>
        <section>
          ${comoteCollection.map(state => {
            return html`
              <div>
                <div>
                  <sc-text>uuid</sc-text>
                  <sc-text>${state.get('uuid')}</sc-text>
                </div>
                <div>
                  <sc-text>isSourceActive</sc-text>
                  <sc-status ?active=${state.get('isSourceActive')}></sc-status>
                </div>
                <div>
                  <sc-text>realTimeData</sc-text>
                  <sc-number value=${state.get('realTimeData')}></sc-number>
                </div>
              </div>
            `
          })}
        </section>
      </div>
    `, $container);
  }
}

launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate') || '') || 1,
  width: '50%',
});
