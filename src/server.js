import '@soundworks/helpers/polyfills.js';
import '@soundworks/helpers/catch-unhandled-errors.js';
import { Server } from '@soundworks/core/server.js';
import { loadConfig, configureHttpRouter } from '@soundworks/helpers/server.js';

import PluginSync from '@soundworks/plugin-sync/server.js';
import PluginLogger from '@soundworks/plugin-logger/server.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

const config = loadConfig(process.env.ENV, import.meta.url);

console.log(`
--------------------------------------------------------
- launching "${config.app.name}" in "${process.env.ENV || 'default'}" environment
- [pid: ${process.pid}]
--------------------------------------------------------
`);

const server = new Server(config);
configureHttpRouter(server);

// Register plugins and create shared state classes
server.pluginManager.register('sync', PluginSync);
server.pluginManager.register('logger', PluginLogger, {
  dirname: 'logs',
});

server.stateManager.defineClass('comote', {
  // unique id of the client, keep track of a given phone between different reloads
  uuid: {
    type: 'string',
    required: true,
  },
  // whether some sensor data has been receive in the last 100 ms (arbitrary value)
  isSourceActive: {
    type: 'boolean',
    default: false,
  },
  // some processed value that could be used in realtime, send to MAX through OSC, etc.
  realTimeData: {
    type: 'any',
    event: true,
    acknowledge: false,
  },
});

await server.start();

// and do your own stuff!

// collection of all 'comote' shared state, can be used to pipe data to Max for example
const comote = await server.stateManager.getCollection('comote');
comote.onUpdate((state, updates) => {
  // do something
});

