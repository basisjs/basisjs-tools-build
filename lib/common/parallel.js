var ANSI_REGEXP = /([\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><])/g;
var chalk = require('chalk');
var createProgress = require('./progress.js');
var fit = require('./fixed-width-string.js');
var MIN_CAPTION_LENGTH = 20;
var MAX_CAPTION_LENGTH = 30;
var isTTY = process.stdout.isTTY;

function cleanAnsi(str){
  return str.replace(ANSI_REGEXP, '');
}

function start(tasks){
  var startTime = Date.now();
  var doneCount = 0;
  var captionWidth = Math.max.apply(null, tasks.map(function(task){
    return task.name ? task.name.length : 0;
  }));

  tasks.forEach(function(task, idx){
    function done(message){
      if (bar)
        bar.done(message);
      else
        console.log(name + ' ' + cleanAnsi(message));
    }

    var unexpectedExit = true;
    var name = fit(
      '  ' + (task.name || ('Untitled task' + idx)),
      Math.min(Math.max(captionWidth, MIN_CAPTION_LENGTH), MAX_CAPTION_LENGTH),
      { truncate: 'left' }
    );
    var bar;

    if (isTTY)
      bar = createProgress(name, chalk.gray('awaiting...'));
    else
      console.log(name);

    task.process
      .on('exit', function(code){
        if (unexpectedExit)
          done(chalk.red('Unexpected exit (code ' + code + ')'));

        if (++doneCount == tasks.length)
        {
          console.log('\nAll tasks done in ' + ((Date.now() - startTime) / 1000).toFixed(3) + 'sec');
          process.exit();
        }
      })
      .on('message', function(res){
        if (res.error)
        {
          unexpectedExit = false;
          done(chalk.bgRed.white((res.errorType || 'ERROR').toUpperCase()) + ' ' + chalk.red(res.error));
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

module.exports = function(commandName, tasks){
  var command = require('../' + commandName);
  console.log('Run ' + tasks.length + ' ' + chalk.yellow(commandName) + ' tasks:');
  start(tasks.map(function(task){
    return {
      name: task.name,
      process: command.fork(task.args, { silent: true })
    };
  }));

  if (!isTTY)
  {
    console.log('');
    console.log('Results:');
  }
};
