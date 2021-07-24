// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

// gen-chrome-trace
// tslint:disable

import * as readline from 'readline';
const int = readline.createInterface({input: process.stdin, output: process.stdout, terminal: false});

const matcher = /Profiler\.([^\[\s\x1b]+)(\x1b\[0m)? (\d.+Z)\|([\d\.]+)ms on event '([^']+)' at (\d*\.*\d*)/;
let pid:number;
const allEvents: any[] = [];
int.on('line', input => {
  const matches = matcher.exec(input);
  if(input.indexOf(' with id ') >= 0) {
    let n = input.lastIndexOf(' ');
    let id = input.substring(n + 1);
    pid = id as unknown as number;
  }
  if (matches) {
    const category = matches[1];
    const logTimeStamp = new Date(matches[3]);
    const ms = Number.parseFloat(matches[4]);
    const event = matches[5];
    const endTimeInNumber = matches[6];
    allEvents.push({event, ms, logTimeStamp, category, endTimeInNumber, pid});
  }
});

interface Event {
  cat: string;
  dur: number;
  name: string;
  ph: string;
  pid: number;
  ts: number;
}

let rawEvents : Event[] = [];

int.on('close', () => {
  for (const i of allEvents) {
    rawEvents.push({
      cat: i.category,
      dur: i.ms,
      name: i.event,
      ph: 'X',
      pid: i.pid,
      ts: (i.endTimeInNumber - i.ms)
    });
  }
  
  let chromeTrace = {traceEvents: rawEvents};
  
  var json = JSON.stringify(chromeTrace, null, 2);
  var fs = require('fs');
  fs.writeFile('trace.json', json, 'utf8',()=>{});
});
