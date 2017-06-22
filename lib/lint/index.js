var fs = require('fs');
var path = require('path');
var configure = require('basisjs-tools-config');
var Promise = require('es6-promise-polyfill').Promise;
var Flow = require('../common/flow');
var extract = require('../extract');
var command = require('./command');
var chalk = require('chalk');
var isChildProcess = typeof process.send == 'function'; // child process has send method
var unusedL10n = require('./unused/l10n');

if (isChildProcess)
  process.on('uncaughtException', function(error){
    process.send({
      errorType: 'Exception',
      error: String(error)
    });
    process.exit(2);
  });


//
// launched by another module
//
exports.lint = function(config){
  if (this === command)
    lint(config);

  if (this === exports)
    lint(command.normalize(config));
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
function lint(config){

  //
  // init
  //

  var options = command.norm(config);
  var inputFilename = options.file;
  var flow = new Flow(options, 'lint');
  var fconsole = flow.console;

  fconsole.enabled = options.verbose;
  chalk.enabled = options.color && process.stdout.isTTY;


  //
  // process input
  //

  // check input file exists
  if (!fs.existsSync(inputFilename) || !fs.statSync(inputFilename).isFile())
    flow.exit('Input file ' + inputFilename + ' not found');

  // add input file in queue
  flow.indexFile = flow.files.add({
    isIndexFile: true,
    filename: path.basename(inputFilename)
  });


  //
  // Main part
  //

  var reporters = require('./reporter');

  var reporter = require(reporters[options.reporter || 'console']);
  reporter.handlerName = 'Reporter: ' + (options.reporter || 'console');

  var handlers = extract.handlers({
    jsInfo: true,
    cssInfo: true,
    l10nInfo: true
  }).concat([
    function(flow){
      if (options.warnUnusedL10n)
      {
        flow.usedL10nTokens = unusedL10n.collectUsed(flow);
        if (!isChildProcess)
          unusedL10n.warn(flow);
      }

    },
    function(flow){
      flow.result = require('./reporter/process-warns')(flow, options);
    }
  ]);

  var handlerCount = handlers.length;
  var taskCount = 0;
  var resolve = function(){};
  var result = new Promise(function(resolve_){
    resolve = resolve_;
  });

  function asyncTaskStart(){
    taskCount++;
  }
  function asyncTaskDone(){
    taskCount--;
    nextHandler();
  }

  function nextHandler(){
    if (!taskCount)
      process.nextTick(runHandler);
  }

  function runHandler(){
    if (!handlers.length)
      return resolve(flow);

    var handler = handlers.shift();
    var skipped = typeof handler.skip == 'function' ? handler.skip(flow) : false;

    if (isChildProcess)
      process.send({
        event: 'progress',
        done: handlerCount - handlers.length - 1,
        total: handlerCount,
        name: handler.handlerName || 'Untitled handler'
      });

    if (skipped)
      return process.nextTick(runHandler);

    fconsole.resetDeep();
    handler(flow, asyncTaskStart, asyncTaskDone);

    nextHandler();
  }

  process.nextTick(runHandler);

  if (isChildProcess)
  {
    result.then(function(flow){
      process.send({
        event: 'done',
        success: !flow.warns.length,
        warnings: flow.warns,
        usedL10nTokens: flow.usedL10nTokens,
        result: flow.result
      });
    });

    process.send({
      event: 'ready',
      done: 0,
      total: handlerCount
    });
  }
  else
  {
    if (!options.silent)
      result.then(function(flow){
        console.log(reporter(flow.result));
        if (flow.warns.length)
          process.exit(2);
      });

    return result;
  }
}
