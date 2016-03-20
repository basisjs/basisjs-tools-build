var fs = require('fs');
var path = require('path');
var configure = require('basisjs-tools-config');
var Promise = require('es6-promise-polyfill').Promise;
var Flow = require('../common/flow');
var command = require('./command');
var isChildProcess = typeof process.send == 'function'; // child process has send method

if (isChildProcess)
  process.on('uncaughtException', function(error){
    process.send({
      errorType: 'Exception',
      error: String(error)
    });
    process.exit(2);
  });


//
// export
//
//exports.handler = extractHandler;
exports.handlers = extractHandlers;


//
// launched by another module
//
exports.extract = function(config){
  if (this === command)
    return extract(config);

  if (this === exports)
    return extract(command.normalize(config));
};

//
// run command in child process
//
exports.fork = function(args, options){
  return require('child_process').fork(__filename, args, options);
};

//
// launched directly (i.e. node index.js ..)
//
if (process.mainModule === module)
  configure(command).run();


//
// main function
//
function extract(config){
  //
  // init
  //

  var options = command.norm(config);
  var inputFilename = options.file;
  var flow = new Flow(options, 'extract');
  var fconsole = flow.console;

  fconsole.enabled = !options.silent && options.target == 'log';

  fconsole.start('Extract settings');
  fconsole.log('Base path: ', options.base);
  fconsole.log('Index file:', options.file);
  fconsole.log('Plugins:   ', flow.plugins ? flow.plugins.join(', ') : 'NONE');
  fconsole.log('Target:    ', options.target);
  fconsole.endl();


  //
  // process input
  //

  // check input file exists
  if (!fs.existsSync(inputFilename) || !fs.statSync(inputFilename).isFile())
    flow.exit('Input file ' + inputFilename + ' not found');

  fconsole.start('\nInit\n====\n');

  // add input file in queue
  flow.indexFile = flow.files.add({
    filename: path.basename(inputFilename)
  });


  //
  // Main part
  //

  var handlers = extractHandlers(flow.options).concat([
    require('./misc/stat'),

    // target
    {
      'app-profile': require('./target/appProfile'),
      'input-graph': require('./target/inputGraph'),
      'css-usage': require('./target/cssUsage')
    }[flow.options.target],

    flow.options.target == 'log' ? require('./misc/summary') : null
  ]).filter(Boolean);

  var taskCount = 0;
  var timing = flow.timing = [];
  var time;
  var resolve = function(){};
  var result = new Promise(function(resolve_){
    resolve = resolve_;
  });

  function repeat(str, count){
    return new Array(count + 1).join(str);
  }

  function asyncTaskStart(){
    taskCount++;
  }
  function asyncTaskDone(){
    taskCount--;
    nextHandler();
  }

  function nextHandler(){
    if (!taskCount)
    {
      if (handlers.length)
      {
        var timeDiff = process.hrtime(time.time);
        time.time = parseInt(timeDiff[0] * 1e3 + timeDiff[1] / 1e6, 10);
        timing.push(time);
      }

      process.nextTick(runHandler);
    }
  }

  function runHandler(){
    if (!handlers.length)
      return resolve(flow);

    var handler = handlers.shift();
    var title = handler.handlerName || 'Untitled handler';
    var skipped = typeof handler.skip == 'function' ? handler.skip(flow) : false;

    fconsole.resetDeep();

    if (title)
      fconsole.log('\n' + title + '\n' + repeat('=', title.length) + '\n');

    fconsole.incDeep();

    if (skipped)
    {
      fconsole.log('Skipped.');
      fconsole.log(skipped);
      process.nextTick(runHandler);
    }
    else
    {
      time = {
        name: title,
        time: process.hrtime()
      };

      handler(flow, asyncTaskStart, asyncTaskDone);
      nextHandler();
    }
  }

  process.nextTick(runHandler);

  if (isChildProcess)
  {
    result.then(function(flow){
      process.send({
        data: flow.result
      });
    });
  }
  else
  {
    if (!options.silent && options.target != 'log')
      result.then(function(flow){
        console.log(flow.result);
      });

    return result;
  }
}

function extractHandlers(options){
  return [
    require('./html'),
    require('./js'),
    require('./tmpl'),
    require('./css'),
    require('./res'),
    require('./l10n'),

    options && options.jsInfo ? require('./js/collectInfo') : null,
    options && options.l10nInfo ? require('./l10n/collectInfo') : null,
    options && options.cssInfo ? require('./css/collectInfo') : null
  ].filter(Boolean);
}

// function extractHandler(flow){
//   extractHandlers().forEach(function(handler){
//     handler(flow);
//   });
// }
// extractHandler.handlerName = 'Extract file graph';
