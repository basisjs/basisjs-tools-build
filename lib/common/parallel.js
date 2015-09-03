var ANSI_REGEXP = /([\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><])/g;
var chalk = require('chalk');
var createProgress = require('./progress.js');
var fixedWidthString = require('fixed-width-string');
var MIN_CAPTION_LENGTH = 20;
var MAX_CAPTION_LENGTH = 30;
var isTTY = process.stdout.isTTY;

function stripAnsi(str){
  return str.replace(ANSI_REGEXP, '');
}

function start(tasks, options){
  var startTime = Date.now();
  var results = [];
  var captionWidth = Math.max.apply(null, tasks.map(function(task){
    return task.name ? task.name.length : 0;
  }));

  tasks.forEach(function(task, idx){
    function done(message, isError){
      if (isError)
        error = message;

      if (options.silent)
        return;

      if (bar)
        bar.done(message);
      else
        console.log(name + ' ' + stripAnsi(message));
    }

    var unexpectedExit = true;
    var name = fixedWidthString(
      '  ' + (task.name || ('Untitled task' + idx)),
      Math.min(Math.max(captionWidth, MIN_CAPTION_LENGTH), MAX_CAPTION_LENGTH),
      { truncate: 'left' }
    );
    var error;
    var result;
    var bar;

    if (!options.silent)
    {
      if (isTTY)
        bar = createProgress(name, chalk.gray('awaiting...'));
      else
        console.log(name);
    }

    task.process
      .on('exit', function(code){
        if (unexpectedExit)
          done(chalk.red('Unexpected exit (code ' + code + ')'), true);

        results.push({
          name: task.name,
          result: error ? stripAnsi(error) : result
        });

        if (results.length == tasks.length)
        {
          if (!options.silent)
            console.log('\nAll tasks done in ' + ((Date.now() - startTime) / 1000).toFixed(3) + 'sec');

          if (options.callback)
            options.callback(results);

          process.exit();
        }
      })
      .on('message', function(res){
        if (res.error)
        {
          unexpectedExit = false;
          done(chalk.bgRed.white((res.errorType || 'ERROR').toUpperCase()) + ' ' + chalk.red(res.error), true);
        }
        else
        {
          switch (res.event)
          {
            case 'ready':
            case 'progress':
              if (bar)
                bar.update(100 * res.done / res.total, chalk.cyan(res.name || ''));
              break;
            case 'done':
              unexpectedExit = false;
              result = res;

              var warnings = res.warnings ? res.warnings.length : 0;
              if (warnings)
                warnings += (warnings > 1 ? ' warnings found' : ' warning found');

              done(
                res.success
                  ? chalk.green('OK') + chalk.red(warnings ? ' (' + warnings + ')' : '')
                  : chalk.bgRed.white('FAIL') + chalk.red(warnings ? ' ' + warnings : '')
              );

              break;
          }
        }
      });
  });
}

module.exports = function(commandName, tasks, options){
  var command = require('../' + commandName);
  options = options || {};

  if (!options.silent)
    console.log('Run ' + tasks.length + ' ' + chalk.yellow(commandName) + ' tasks:');

  start(tasks.map(function(task){
    return {
      name: task.name,
      process: command.fork(task.args, { silent: true })
    };
  }), options);

  if (!isTTY && !options.silent)
  {
    console.log('');
    console.log('Results:');
  }
};
