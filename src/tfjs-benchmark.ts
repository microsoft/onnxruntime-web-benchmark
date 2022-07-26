// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as tf from '@tensorflow/tfjs';
import {setThreadsCount} from '@tensorflow/tfjs-backend-wasm';
import '@tensorflow/tfjs-backend-webgpu';
import {Benchmark, BenchmarkBasePath} from './benchmark';
import {EnvironmentFlags} from './benchmark-utils';

type TensorflowModelType = tf.GraphModel|tf.LayersModel;
type TensorflowIOType = tf.Tensor<tf.Rank>|tf.Tensor<tf.Rank>[];
type TensorflowExecType = 'execute'|'executeAsync'|'predict'|undefined;

export class TensorFlowBenchmark implements Benchmark {
  #model: TensorflowModelType;
  #input: TensorflowIOType;
  #execType: TensorflowExecType;
  #environmentFlags: EnvironmentFlags;

  #useAsyncRead: boolean;

  async init(config: any, backend: string, profile: boolean): Promise<void> {
    tf.env().set('WEBGL_PACK', !!config.tfjs.webgl.pack);
    console.log(`Tfjs pack mode enabled: ${tf.env().getBool('WEBGL_PACK')}`);

    console.log(`Setting the backend to ${backend}`);
    if (config.tfjs.wasm.threading !== undefined ||
      (config.tfjs.wasm.numThreads !== undefined && config.tfjs.wasm.numThreads !== 1)) {
      tf.env().set('WASM_HAS_MULTITHREAD_SUPPORT', config.tfjs.wasm.threading !== undefined ? config.tfjs.wasm.threading : true);
      if (config.tfjs.wasm.numThreads !== undefined && config.tfjs.wasm.numThreads > 1) {
        setThreadsCount(config.tfjs.wasm.numThreads);
      }
    }
    if (config.tfjs.wasm.simd !== undefined) {
      tf.env().set('WASM_HAS_SIMD_SUPPORT', config.tfjs.wasm.simd);
    }
    await tf.setBackend(backend);
    this.#useAsyncRead = backend === 'webgpu' ? true : false;
    await tf.ready();
    console.log('Set the backend to' + JSON.stringify(tf.getBackend()));

    const modelPath = isHttpUrl(config.tfjs.path) ? config.tfjs.path : `${BenchmarkBasePath}/${config.tfjs.path}`;

    // first try to load it as layers model
    try {
      this.#model = await tf.loadLayersModel(modelPath);
    }
    catch (e) {
      // then try loading as graph model
      this.#model = await tf.loadGraphModel(modelPath);
    }

    this.#environmentFlags = new EnvironmentFlags();
    this.#environmentFlags.webglPack = Boolean(tf.env().getBool('WEBGL_PACK'));
    this.#environmentFlags.wasmThreads = Boolean(tf.env().getAsync('WASM_HAS_MULTITHREAD_SUPPORT'));
    this.#environmentFlags.wasmSimd = Boolean(tf.env().getAsync('WASM_HAS_SIMD_SUPPORT'));
    this.#environmentFlags.actualBackend = String(tf.getBackend());

    this.#input = generateInputs(this.#model, config.tfjs.shape);
    this.#execType = await getExecType(this.#model, this.#input);
  }

  async run(): Promise<any[]|Uint8Array|Float32Array|Int32Array> {
    const output = await run(this.#model, this.#input, this.#execType);
    let outputData;
    if (!Array.isArray(output)) {
      if (this.#useAsyncRead) {
        outputData = await output.data();
      } else {
        outputData = output.dataSync();
      }
    } else {
      outputData = new Array(output.length);
      for (const o of output) {
        if (this.#useAsyncRead) {
          outputData.push(await o.data());
        } else {
          outputData.push(o.dataSync());
        }
      }
    }
    return outputData;
  }

  endProfiling() {}

  async getEnvironmentFlags(): Promise<EnvironmentFlags> {
    return this.#environmentFlags;
  }
}

type ShapeConfig = {[name: string]: number[]};

const getExecType = async(model: TensorflowModelType, input: TensorflowIOType): Promise<TensorflowExecType> => {
  if (model instanceof tf.GraphModel) {
    try {
      model.execute(input);
      return 'execute';
    } catch (e) {
      await model.executeAsync(input);
      return 'executeAsync';
    }
  } else if (model instanceof tf.LayersModel) {
    model.predict(input);
    return 'predict';
  } else {
    throw new Error(
      'Predict function was not found. Please provide a tf.GraphModel or ' +
      'tf.LayersModel');
  }
}

const run = async(model: TensorflowModelType, input: TensorflowIOType, execType: TensorflowExecType): Promise<TensorflowIOType> => {
  switch (execType) {
    case 'execute':
      return (model as tf.GraphModel).execute(input);
    case 'executeAsync':
      return await (model as tf.GraphModel).executeAsync(input);
    case 'predict':
      return (model as tf.LayersModel).predict(input);
    default:
      throw new Error('Wrong execution type is given: ' + execType)
  }
}

const generateInputs = (model: TensorflowModelType, shapeConfig: ShapeConfig): TensorflowIOType => {
  const inputs: tf.Tensor<tf.Rank>[] = [];

  model.inputs.forEach((node: any) => {
    let shape;
    if (shapeConfig !== undefined && shapeConfig.hasOwnProperty(node.name)) {
      shape = shapeConfig[node.name];
    } else {
      shape = node.shape!.map((value: number, index: number) => {
        if (value === null || value <= 0) {
          // Only batch size is allowed to set
          if (index !== 0) {
            throw new Error("Input shape must be manually defined.");
          }
          return 1;
        } else {
          return value;
        }
      });
    }

    const tensor = tf.ones(shape, node.dtype);
    inputs.push(tensor);
  });

  return inputs;
}

const isHttpUrl = (path: string): boolean => {
  try {
    const uri = new URL(path);
    return uri.protocol === "http:" || uri.protocol === "https:";
  } catch (_) {
    return false;
  }
}