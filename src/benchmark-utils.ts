// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import {OrtWebBenchmark} from './ort-web-benchmark';
import {TensorFlowBenchmark} from './tfjs-benchmark';

export interface BenchmarkResult {
  framework: string;
  backend: string;
  actualBackend: string;
  avg: number; 
  p50: number; 
  p95: number; 
  p99: number; 
  min: number; 
  max: number; 
  webglPack: boolean;
  wasmThreads: boolean|number;
  wasmSimd: boolean;
}

export class EnvironmentFlags{
  webglPack: boolean;
  wasmThreads: boolean|number;
  wasmSimd: boolean;
  actualBackend: string;
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
  const environmentFlags = await benchmark.getEnvironmentFlags();
  const durations = [];

  if (config.warmupIteration && config.warmupIteration > 0) {
    console.log("Running warmup...");
    for(let i = 0 ; i < config.warmupIteration; i++) {
      await benchmark.run();
    }
    console.log("Warmup done");
  }

  let end_time = 0;
  if (config.min_queries > 0 && config.min_duration > 0) {
    // mlperf style min_queries and min_duration number of iterations
    config.runIteration = Number.MAX_VALUE;
    end_time = performance.now() + config.min_duration * 1000;
    console.log(`Running for at least ${config.min_queries} iterations and ${config.min_duration} seconds.`);
  } else {
    console.log(`Running ${config.runIteration} iterations.`);
  }

  
  for (let i = 0 ; i < config.runIteration; i++) {
    const start = performance.now();
    await benchmark.run();
    const now = performance.now();
    durations.push(now - start);
    if (now > end_time && i > config.min_queries)
      break;
  }

  if (profile) {
    benchmark.endProfiling();
  }

  durations.shift();
  const sum = durations.reduce((a, b) => a + b);
  const avg = sum / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const p50 = calculatePercentile(50, durations);
  const p95 = calculatePercentile(95, durations);
  const p99 = calculatePercentile(99, durations);
  console.log(`avg duration: ${avg}`);
  console.log(`min duration: ${min}`);
  console.log(`max duration: ${max}`);
  console.log(`p50 duration: ${p50}`);
  console.log(`p95 duration: ${p95}`);
  console.log(`p99 duration: ${p99}`);

  return {
    framework: framework,
    backend: backend,
    actualBackend: environmentFlags.actualBackend,
    avg: avg,
    p50: p50,
    p95: p95,
    p99: p99,
    min: min,
    max: max,
    webglPack: environmentFlags.webglPack,
    wasmThreads: environmentFlags.wasmThreads,
    wasmSimd: environmentFlags.wasmSimd
  };
}

const calculatePercentile = (percentile: number, numbers: number[]) => {
  numbers.sort(function(a, b){return a - b}); // increasing. 
  var pos = Math.ceil(percentile / 100.0 * numbers.length) - 1;
  return numbers[pos];
}