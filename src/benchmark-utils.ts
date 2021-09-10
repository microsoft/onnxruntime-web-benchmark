// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import {OrtWebBenchmark} from './ort-web-benchmark';
import {TensorFlowBenchmark} from './tfjs-benchmark';

export interface BenchmarkResult {
  framework: string;
  backend: string;
  duration: number;
}

export const readTextFile = async (file: string): Promise<string> => {
  var xhr = new XMLHttpRequest();
  return new Promise(function(resolve) {
    xhr.overrideMimeType("application/json");
    xhr.open("GET", file, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
          resolve(xhr.responseText);
      }
    }
    xhr.send(null)
  });
}

const createBenchmark = (framework: string): TensorFlowBenchmark|OrtWebBenchmark => {
  switch (framework) {
    case 'tensorflow.js':
      return new TensorFlowBenchmark();
    case 'ort-web':
      return new OrtWebBenchmark();
    default:
      throw new Error("'tensorflow-js' and 'ort-web' are supported.");
  }
}

export const runBenchmark = async (config: any, framework: string, backend: string, profile: boolean): Promise<BenchmarkResult> => {
  console.log(`runBenchmark is being called on ${backend} of ${framework}`);

  const benchmark = createBenchmark(framework);
  await benchmark.init(config, backend, profile);
  const durations = [];

  console.log(`Running ${config.runIteration} iterations.`);

  if (config.warmupIteration && config.warmupIteration > 0) {
    console.log("Running warmup...");
    for(let i = 0 ; i < config.warmupIteration; i++) {
      await benchmark.run();
    }

    console.log("Warmup done");
  }

  for (let i = 0 ; i < config.runIteration; i++) {
    const start = performance.now();
    await benchmark.run();
    const duration = performance.now() - start;
    console.log(`Duration: ${duration}ms`);
    durations.push(duration);
  }

  if (profile) {
    benchmark.endProfiling();
  }

  durations.shift();
  const sum = durations.reduce((a, b) => a + b);
  const avg = sum / durations.length;
  console.log(`avg duration: ${avg}`);

  return {
    framework: framework,
    backend: backend,
    duration: avg
  };
}