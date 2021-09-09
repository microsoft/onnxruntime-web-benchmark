// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as ort from 'onnxruntime-web';

export const BenchmarkBasePath = '/base';

export interface Benchmark {
  init(config: any, backend: string, profile: boolean): Promise<void>;
  run(): Promise<any[]|Uint8Array|Float32Array|Int32Array|ort.InferenceSession.OnnxValueMapType>;
  endProfiling(): void;
}