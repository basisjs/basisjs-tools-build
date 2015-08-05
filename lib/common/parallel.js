var chalk = require('chalk');
var createProgress = require('./progress.js');
var fit = require('./fixed-width-string.js');
var MIN_CAPTION_LENGTH = 20;
var MAX_CAPTION_LENGTH = 30;

function start(tasks){
  var startTime = Date.now();
  var doneCount = 0;
  var captionWidth = Math.max.apply(null, tasks.map(function(task){
    return task.name ? task.name.length : 0;
  }));

  tasks.forEach(function(task){
    var unexpectedExit = true;

    var bar = createProgress(
      fit(
        '  ' + (task.name || ''),
        Math.min(Math.max(captionWidth, MIN_CAPTION_LENGTH), MAX_CAPTION_LENGTH),
        { truncate: 'left' }
      ),
      chalk.gray('awaiting...')
    );

    task.process
      .on('exit', function(code){
        if (unexpectedExit)
          bar.done(chalk.gray('\u2013 ') + chalk.red('Unexpected exit (code ' + code + ')'));

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
          bar.done(chalk.bgRed.white((res.errorType || 'ERROR').toUpperCase()) + ' ' + chalk.red(res.error));
        }
        else
        {
          switch (res.event)
          {
            case 'ready':
            case 'progress':
              bar.update(100 * res.done / res.total, chalk.cyan(res.name || ''));
              break;
            case 'done':
              unexpectedExit = false;

              var warnings = res.warnings ? res.warnings.length : 0;
              if (warnings)
                warnings += (warnings > 1 ? ' warnings found' : ' warning found');

              bar.done(
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
};
