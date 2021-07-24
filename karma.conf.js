// Karma configuration
const path = require('path')
const fs = require('fs');

function getMachineIpAddress() {
  var os = require('os');
  var ifaces = os.networkInterfaces();

  for (const ifname in ifaces) {
    for (const iface of ifaces[ifname]) {
      if ('IPv4' !== iface.family || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        continue;
      }

      // returns the first available IP address
      return iface.address;
    }
  }

  // if no available IP address, fallback to "localhost".
  return 'localhost';
}

module.exports = function(config) {
  let runConfigFile = config.run_config ? config.run_config : 'run_config.json';
  if (!fs.existsSync(runConfigFile) && !fs.existsSync(path.resolve(__dirname, runConfigFile))){
    runConfigFile = 'run_config.json';
    if(!fs.existsSync(path.resolve(__dirname, runConfigFile))) {
      throw new Error("Couldn't find any configuration file. Please make sure that RUN_CONFIG is set in env variable or run_config.json exists in root.");
    }
  }
  
  config.set({
    basePath: './',
    frameworks: ['mocha'],
    files: [
      { pattern: 'dist/main.js' },
      { pattern: 'dist/ort-wasm.wasm', included: false},
      { pattern: 'dist/ort-wasm-simd.wasm', included: false},
      { pattern: 'dist/ort-wasm-threaded.wasm', included: false},
      { pattern: 'dist/ort-wasm-simd-threaded.wasm', included: false},
      { pattern: 'dist/tfjs-backend-wasm-simd.wasm', included: false, nocache: true},
      { pattern: 'dist/tfjs-backend-wasm-threaded-simd.wasm', included: false, nocache: true},
	    { pattern: 'dist/tfjs-backend-wasm.wasm', included: false, nocache: true},
      { pattern: 'data/**/*', watched: false, included: false, served: true, nocache: true },
      { pattern: runConfigFile, watched: false, included: false, served: true, nocache: true}
    ],
    proxies: {
      '/ort-wasm.wasm': '/base/dist/ort-wasm.wasm',
      '/ort-wasm-simd.wasm': '/base/dist/ort-wasm-simd.wasm',
      '/ort-wasm-threaded.wasm': '/base/dist/ort-wasm-threaded.wasm',
      '/ort-wasm-simd-threaded.wasm': '/base/dist/ort-wasm-simd-threaded.wasm',
      '/tfjs-backend-wasm-simd.wasm': '/base/dist/tfjs-backend-wasm-simd.wasm',
      '/tfjs-backend-wasm-threaded-simd.wasm': '/base/dist/tfjs-backend-wasm-threaded-simd.wasm',
      '/tfjs-backend-wasm.wasm': '/base/dist/tfjs-backend-wasm.wasm'
	 },
    exclude: [
    ],
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
    },
    reporters: ['mocha'],
    captureTimeout: 120000,
    reportSlowerThan: 100,
    browserDisconnectTimeout: 600000,
    browserNoActivityTimeout: 300000,
    browserDisconnectTolerance: 0,
    browserSocketTimeout: 60000,
    logLevel: config.LOG_VERBOSE,
    hostname: getMachineIpAddress(),
    customLaunchers: {
      ChromeTest: {base: 'Chrome', flags: ['--window-size=1,1',
                                                            '--disable-renderer-backgrounding',
                                                            '--disable-web-security',
                                                            '--disable-site-isolation-trials']},
      ChromeDebug: {debug: true, base: 'Chrome', flags: ['--remote-debugging-port=9333']}
    },
    client: {
      captureConsole: true,
      mocha: {expose: ['body'], timeout: 3000000},
      browser: config.browsers,
      printMatches: false,
      // To use custom config, run 'RUN_CONFIG=config_file_name npm run benchmark'
      runConfig: runConfigFile,
      profile: config.profile
    },
    browsers: ['ChromeTest', 'ChromeDebug', 'Edge', 'Safari'],
    browserConsoleLogOptions: {level: "debug", format: "%b %T: %m", terminal: true},
    autoWatch: false,
    concurrency: Infinity,
    singleRun: true,
  })
}