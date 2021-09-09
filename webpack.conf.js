// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

const webpack = require("webpack");
const path = require('path');
const fs = require('fs');
const APP_DIR = path.resolve(__dirname, "./src/");
const DIST_DIR = path.resolve(__dirname, "./dist/");

if (!fs.existsSync('dist')){
  fs.mkdirSync('dist');
}

if (fs.existsSync('./node_modules/onnxruntime-common')) {
  fs.copyFileSync(path.resolve('./node_modules/onnxruntime-common/dist', 'ort-common.min.js'), path.resolve('./dist', 'ort-common.min.js'));
} else {
  fs.copyFileSync(path.resolve('./node_modules/onnxruntime-web/node_modules/onnxruntime-common/dist', 'ort-common.min.js'), path.resolve('./dist', 'ort-common.min.js'));
}
fs.copyFileSync(path.resolve('./node_modules/onnxruntime-web/dist', 'ort-web.min.js'), path.resolve('./dist', 'ort-web.min.js'));
fs.copyFileSync(path.resolve('./node_modules/onnxruntime-web/dist', 'ort-wasm-threaded.js'), path.resolve('./dist', 'ort-wasm-threaded.js'));
fs.copyFileSync(path.resolve('./node_modules/onnxruntime-web/dist', 'ort-wasm-threaded.worker.js'), path.resolve('./dist', 'ort-wasm-threaded.worker.js'));
fs.copyFileSync(path.resolve('./node_modules/onnxruntime-web/dist', 'ort-wasm.wasm'), path.resolve('./dist', 'ort-wasm.wasm'));
fs.copyFileSync(path.resolve('./node_modules/onnxruntime-web/dist', 'ort-wasm-simd.wasm'), path.resolve('./dist', 'ort-wasm-simd.wasm'));
fs.copyFileSync(path.resolve('./node_modules/onnxruntime-web/dist', 'ort-wasm-threaded.wasm'), path.resolve('./dist', 'ort-wasm-threaded.wasm'));
fs.copyFileSync(path.resolve('./node_modules/onnxruntime-web/dist', 'ort-wasm-simd-threaded.wasm'), path.resolve('./dist', 'ort-wasm-simd-threaded.wasm'));

fs.copyFileSync(path.resolve('./node_modules/@tensorflow/tfjs/dist', 'tf.min.js'), path.resolve('./dist', 'tf.min.js'));
fs.copyFileSync(path.resolve('./node_modules/@tensorflow/tfjs-backend-wasm/dist', 'tf-backend-wasm.min.js'), path.resolve('./dist', 'tf-backend-wasm.min.js'));
fs.copyFileSync(path.resolve('./node_modules/@tensorflow/tfjs-backend-wasm/dist', 'tfjs-backend-wasm.wasm'), path.resolve('./dist', 'tfjs-backend-wasm.wasm'));
fs.copyFileSync(path.resolve('./node_modules/@tensorflow/tfjs-backend-wasm/dist', 'tfjs-backend-wasm-simd.wasm'), path.resolve('./dist', 'tfjs-backend-wasm-simd.wasm'));
fs.copyFileSync(path.resolve('./node_modules/@tensorflow/tfjs-backend-wasm/dist', 'tfjs-backend-wasm-threaded-simd.wasm'), path.resolve('./dist', 'tfjs-backend-wasm-threaded-simd.wasm'));

module.exports = (env, argv) => {
  const config = {
    entry: [APP_DIR + "/index.js"],
    output : {
      path : DIST_DIR,
      filename: "main.js"
    },
    node: {
      fs: 'empty'
    },
    resolve: {
      extensions: ['.js', '.ts']
    },
    externals: {
    },
    plugins: [
      new webpack.WatchIgnorePlugin([/\.js$/, /\.d\.ts$/])
    ],
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
          test: /\.ts$/, 
          exclude: /node_modules/,
          loader: 'ts-loader'
        }
      ],
    },  };
  if (argv.mode === 'production') {
    config.mode = 'production';
    config.devtool = 'source-map';
  } else {
    config.mode = 'development';
    config.devtool = 'inline-source-map';
  }
  return config;
};
