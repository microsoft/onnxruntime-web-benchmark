# ONNX Runtime Web Benchmark
A benchmarking tool under development. Current it supports running wasm and webgl backends with profiling for tfjs and ort-web frameworks.

## Setup
Change the package version for onnxruntime-web in package.json to point to either an official release or a local build.
i.e. if using local build and onnxruntime's base folder is `~/onnxruntime`, set `onnxruntime-web` dependency in package.json to:
`"onnxruntime-web": "file:~/onnxruntime/js/web"`.
Note that all of the .wasm libraries including threaded and simd.threaded files must exist in the dist folder(js/web/dist) of ort-web.

If using official release, simply set it with a version number.

In the root directory, run `npm install` to install all required packages.

To build the bundle, run `npm run build` in the root directory.

## Run
To start benchmarking, run `npm run benchmark`. Users need to provide a runtime configuration file that contains all parameters. By default, it looks for `run_config.json` in the root folder. Some sample configuration files are provided under `/sample-configs`. To pass a custom config to the benchmarking run, run `npm run benchmark --run_config=path_to_config`.
i.e. `npm run benchmark --run_config=./sample-configs/run_config_softmax_test.json`

Profiling data can be generated using `npm run profile` command. It will create a chrome-trace event file named trace.json in the root folder. This file can be loaded into `chrome://tracing` for visualization. Note that model files must exist under the `data/` directory in the root. The browser doesn't have access to local file system so files need to be uploaded to the local server when benchmark starts up. All content under `data/` will be served.

### Input formats
This tool generates synthetic input data referring to a model input shape and a hint by 'config.ortweb.shape' or 'config.tfjs.shape' when a shape is dynamic.

### Input models
#### Ort-web
Only .onnx models are supported as of now. Set config.ortweb.path to the file path.

#### Tensorflow.js
Tensorflow.js models can be either a layers model or a graph model with model.json and model.bin -> This is the official way provided by TFJS project to load models. It will use `tf.LoadLayeredModel` or `tf.LoadGraphModel` to load the model structure and weights. Set `config.tfjs.path` to the path of `model.json`. The bin file which contains the weights should be in the same directory as `model.json`.
