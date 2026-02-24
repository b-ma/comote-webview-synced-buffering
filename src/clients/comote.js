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

  // Get and retrieve unique id across page reloads
  let uuid;
  if (localStorage.getItem('uuid')) {
    uuid = localStorage.getItem('uuid');
  } else {
    uuid = uuidv4();
    localStorage.setItem('uuid', uuid);
  }

  // The writer will automatically buffer the data and write it in the filesystem
  // on the server-side (bufferSize value is completely arbitrary here)
  const writer = await logger.createWriter(uuid, { bufferSize: 100 });
  const state = await client.stateManager.create('comote', { uuid });
  state.onUpdate(() => renderApp());

  let activeTimeoutId = null;
  let debug = true;

  // This event is created by comote, `e.detail` contains the sensors frame
  window.addEventListener('comote', (e) => {
    clearTimeout(activeTimeoutId);

    // Time tag data with synchronized clock to realign everything later (for analysis)
    const frame = e.detail;
    const syncTime = sync.getSyncTime();
    frame.syncTime = syncTime;

    if (debug) {
      const $debug = document.querySelector('#debug');
      if ($debug) {
        $debug.innerText = JSON.stringify(frame, null, 2);
      }
    }

    // Store raw data with synchronized time tag.
    // - Frame is just stored as is (JSON stringified) but could be formatted differently
    // - Each `write` correspond to a new line in the log file
    writer.write(frame);

    // Toy example of processing some stuff for real-time usage
    // (this could perfectly live in a lower frame-rate routine)
    const someProcessedValue = frame.accelerometer.x * 2; // :)

    state.set({
      realTimeData: someProcessedValue, // this value won't be propagated back to the client
      isSourceActive: true, // if the value doesn't change, it won't be propagated on the network
    });

    // If no frame received in 100ms for some reason, mark the source as inactive
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
