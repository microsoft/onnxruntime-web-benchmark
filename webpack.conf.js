const webpack = require("webpack");
const path = require('path');
const fs = require('fs');
const APP_DIR = path.resolve(__dirname, "./src/");
const DIST_DIR = path.resolve(__dirname, "./dist/");

if (!fs.existsSync('dist')){
  fs.mkdirSync('dist');
}

if(!process.env.ORT_BASE) {
  //TODO set ort-web base to the official release in node_modules
  //process.env.ORT_BASE = './node_modules/onnxruntime-web';
  throw new Error("ORT_BASE variable is not set!");
}
const ort_wasm_path = path.resolve(process.env.ORT_BASE, "./js/web/dist/ort-wasm.wasm");
const ort_wasm_simd_path = path.resolve(process.env.ORT_BASE, "./js/web/dist/ort-wasm-simd.wasm");
const ort_wasm_threaded_path = path.resolve(process.env.ORT_BASE, "./js/web/dist/ort-wasm-threaded.wasm");
const ort_wasm_threaded_simd_path = path.resolve(process.env.ORT_BASE, "./js/web/dist/ort-wasm-simd-threaded.wasm");

if (!fs.existsSync(ort_wasm_path)){
  console.log(`${ort_wasm_path} does not exist. Build will continue without benchmarking support for wasm.`);
}
else {
  fs.createReadStream(ort_wasm_path).pipe(fs.createWriteStream('dist/ort-wasm.wasm'));
}

if (!fs.existsSync(ort_wasm_simd_path)){
  console.log(`${ort_wasm_simd_path} does not exist. Build will continue without benchmarking support for simd wasm.`);
}
else {
  fs.createReadStream(ort_wasm_simd_path).pipe(fs.createWriteStream('dist/ort-wasm-simd.wasm'));
}

if (!fs.existsSync(ort_wasm_threaded_path)){
  console.log(`${ort_wasm_threaded_path} does not exist. Build will continue without benchmarking support for threaded wasm.`);
}
else {
  fs.createReadStream(ort_wasm_threaded_path).pipe(fs.createWriteStream('dist/ort-wasm-threaded.wasm'));
}

if (!fs.existsSync(ort_wasm_threaded_simd_path)){
  console.log(`${ort_wasm_threaded_simd_path} does not exist. Build will continue without benchmarking support for threaded simd wasm.`);
}
else {
  fs.createReadStream(ort_wasm_threaded_simd_path).pipe(fs.createWriteStream('dist/ort-wasm-simd-threaded.wasm'));
}

const tfjs_wasm_path = path.resolve(__dirname, './node_modules/@tensorflow/tfjs-backend-wasm/wasm-out/tfjs-backend-wasm.wasm');
const tfjs_wasm_simd_path = path.resolve(__dirname, './node_modules/@tensorflow/tfjs-backend-wasm/wasm-out/tfjs-backend-wasm-simd.wasm');
const tfjs_wasm_threaded_simd_path = path.resolve(__dirname, './node_modules/@tensorflow/tfjs-backend-wasm/wasm-out/tfjs-backend-wasm-threaded-simd.wasm');

if (!fs.existsSync(tfjs_wasm_path)){
  console.log(`${tfjs_wasm_path} does not exist. Build will continue without benchmarking support for wasm.`);
}
else {
  fs.createReadStream(tfjs_wasm_path).pipe(fs.createWriteStream('dist/tfjs-backend-wasm.wasm'));
}
if (!fs.existsSync(tfjs_wasm_simd_path)){
  console.log(`${tfjs_wasm_simd_path} does not exist. Build will continue without benchmarking support for wasm.`);
}
else {
  fs.createReadStream(tfjs_wasm_simd_path).pipe(fs.createWriteStream('dist/tfjs-backend-wasm-simd.wasm'));
}
if (!fs.existsSync(tfjs_wasm_threaded_simd_path)){
  console.log(`${tfjs_wasm_threaded_simd_path} does not exist. Build will continue without benchmarking support for wasm.`);
}
else {
  fs.createReadStream(tfjs_wasm_threaded_simd_path).pipe(fs.createWriteStream('dist/tfjs-backend-wasm-threaded-simd.wasm'));
}

module.exports = (env, argv) => {
  const config = {
    entry: [APP_DIR + "/index.js", APP_DIR + "/index_utils.js"],
    output : {
      path : DIST_DIR,
      filename: "main.js"
    },
    node: {fs: 'empty'},
    resolve: {
      extensions: ['.js', '.ts'],
    },
    plugins: [new webpack.WatchIgnorePlugin([/\.js$/, /\.d\.ts$/])],
    module: {
      rules: [
        {
          test: /\.wasm$/i,
          type: 'javascript/auto',
          use: [
            {
              loader: 'file-loader',
            },
          ],
        },
        {
          test: /\.tsx?$/, 
          loader: 'ts-loader'}
      ],
    },  };
  if (argv.mode === 'production') {
    config.mode = 'production';
    config.devtool = 'source-map';
  } else {
    config.mode = 'development';
    config.devtool = 'eval-source-map';
  }
  return config;
};