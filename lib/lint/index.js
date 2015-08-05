var fs = require('fs');
var path = require('path');
var configure = require('basisjs-tools-config');
var Promise = require('es6-promise-polyfill').Promise;
var Flow = require('../common/flow');
var extract = require('../extract');
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
  var flow = new Flow(options);
  var fconsole = flow.console;

  fconsole.enabled = options.verbose;


  //
  // preprocessing
  //

  fconsole.start('Preprocessors');
  for (var type in options.preprocess)
  {
    var list = options.preprocess[type];
    var newList = flow.files.preprocess[type] = [];
    var hasPrerocessor = false;

    for (var i = 0; i < list.length; i++)
    {
      var preprocessorPath = list[i];

      fconsole.log('[' + type + '] ' + preprocessorPath);

      try {
        var processor = require(preprocessorPath);

        if (typeof processor.process == 'function')
        {
          newList.push(processor.process);
          hasPrerocessor = true;
        }
        else
        {
          flow.exit('[ERROR] Preprocessor has no process function. Skipped.');
        }
      } catch(e) {
        flow.exit('[ERROR] Error on preprocessor load: ' + e);
      }

      fconsole.end();
    }
  }
  if (!hasPrerocessor)
    fconsole.log('  not defined');
  fconsole.endl();


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

  var reporters = {
    checkstyle: './reporter/checkstyle.js',
    junit: './reporter/junit.js',
    default: './reporter/default.js'
  };

  var reporter = require(reporters[flow.options.reporter] || reporters.default);
  reporter.handlerName = 'Reporter: ' + (reporters[flow.options.reporter] ? flow.options.reporter : 'default');

  var handlers = extract.handlers({
    jsInfo: true,
    cssInfo: true,
    l10nInfo: true
  }).concat([
    reporter
  ]);

  var handlerCount = handlers.length;
  var taskCount = 0;
  var resolve = function(){};
  var reject = function(){};
  var result = new Promise(function(resolve_, reject_){
    resolve = resolve_;
    reject = reject_;
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
        stat: flow.warns.stat,
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
        console.log(flow.result);
        if (flow.warns.length)
          process.exit(2);
      });

    return result;
  }
}
