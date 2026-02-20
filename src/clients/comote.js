import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/browser.js';
import PluginSync from '@soundworks/plugin-sync/client.js';
import PluginLogger from '@soundworks/plugin-logger/client.js';

import { html, render } from 'lit';
import { v4 as uuidv4 } from 'uuid';

import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-status.js';
import '@ircam/sc-components/sc-number.js';
import '@ircam/sc-components/sc-fullscreen.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

async function main($container) {
  const config = loadConfig();
  const client = new Client(config);

  // Eventually register plugins
  client.pluginManager.register('sync', PluginSync);
  client.pluginManager.register('logger', PluginLogger);

  // cf. https://soundworks.dev/tools/helpers.html#browserlauncher
  launcher.register(client, { initScreensContainer: $container });

  await client.start();

  const sync = await client.pluginManager.get('sync');
  const logger = await client.pluginManager.get('logger');

  // get unique id across reload
  let uuid;
  if (localStorage.getItem('uuid')) {
    uuid = localStorage.getItem('uuid');
  } else {
    uuid = uuidv4();
    localStorage.setItem('uuid', uuid);
  }

  // the writer will automatically buffer the data
  const writer = await logger.createWriter(uuid, { bufferSize: 100 });
  const state = await client.stateManager.create('comote', { uuid });
  state.onUpdate(() => renderApp());

  let activeTimeoutId = null;
  let debug = true;

  window.addEventListener('comote', (e) => {
    clearTimeout(activeTimeoutId);

    const frame = e.detail;
    const syncTime = sync.getSyncTime();
    frame.syncTime = syncTime;

    if (debug) {
      const $debug = document.querySelector('#debug');
      if ($debug) {
        $debug.innerText = JSON.stringify(frame, null, 2);
      }
    }

    // store raw data with synchronized time tag to realign everything for analysis
    writer.write(frame);

    // example of processing some stuff for real-time usage
    const someProcessedValue = frame.accelerometer.x * 2; // :)

    state.set({
      realTimeData: someProcessedValue,
      isSourceActive: true, // note that if value doesn't change, it won't be propagated on the network
    });

    // if no frame received in 100ms, mark source as inactive
    activeTimeoutId = setTimeout(() => {
      state.set({ isSourceActive: false });
    }, 100);
  });

  function renderApp() {
    render(html`
      <div class="simple-layout">
        <sc-icon
          type="fullscreen"
          style="position: absolute; top: 10px; right: 10px;"
          @input=${() => window.toggleModal()}
        ></sc-icon>
        <div>
          <sc-text>uuid</sc-text>
          <sc-text style="width: 300px">${state.get('uuid')}</sc-text>
        </div>
        <div>
          <sc-text>isSourceActive</sc-text>
          <sc-status ?active=${state.get('isSourceActive')}></sc-status>
        </div>
        <div>
          <sc-text>realTimeData</sc-text>
          <sc-number value=${state.get('realTimeData')}></sc-number>
        </div>

        <div id="debug"></div>
        <sw-credits .infos="${client.config.app}"></sw-credits>
      </div>
    `, $container);
  }

  renderApp();
}

// The launcher allows to launch multiple clients in the same browser window
// e.g. `http://127.0.0.1:8000?emulate=10` to run 10 clients side-by-side
launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate') || '') || 1,
});
