var fs = require('fs');
var path = require('path');
var configure = require('basisjs-tools-config');
var Promise = require('es6-promise-polyfill').Promise;
var Flow = require('../common/flow');
var extract = require('../extract');
var command = require('./command');
var chalk = require('chalk');
var readline = require('readline');
var utils = require('../common/utils');
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
exports.build = function(config){
  if (this === command)
    return build(config);

  if (this === exports)
    return build(command.normalize(config));
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

function normalizePath(filename){
  var cwd = process.env.PWD || process.cwd();

  if (/^[a-z]:/i.test(filename))
    filename = filename.replace(new RegExp('^' + cwd.split(':')[0] + ':'), '');

  return filename.replace(/\\/g, '/');
}

//
// main function
//
function build(config){

  //
  // init
  //

  var options = command.norm(config);
  var inputFilename = options.file;
  var flow = new Flow(options);
  var fconsole = flow.console;

  flow.exitOnFatal = true;
  flow.outputResourceDir = 'res/';
  flow.files.typeByExt = options.extFileTypes;

  fconsole.enabled = options.verbose;
  chalk.enabled = options.color && process.stdout.isTTY;

  if (options.verbose)
  {
    // TODO: add more settings output
    fconsole.start('Build with ' + utils.getToolsId());
    fconsole.log('Base path:', options.base);
    fconsole.log('Index file:', options.file);
    fconsole.log('Output path:', options.output);
    fconsole.endl();
  }
  else
  {
    process.stdout.write(
      'Build with ' + chalk.yellow(utils.getToolsId()) + '\n' +
      'Base path:   ' +
        chalk.green(normalizePath(options.base)) + '\n' +
      'Index file:  ' +
        chalk.green(normalizePath(options.file).replace(new RegExp('^' + normalizePath(options.base)), chalk.gray('$&'))) + '\n' +
      'Output path: ' +
        chalk.green(normalizePath(options.output).replace(new RegExp('^' + normalizePath(options.base)), chalk.gray('$&'))) + '\n' +
      '\n'
    );
  }


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

  // if output path eqauls to index file location it could rewrite original files
  // stop process in this case (fatal error)
  if (options.output == path.dirname(inputFilename))
    flow.exit('Output path shouldn\'t be the same as input file location');

  fconsole.start('\nInit\n====\n');

  // add input file in queue
  flow.indexFile = flow.files.add({
    isIndexFile: true,
    filename: path.basename(inputFilename)
  });


  //
  // Main part
  //

  var handlers = extract.handlers({
    jsInfo: flow.options.jsInfo,
    cssInfo: flow.options.cssOptimizeNames || flow.options.cssCutUnused,
    l10nInfo: true
  }).concat([
    // process output files
    require('./misc/prepareFiles'),

    // process resources
    require('./res/base64'),
    require('./res/relink'),

    // process css
    require('./css/cutUnused'),
    require('./css/optimizeNames'),
    require('./css/makePackages'),
    require('./css/linear'),
    require('./css/merge'),
    require('./css/pack'),
    require('./css/translate'),

    // process l10n
    require('./l10n/buildIndex'),
    require('./l10n/makePackages'),
    require('./l10n/relink'),
    require('./l10n/pack'),

    // process tmpl
    require('./tmpl/translate'),
    require('./tmpl/pregenerate'),

    // css/html resources
    require('./res/translate'),
    require('./res/buildMap'),

    // process js
    require('./js/relink'),
    require('./js/makePackages'),
    require('./js/translate'),
    require('./js/json'),
    require('./js/buildPackages'),
    require('./js/pack'),
    require('./js/realignHtml'),

    // process html
    require('./html/translate'),

    // target transformation
    {
      'output-graph': require('./target/outputGraph')
    }[options.target],

    // flush output
    require('./misc/result'),
    require('./misc/writeFiles'),

    // show summary
    require('./misc/summary')
  ]).filter(Boolean);

  var handlerCount = handlers.length;
  var taskCount = 0;
  var timing = [];
  var time;
  var stdoutPos;
  var resolve = function(){};
  var reject = function(){};
  var result = new Promise(function(resolve_, reject_){
    resolve = resolve_;
    reject = reject_;
  });

  flow.timing = timing;

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
      var timeDiff = process.hrtime(time.time);
      time.time = parseInt(timeDiff[0] * 1e3 + timeDiff[1] / 1e6, 10);
      timing.push(time);

      if (!options.verbose && handlers.length)
      {
        var extraInfo = time.extraInfo ? time.extraInfo(flow) : '';
        if (process.stdout.isTTY)
        {
          if (process.stdout._bytesDispatched == stdoutPos)
          {
            readline.moveCursor(process.stdout, 0, -1);
            readline.clearLine(process.stdout, 0);
            process.stdout.write(
              stdoutHandlerTitle +
              (extraInfo ? chalk.gray(' [') + chalk.yellow(extraInfo) + chalk.gray(']') : '') +
              chalk.gray(' – '));
          }
          else
          {
            if (extraInfo)
              process.stdout.write('       ' + chalk.yellow(extraInfo) + '\n');
            process.stdout.write('       ');
          }

          process.stdout.write(
            chalk.green('DONE') +
            (time.time > 10 ? chalk.gray(' (' + time.time + 'ms)') : '') +
            '\n'
          );
        }
        else
        {
          if (extraInfo)
            process.stdout.write('       * ' + extraInfo + '\n');
        }
      }

      process.nextTick(runHandler);
    }
  }

  function runHandler(){
    if (!handlers.length)
      return resolve(flow);

    var handler = handlers.shift();
    var title = handler.handlerName || 'Untitled handler';
    var lastHandler = !handlers.length;
    var skipped = typeof handler.skip == 'function' ? handler.skip(flow) : false;

    if (options.verbose)
    {
      fconsole.resetDeep();
      fconsole.start('\n' + title + '\n' + (repeat('=', title.length)) + '\n');

      if (skipped)
      {
        fconsole.log('Skipped.');
        fconsole.log(skipped);
      }
    }
    else
    {
      // show short stat for handler except last one
      if (!lastHandler && !skipped)
      {
        fconsole.resetDeep();
        stdoutHandlerTitle = title.replace(/^(?:\[(\S+)\] ?|)/, function(m, topic){
          return '     '.substr((topic || '').length) + chalk.cyan(topic || '') + '  ';
        });
        process.stdout.write(stdoutHandlerTitle + '\n');
        stdoutPos = process.stdout._bytesDispatched;
      }
    }

    if (isChildProcess)
      process.send({
        event: 'progress',
        done: handlerCount - handlers.length - 1,
        total: handlerCount,
        name: handler.handlerName || 'Untitled handler'
      });

    if (skipped)
      return process.nextTick(runHandler);

    time = {
      extraInfo: typeof handler.extraInfo ? handler.extraInfo : null,
      name: title,
      time: process.hrtime()
    };

    handler(flow, asyncTaskStart, asyncTaskDone);
    nextHandler();
  }

  process.nextTick(runHandler);

  if (isChildProcess)
  {
    result.then(function(flow){
      process.send({
        event: 'done',
        success: true,
        warnings: flow.warns,
        // don't send result to parent process as it's too slow
        //result: flow.result
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
        //
      });
  }

  return result;
}
