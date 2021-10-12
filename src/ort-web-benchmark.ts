// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import {Benchmark, BenchmarkBasePath} from './benchmark';
import Long from 'long';
import {flatbuffers} from 'flatbuffers';
import {onnx} from 'onnx-proto';
import {onnxruntime} from './ort-schema/ort-generated';
import * as ort from 'onnxruntime-web';
import ortFbs = onnxruntime.experimental.fbs;

export class OrtWebBenchmark implements Benchmark {
  #modelPath: string;
  #session: ort.InferenceSession;
  #input: ort.SessionHandler.FeedsType;

  async init(config: any, backend: string, profile: boolean): Promise<void> {
    ort.env.logLevel = profile ? 'verbose' : config.logLevel;

    if (config.ortweb.webgl.pack !== undefined) {
      ort.env.webgl.pack = config.ortweb.webgl.pack;
    }
    if (config.ortweb.webgl.contextId !== undefined) {
      ort.env.webgl.contextId = config.ortweb.webgl.contextId;
    }
    if (config.ortweb.wasm.numThreads !== undefined) {
      ort.env.wasm.numThreads = config.ortweb.wasm.numThreads;
    }
    if (config.ortweb.wasm.simd !== undefined) {
      ort.env.wasm.simd = config.ortweb.wasm.simd;
    }
    if (config.ortweb.wasm.proxy !== undefined) {
      ort.env.wasm.proxy = config.ortweb.wasm.proxy;
    }
    if (config.ortweb.wasm.initTimeout !== undefined) {
      ort.env.wasm.initTimeout = config.ortweb.wasm.initTimeout;
    }

    console.log(`ort-web Pack mode enabled: ${ort.env.webgl.pack}`);

    this.#modelPath= `${BenchmarkBasePath}/${config.ortweb.path}`;
    this.#session = await ort.InferenceSession.create(this.#modelPath,
                                                      {
                                                        executionProviders: [backend],
                                                        enableProfiling: profile
                                                      });
    console.log(`Session initialized with: ${backend} backend(s).`);

    if (profile) {
      this.#session.startProfiling();
    }

    this.#input = await generateInputs(this.#modelPath, config.ortweb.shape);

    await new Promise(r => setTimeout(r, 3000));
  }

  async run(): Promise<ort.InferenceSession.OnnxValueMapType> {
    const outputData = await this.#session.run(this.#input);
    return outputData;
  }

  endProfiling() {
    this.#session.endProfiling();
  }
}

interface Metadata {
  name: string;
  dataType: number;
  shape: number[];
}

type ShapeConfig = {[name: string]: number[]};

const generateInputs = async (uri: string, shapeConfig: ShapeConfig): Promise<ort.SessionHandler.FeedsType> => {
  const metadata = await loadModel(uri);

  let inputs: ort.SessionHandler.FeedsType = {};
  metadata.forEach(data => {
    let shape;
    if (shapeConfig !== undefined && shapeConfig.hasOwnProperty(data.name)) {
      shape = shapeConfig[data.name];
    } else {
      shape = data.shape.map((value, index) => {
        if (value <= 0) {
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
    let size = 1;
    shape.map(i => size *= i);
    inputs[data.name] = generateTensor(data.dataType, size, shape);
  });

  return inputs;
}

const loadModel = async (uri: string): Promise<Metadata[]> => {
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  if (uri.endsWith('.onnx')) {
    return loadOnnxModel(buffer);
  } else if (uri.endsWith('.ort')) {
    return loadOrtModel(buffer);
  } else {
    throw new Error('Unknown model: ' + uri);
  }
}

const loadOnnxModel = async (buffer: Uint8Array): Promise<Metadata[]> => {
  const modelProto = onnx.ModelProto.decode(buffer);
  const graph = modelProto.graph!;

  if (!graph.initializer) {
    throw new Error("Missing graph initializer");
  }

  const initializers = new Set<string>();
  for (const initializer of graph.initializer!) {
    initializers.add(initializer.name!);
  }

  const metadata: Metadata[] = [];
  for (const input of graph.input!) {
    if (initializers.has(input.name!)) {
      continue;
    }
    const shape: number[] = input.type!.tensorType!.shape!.dim!.map((d, i) => {
      let value = d.dimValue!;
      return Long.isLong(value) ? value.toNumber(): value;
    });
    metadata.push({
      name: input.name!,
      dataType: input.type!.tensorType!.elemType!,
      shape
    });
  }
 
  return metadata;
}

const loadOrtModel = async (buffer: Uint8Array): Promise<Metadata[]> => {
  const fb = new flatbuffers.ByteBuffer(buffer);
  const model = ortFbs.InferenceSession.getRootAsInferenceSession(fb).model()!;
  const graph = model.graph()!;

  const initializers = new Set<string>();
  for (let i = 0; i < graph.initializersLength(); i++) {
    const initializer = graph.initializers(i)!;
    initializers.add(initializer.name()!);
  }

  const metadata: Metadata[] = [];
  for (let i = 0; i < graph.inputsLength(); ++i) {
    const inputName = graph.inputs(i);
    if (initializers.has(inputName)) {
      continue;
    }

    for (let j = 0; j < graph.nodeArgsLength(); ++j) {
      if (graph.nodeArgs(j)?.name() === inputName) {
        const value = graph.nodeArgs(j)!.type()!.value(new ortFbs.TensorTypeAndShape())!;

        const shape = value.shape()!;
        const dims: number[] = [];
        for (let k = 0; k < shape.dimLength()!; k++) {
          const dim = shape.dim(k)!.value()!.dimValue()!;
          const value = Long.fromValue({low: dim.low, high: dim.high, unsigned: true}).toNumber();
          dims.push(value);
        }

        metadata.push({
          name: inputName,
          dataType: value.elemType(),
          shape: dims
        });

        break;
      }
    }
  }
 
  return metadata;
}

const generateTensor = (dataType: number, size: number, shape: number[]): ort.Tensor => {
  switch (dataType) {
    case onnx.TensorProto.DataType.FLOAT:
      return new ort.Tensor(Float32Array.from({length: size}, () => 1), shape);
    case onnx.TensorProto.DataType.DOUBLE:
      return new ort.Tensor(Float64Array.from({length: size}, () => 1), shape);
    case onnx.TensorProto.DataType.UINT8:
      return new ort.Tensor(Uint8Array.from({length: size}, () => 1), shape);
    case onnx.TensorProto.DataType.INT8:
      return new ort.Tensor(Int8Array.from({length: size}, () => 1), shape);
    case onnx.TensorProto.DataType.UINT16:
      return new ort.Tensor(Uint16Array.from({length: size}, () => 1), shape);
    case onnx.TensorProto.DataType.INT16:
      return new ort.Tensor(Int16Array.from({length: size}, () => 1), shape);
    case onnx.TensorProto.DataType.UINT32:
      return new ort.Tensor(Uint32Array.from({length: size}, () => 1), shape);
    case onnx.TensorProto.DataType.INT32:
      return new ort.Tensor(Int32Array.from({length: size}, () => 1), shape);
    case onnx.TensorProto.DataType.UINT64:
      return new ort.Tensor(BigUint64Array.from({length: size}, () => BigInt(1)), shape);
    case onnx.TensorProto.DataType.INT64:
      return new ort.Tensor(BigInt64Array.from({length: size}, () => BigInt(1)), shape);
    case onnx.TensorProto.DataType.STRING:
      throw new Error("Can't support STRING tensor");
    case onnx.TensorProto.DataType.FLOAT16:
      throw new Error("Can't support FLOAT16 tensor");
    case onnx.TensorProto.DataType.BFLOAT16:
      throw new Error("Can't support BFLOAT16 tensor");
    case onnx.TensorProto.DataType.COMPLEX64:
      throw new Error("Can't support COMPLEX64 tensor");
    case onnx.TensorProto.DataType.COMPLEX128:
      throw new Error("Can't support COMPLEX128 tensor");
  }

  throw new Error("Input tensor type is unknown");
}