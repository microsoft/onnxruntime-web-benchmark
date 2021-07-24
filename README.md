# ORTWebBenchmark
A benchmarking tool under development. Current it supports running wasm and webgl backends with profiling for tfjs and ort-web frameworks.

## Setup
Change the package version for onnxruntime-web in package.json to point to either an official release or a local build.
i.e
If using local build and onnxruntime's base folder is `~/onnxruntime`, set `onnxruntime-web` dependency in package.json to:
`"onnxruntime-web": "file:~/onnxruntime/js/web"`.

***Note: Make sure that all of the .wasm libraries including threaded and simd.threaded files exist in the dist folder(js/web/dist) of ort-web.

If using official release, simply set it with a version number.

In the root directory, run `npm install` to install all required packages.

Set the environment variable `ORT_BASE` to the base directory of onnxruntime.
i.e
onnxruntime is located at `~/onnxruntime`, then run `export ORT_BASE=~/onnxruntime`.

To build the bundle, run `npm run build` in the root directory or `ORT_BASE=~/onnxruntime npm run build` if previous step is not done.

***Note: The build script triggers webpack to look for .wasm files in the onnxruntime directory, if files are not found, the build will continue without the capability to benchmark wasm backend.

## Run
To start benchmarking, run `npm run benchmark`. Users need to provide a runtime configuration file that contains all parameters. By default, it looks for `run_config.json` in the root folder. Some sample configuration files are provided under `/sample-configs`. To pass a custom config to the benchmarking run, run `RUN_CONFIG=path_to_config npm run benchmark`.
i.e.
`RUN_CONFIG=./sample-configs/run_config_softmax_test.json npm run benchmark`

Profiling data can be generated using `npm run profile` command. It will create a chrome-trace event file named trace.json in the root folder. This file can be loaded into `chrome://tracing` for visualization.

***Note: Make sure to put the image and model files under the `data/` directory in the root. The browser doesn't have access to local file system so files need to be uploaded to the local server when benchmark starts up. All content under `data/` will be served.
### Input formats
Currently, this tool supports 3 types of inputs:
1. Synthetic data -> Randomly generated tensors during runtime. Set `inputConfig.useSyntheticData` to true to enable it. Note that this will override other input methods.
2. Image data -> tensors are created using given images of types jpg or bmp. Set urls in `inputConfig.customInputPaths` to instruct the tool of the location of the images to load. Urls can be a local path or web url.
3. Protobuf files -> tensors are created using given .pb files. Set urls in `inputConfig.customInputPaths` to instruct the tool of the location of the pb files to load.

### Input models
#### Ort-web
Only .onnx models are supported as of now. Set inputConfig.onnxModelConfig.path to the file path.

#### Tensorflow.js
Tensorflow.js models can be loaded in 2 ways:
1. Plain javascript file -> This method supports dynamically loading a javascript file that describes a tfjs model. The .js file will be inlined into the main page at runtime. Set `inputConfig.tfjsModelConfig.path` to the .js file path. An example is provided in `sample-configs/run_config_super_resolution.json`. The .js file should only contain 1 function with this signature `function createModel(tf)` and return a constructed tfjs model object. This function is then called in the main script tp retrieve the model. An example is provided in `data/model-tfjs/super-resolution/super-res.js`
2. model.json and model.bin -> This is the official way provided by TFJS project to load models. It will use `tf.LoadLayeredModel` or `tf.LoadGraphModel` to load the model structure and weights. Set `inputConfig.tfjsModelConfig.path` to the path of `model.json`. The bin file which contains the weights should be in the same directory as `model.json`.