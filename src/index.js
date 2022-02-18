// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import {BenchmarkBasePath} from './benchmark';
import {readTextFile, runBenchmark} from './benchmark-utils';

describe('Benchmark', ()=> {
    let config;
    const results = [];
    const profile = __karma__.config.profile;

    before('Prepare benchmark', async ()=> {
        const configFilePath = `${BenchmarkBasePath}/${__karma__.config.runConfig}`;
        const result = await readTextFile(configFilePath);
        config = JSON.parse(result);

        console.log(`browser: ${__karma__.config.browser[0]}`)
        if (profile) {
            console.log("Start profiling");
        }

        console.log(`Start benchmark: ${config.benchmarkName}`);
    });

    it('benchmark run ', async ()=> {
        await config.frameworksToTest.reduce(async (frameworkPromise, framework) => {
            await frameworkPromise;
            await config.backendsToTest.reduce(async (backendPromise, backend) => {
                await backendPromise;
                const result = await runBenchmark(config, framework, backend, profile);
                results.push(result);
                await new Promise(r => setTimeout(r, 1000));
            }, Promise.resolve);
        }, Promise.resolve);
    });

    after('printing results', ()=> {
        console.log(`Benchmark Results:${JSON.stringify(results)}`);
    });
});