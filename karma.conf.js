// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

// Karma configuration
const path = require('path')
const fs = require('fs');

module.exports = function(config) {
  let runConfigFile = config.run_config ? config.run_config : 'run_config.json';
  if (!fs.existsSync(runConfigFile) && !fs.existsSync(path.resolve(__dirname, runConfigFile))){
    runConfigFile = 'run_config.json';
    if(!fs.existsSync(path.resolve(__dirname, runConfigFile))) {
      throw new Error("Couldn't find any configuration file. Set a configuration as '--run_config=<config file>'or put run_config.json in root.");
    }
  }

  const configFileObj = require(path.resolve(__dirname, runConfigFile));
  const runWebGpu = configFileObj && Array.isArray(configFileObj.backendsToTest) && configFileObj.backendsToTest.indexOf('webgpu') > -1;

  const chromeBrowserNameBase = runWebGpu ? 'ChromeCanary' : 'Chrome';
  const chromeBrowserTestFlags = ['--window-size=1,1', '--enable-features=SharedArrayBuffer'];
  if (runWebGpu) { chromeBrowserTestFlags.push('--enable-unsafe-webgpu') }
  const chromeBrowserDebugFlags = ['--remote-debugging-port=9333', '--enable-features=SharedArrayBuffer'];
  if (runWebGpu) { chromeBrowserDebugFlags.push('--enable-unsafe-webgpu') }

  config.set({
    basePath: './',
    frameworks: ['mocha'],
    files: [
      { pattern: 'dist/tf.min.js' },
      { pattern: 'dist/tf-backend-wasm.min.js' },
      { pattern: 'dist/tf-backend-webgpu.min.js' },
      { pattern: 'dist/ort-common.min.js' },
      { pattern: 'dist/ort-web.min.js' },
      { pattern: 'dist/main.js' },
      { pattern: 'dist/ort-wasm.wasm', included: false},
      { pattern: 'dist/ort-wasm-simd.wasm', included: false},
      { pattern: 'dist/ort-wasm-threaded.wasm', included: false},
      { pattern: 'dist/ort-wasm-threaded.worker.js', included: false},
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
      '/ort-wasm-threaded.worker.js': '/base/dist/ort-wasm-threaded.worker.js',
      '/tfjs-backend-wasm-simd.wasm': '/base/dist/tfjs-backend-wasm-simd.wasm',
      '/tfjs-backend-wasm-threaded-simd.wasm': '/base/dist/tfjs-backend-wasm-threaded-simd.wasm',
      '/tfjs-backend-wasm.wasm': '/base/dist/tfjs-backend-wasm.wasm'
    },
    mime: {
      "text/x-typescript": ["ts"],
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
    customLaunchers: {
      ChromeTest: {base: chromeBrowserNameBase, flags: chromeBrowserTestFlags},
      ChromeDebug: {debug: true, base: chromeBrowserNameBase, flags: chromeBrowserDebugFlags}
    },
    client: {
      captureConsole: true,
      mocha: {expose: ['body'], timeout: 3000000},
      browser: config.browsers,
      printMatches: false,
      // To use custom config, run 'npm run benchmark --run_config=config_file_name'
      runConfig: runConfigFile,
      profile: config.profile
    },
    browsers: ['ChromeTest', 'ChromeDebug', 'Edge', 'Safari'],
    browserConsoleLogOptions: {level: "debug", format: "%b %T: %m", terminal: true}
  });
}
