import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import loadImage from 'blueimp-load-image';
import ndarray from 'ndarray';
import ops from 'ndarray-ops';
import {onnx as onnxProto} from 'onnx-proto';
import * as onnx from 'onnxruntime-web';

import {tensorDataTypeFromProto, tensorDimsFromProto, sizeofProto, readProto, longToNumber} from './index_utils.js'

const SERVER_BASE_PATH = '/base';
const IMAGE_TYPES = ['jpg', 'bmp'];
const PROTO_BUFT_TYPES = ['pb', 'npy'];
const BackendMapping = {
  'ort-web' : {
    'webgl': 'GPU-webgl',
    'wasm': 'wasm',
  },
  'tensorflow.js': {
    'webgl': 'GPU-webgl',
    'wasm': 'wasm',
  },
}

let run_config;
function readTextFile(file) {
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

async function readTextFileAsync(file) {
    const result = await readTextFile(file);
    run_config = JSON.parse(result);
}

const results = [];
const browser = __karma__.config.browser[0];
const profile = __karma__.config.profile;
if(profile) {
    console.log("****Starting profiling****");
}

let runIteration = 10;

class ImageLoader {
    constructor(imageWidth, imageHeight) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = imageWidth;
        this.canvas.height = imageHeight;
        this.ctx = this.canvas.getContext('2d');
    }
    async getImageData(url) {
        await this.loadImageAsync(url);
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        return imageData;
    }
    loadImageAsync(url) {
        return new Promise((resolve, reject)=>{
            this.loadImageCb(url, ()=>{
                resolve();
            });
        });
    }
    loadImageCb(url, cb) {
        loadImage(
            url,
            img => {
                if (img.type === 'error') {
                    throw `Could not load image: ${url}`;
                } else {
                    // load image data onto input canvas
                    this.ctx.drawImage(img, 0, 0)
                    window.setTimeout(() => {  cb();  }, 0);
                }
            },
            {
                maxWidth: this.canvas.width,
                maxHeight: this.canvas.height,
                cover: true,
                crop: true,
                canvas: true,
                crossOrigin: 'Anonymous'
            }
        );
    }
}
function createBenchmark(name) {
    switch (name) {
        case 'tensorflow.js': return new TensorFlowBenchmark();
        case 'ort-web': return new OrtWebBenchmark();
    }
}

function isHttpUrl(string) {
    let url;

    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }

    return url.protocol === "http:" || url.protocol === "https:";
}

function fromProto(tensorProto) {
    if (!tensorProto) {
      throw new Error('cannot construct Value from an empty tensor');
    }
    const type = tensorDataTypeFromProto(tensorProto.dataType, onnxProto.TensorProto);

    const dims = tensorDimsFromProto(tensorProto.dims);
    let n = 1;
    dims.forEach(element => {
        n = n * element;
    });
    let value = Array(n).fill(0);

    if (type === 'string') {
      // When it's STRING type, the value should always be stored in field
      // 'stringData'
      tensorProto.stringData.forEach((str, i) => {
        const buf = Buffer.from(str.buffer, str.byteOffset, str.byteLength);
        value[i] = buf.toString();
      });

    } else if (
        tensorProto.rawData && typeof tensorProto.rawData.byteLength === 'number' &&
        tensorProto.rawData.byteLength > 0) {
      // NOT considering segment for now (IMPORTANT)

      // populate value from rawData
      const dataSource =
          new DataView(tensorProto.rawData.buffer, tensorProto.rawData.byteOffset, tensorProto.rawData.byteLength);
      const elementSize = sizeofProto(tensorProto.dataType, onnxProto.TensorProto);

      const length = tensorProto.rawData.byteLength / elementSize;

      if (tensorProto.rawData.byteLength % elementSize !== 0) {
        throw new Error('invalid buffer length');
      }
      if (value.length !== length) {
        throw new Error('buffer length mismatch');
      }

      for (let i = 0; i < length; i++) {
        const n = readProto(dataSource, tensorProto.dataType, i * elementSize, onnxProto.TensorProto);

        value[i] = n;
      }
    } else {
      // populate value from array
      let array;
      switch (tensorProto.dataType) {
        case onnxProto.TensorProto.DataType.FLOAT:
          array = tensorProto.floatData;
          break;
        case onnxProto.TensorProto.DataType.INT32:
        case onnxProto.TensorProto.DataType.INT16:
        case onnxProto.TensorProto.DataType.UINT16:
        case onnxProto.TensorProto.DataType.INT8:
        case onnxProto.TensorProto.DataType.UINT8:
        case onnxProto.TensorProto.DataType.BOOL:
          array = tensorProto.int32Data;
          break;
        case onnxProto.TensorProto.DataType.INT64:
          array = tensorProto.int64Data;
          break;
        case onnxProto.TensorProto.DataType.DOUBLE:
          array = tensorProto.doubleData;
          break;
        case onnxProto.TensorProto.DataType.UINT32:
        case onnxProto.TensorProto.DataType.UINT64:
          array = tensorProto.uint64Data;
          break;
        default:
          // should never run here
          throw new Error('unspecific error');
      }

      if (array === null || array === undefined) {
        throw new Error('failed to populate data from a tensorproto value');
      }

      if (value.length !== array.length) {
        throw new Error('array length mismatch');
      }

      for (let i = 0; i < array.length; i++) {
        value[i] = array[i];
      }
    }

    return new onnx.Tensor(type, value, dims);
  }

async function runBenchmark(framework, backend) {

    console.log(`runBenchmark is being called with ${framework} ${BackendMapping[framework][backend]},
        ${run_config.inputConfig.inputWidth} x ${run_config.inputConfig.inputHeight}`)

    const impl = createBenchmark(framework);
    await impl.init(backend);
    const imageLoader = new ImageLoader(run_config.inputConfig.inputWidth, run_config.inputConfig.inputHeight);
    const durations = [];

    let benchmarkInputs = [];
    run_config.inputConfig.inputNames.forEach((element, i) => {
        if (!run_config.inputConfig.useSyntheticData) {
            benchmarkInputs.push(
                {
                  name : element,
                  url: run_config.inputConfig.customInputPaths[i].url
                }
            );
        }
        else {
            const arraySize = run_config.inputConfig.inputDepth * run_config.inputConfig.inputHeight * run_config.inputConfig.inputWidth;
            benchmarkInputs.push(
                                {
                                  name : element,
                                  data: Float32Array.from({length: arraySize}, () => Math.floor(Math.random() * 256))
                                }
            );
        }    
    });
                                
    for(const input of benchmarkInputs) {
        console.log(`Running ${input.name} for ${runIteration} iterations.`)
        let inputData = new Object();
        inputData.name = input.name;
        if(!run_config.inputConfig.useSyntheticData) {
            var n = input.url.lastIndexOf('.');
            var type = input.url.substring(n + 1);
            if(!isHttpUrl(input.url)) {
                input.url = `${SERVER_BASE_PATH}/${input.url}`;
            }
            if(IMAGE_TYPES.indexOf(type) >= 0) {
                inputData.data = await imageLoader.getImageData(input.url).data;
            }
            else if (PROTO_BUFT_TYPES.indexOf(type) == 0) {
                const response = await fetch(input.url);
                const file = await response.arrayBuffer();
                const tensorProto = onnxProto.TensorProto.decode(Buffer.from(file));
                inputData.data = fromProto(tensorProto);
            }
            else {
                throw new Error("Unsupprted input type")
            }
        }
        else {
            inputData.data = input.data;
        }

        let expectedOutput = undefined;
        if(run_config.outputConfig) {
            expectedOutput = new Object();
            expectedOutput.name = run_config.outputConfig.name;
            if(!run_config.inputConfig.useSyntheticData) {
                if(run_config.outputConfig.value && run_config.outputConfig.value.length > 0) {
                    expectedOutput.data = new onnx.Tensor("float32", value, run_config.outputConfig.dims);
                }
                else if(run_config.outputConfig.customOutputPath) {
                    if(!isHttpUrl(run_config.outputConfig.customOutputPath)) {
                        run_config.outputConfig.customOutputPath = `${SERVER_BASE_PATH}/${run_config.outputConfig.customOutputPath}`;
                    }

                    var n = run_config.outputConfig.customOutputPath.lastIndexOf('.');
                    var type = run_config.outputConfig.customOutputPath.substring(n + 1);
                    if (PROTO_BUFT_TYPES.indexOf(type) == 0) {
                        const response = await fetch(run_config.outputConfig.customOutputPath);
                        const file = await response.arrayBuffer();
                        const tensorProto = onnxProto.TensorProto.decode(Buffer.from(file));
                        expectedOutput.data = fromProto(tensorProto);
                    }
                    else {
                        throw new Error(`Unsupprted output type ${type}`);
                    }
                }
            }
        }
        if(run_config.warmupIteration && run_config.warmupIteration > 0) {
            console.log("Running warmup...");
            for(let i = 0 ; i < run_config.warmupIteration; i++) {
                await impl.runModel(inputData, expectedOutput, true/*isWarmup*/);
            }
            console.log("Warmup done");   
        }
        for(let i = 0 ; i < runIteration; i++) {
          const outputData = await impl.runModel(inputData, expectedOutput);
          durations.push(impl.duration);
        }
    }
    if(profile) {
      impl.endProfiling();
    }
    durations.shift();
    const sum = durations.reduce((a,b)=>a+b);
    const avg = sum / durations.length;
    console.log(`avg duration: ${avg}`);
    return {
        framework: framework,
        backend: backend,
        duration: avg
    };
}

class TensorFlowBenchmark {
    async init(backend) {
        this.inputWidth = run_config.inputConfig.inputWidth;
        this.inputHeight = run_config.inputConfig.inputHeight;
        this.inputDepth = run_config.inputConfig.inputDepth;

        this.isScriptFile = run_config.tfjsModelConfig.path.slice(-3) == '.js';
        let model;
        let loadingError;
        if(this.isScriptFile) {
            var loadScript = async function () {
                return new Promise((resolve, reject) => {
                  // Create script element and set attributes
                  const script = document.createElement('script')
                  script.type = 'text/javascript'
                  script.async = false;
                  script.defer = false;
                  script.src = `${SERVER_BASE_PATH}/${run_config.tfjsModelConfig.path}`;
                  // Resolve the promise once the script is loaded
                  // Catch any errors while loading the script
                  script.addEventListener('load', () => {
                    resolve(script)
                  });
                  script.addEventListener('error', () => {
                    reject(new Error(`${SERVER_BASE_PATH}/${run_config.tfjsModelConfig.path} failed to load.`));
                  });
                  
                  script.onload = function() {
                    this.model = createModel(tf);
                  };
                  // Append the script to the DOM
                  const el = document.getElementsByTagName('script')[0]
                  el.parentNode.insertBefore(script, el)
                });
            };

            await loadScript();
        }
        else {
            let realPath = isHttpUrl(run_config.tfjsModelConfig.path) ? run_config.tfjsModelConfig.path :
                `${SERVER_BASE_PATH}/${run_config.tfjsModelConfig.path}`;
            // first try to load it as layers model
            try {
                model = await tf.loadLayersModel(realPath);
            }
            catch (e) {
                loadingError = e;
                model = undefined;
            }
            // if empty, then try loading as graph model
            if(model === undefined && loadingError !== undefined) {
                try {
                    model = await tf.loadGraphModel(realPath);
                }
                catch (e) {
                    loadingError = e;
                    model = undefined;
                }
            }
        }

        if(model === undefined) {
            if(loadingError !== undefined) {
                throw loadingError;
            }
            throw new Error('Model failed to load, please check model path or script in configuration.');
        }

        this.pack_texture = run_config.tfjsModelConfig.webgl.pack;
        tf.env().set('WEBGL_PACK', this.pack_texture);

        console.log(`Tfjs pack mode enabled: ${tf.env().getBool('WEBGL_PACK')}`);
        if(backend) {
            console.log(`Setting the backend to ${backend}`);
            await tf.setBackend(backend);
            await tf.ready();
            console.log(`Set the backend to ${tf.getBackend()}`);
        }
        this.model = model;
    }
    async runModel(data) {
        let preprocessedData;
        if(run_config.inputConfig.runPreprocessor) {
            preprocessedData = this.preprocess(data.data, this.inputWidth, this.inputHeight, this.inputDepth);
        }
        else {
            preprocessedData = data.data
        }
        const start = performance.now();
        if(!this.model && this.isScriptFile) {
            this.model = createModel(tf);
        }
        const output = await this.model.predict(preprocessedData);
        const outputData = output.dataSync();
        const stop = performance.now();
        this.duration = stop - start;
        console.log(`Duration:${this.duration}ms`);
        return outputData;
    }
    preprocess(data, width, height, depth) {
        // data processing
        const dataTensor = ndarray(new Float32Array(data), [width, height, depth])
        const dataProcessedTensor = ndarray(new Float32Array(width * height * depth), [1, width, height, depth])

        ops.subseq(dataTensor.pick(null, null, 2), 103.939)
        ops.subseq(dataTensor.pick(null, null, 1), 116.779)
        ops.subseq(dataTensor.pick(null, null, 0), 123.68)
        ops.assign(dataProcessedTensor.pick(0, null, null, 0), dataTensor.pick(null, null, 2))
        ops.assign(dataProcessedTensor.pick(0, null, null, 1), dataTensor.pick(null, null, 1))
        ops.assign(dataProcessedTensor.pick(0, null, null, 2), dataTensor.pick(null, null, 0))

        return tf.tensor(dataProcessedTensor.data, dataProcessedTensor.shape);
    }
    endProfiling() {
    }
}
class OrtWebBenchmark {
    async init(backend) {
        onnx.env.logLevel = profile ? 'verbose' : run_config.logLevel;

        if(run_config.onnxModelConfig.webgl.pack) {
            onnx.env.webgl.pack = run_config.onnxModelConfig.webgl.pack;
        }
        if(run_config.onnxModelConfig.webgl.contextId) {
            onnx.env.webgl.contextId = run_config.onnxModelConfig.webgl.contextId;
        }
        if(run_config.onnxModelConfig.wasm.numThreads) {
            onnx.env.wasm.numThreads = run_config.onnxModelConfig.wasm.numThreads
        }
        if(run_config.onnxModelConfig.wasm.initTimeout) {
            onnx.env.wasm.initTimeout = run_config.onnxModelConfig.wasm.initTimeout
        }

        console.log(`ort-web Pack mode enabled: ${onnx.env.webgl.pack}`);

        this.inputWidth = run_config.inputConfig.inputWidth;
        this.inputHeight = run_config.inputConfig.inputHeight;
        this.inputDepth = run_config.inputConfig.inputDepth;

        this.modelPath = `${SERVER_BASE_PATH}/${run_config.onnxModelConfig.path}`;
        this.session = await onnx.InferenceSession.create(this.modelPath,
                                                {executionProviders: [backend]});
        console.log(`Session initialized with: ${backend} backend(s).`);

        if (profile) {
            this.session.startProfiling();
        }
    }
    async runModel(data, output, isWarmup) {
        let preprocessedData;
        if(run_config.inputConfig.runPreprocessor) {
            preprocessedData = this.preprocess(data.data, this.inputWidth, this.inputHeight, this.inputDepth);
        }
        else {
            preprocessedData = data.data
        }
        const start = performance.now();
        const outputName = output === undefined ? 'output' : output.name;
        const inputName = data.name;

        const outputMap = await this.session.run({[inputName]: preprocessedData}, [outputName]);
        const outputData = outputMap[this.session.outputNames[0]];

        const stop = performance.now();
        this.duration = stop - start;
        let prefix;
        if(isWarmup) {
            prefix = 'Warmup duration';
        }
        else {
            prefix = 'Duration';
        }
        console.log(`${prefix}:${this.duration}ms`);
        return outputData;
    }
    preprocess(data, width, height, depth) {
      // data processing
      const dataTensor = ndarray(new Float32Array(data), [width, height, depth]);
      const dataProcessedTensor = ndarray(new Float32Array(width * height * depth), [1, depth, width, height]);

      ops.divseq(dataTensor, 128.0);
      ops.subseq(dataTensor, 1.0);

      ops.assign(dataProcessedTensor.pick(0, 0, null, null), dataTensor.pick(null, null, 2));
      ops.assign(dataProcessedTensor.pick(0, 1, null, null), dataTensor.pick(null, null, 1));
      ops.assign(dataProcessedTensor.pick(0, 2, null, null), dataTensor.pick(null, null, 0));

      const tensor = new onnx.Tensor('float32', dataProcessedTensor.data, [1, depth, width, height]);
      return tensor;
    }
    endProfiling() {
        this.session.endProfiling();
    }
}

console.log(`browser: ${browser}`)

describe('Running benchmark', ()=> {
    let benchmarksDone = 0;
    before('Reading config', async ()=> {
        await readTextFileAsync(`${SERVER_BASE_PATH}/` + __karma__.config.runConfig);
        runIteration = run_config.runIteration;
        console.log(`Starting benchmark: ${run_config.benchmarkName}`);
    });

    it('benchmark run ', async ()=> {
        if(benchmarksDone >= run_config.frameworksToTest.length) {
            return;
        }
        for(const backend of run_config.backendsToTest) {
            results.push(await runBenchmark(run_config.frameworksToTest[benchmarksDone], backend));
        }
    });

    it('benchmark run ', async ()=> {
        if(benchmarksDone >= run_config.frameworksToTest.length) {
            return;
        }
        for(const backend of run_config.backendsToTest) {
            results.push(await runBenchmark(run_config.frameworksToTest[benchmarksDone], backend));
        }
    });
    
    afterEach('Coninuing...', () => {
        benchmarksDone++;
    });
    after('printing results', ()=> {
        console.log(JSON.stringify(results));
    });
});
