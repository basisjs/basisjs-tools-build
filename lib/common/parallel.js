var chalk = require('chalk');
var readline = require('readline');

process.stdin.pause();
setInterval(function(){
  var chunk = process.stdin.read();
  if (chunk)
    for (var i = 0; i < chunk.length; i++) {
      if (chunk[i] == 3)  // ^C
        process.exit();
    }
}, 50);

var lines = 0;
var stdout = process.stdout;
var MAX_LINE_WIDTH = process.stdout.columns || 200;
var MAX_CAPTION_LENGTH = 30;
var BAR_LENGTH = 30;
var BAR_CHAR = process.platform = 'win32' ? '\u25AC' : '\u25FC';
var boxStr = require('./fixed-width-string.js');

function repeatStr(str, len){
  return new Array(parseInt(len) + 1).join(str);
}

function draw(x, y, str){
  readline.moveCursor(stdout, x, -y);
  readline.clearLine(stdout, 1);

  process.stdout.write(str + '\n');

  readline.moveCursor(stdout, 0, y ? y - 1 : 0);
}

function createProgress(title, message){
  function drawBarLine(fill, str){
    fill = Math.round((fill / 100) * BAR_LENGTH);
    return (
      chalk.blue(repeatStr('\u25AC', fill)) +
      chalk.white(repeatStr('\u25AC', BAR_LENGTH - fill)) +
      ' ' + boxStr(str || '', MAX_LINE_WIDTH - x - BAR_LENGTH - 2)
    );
  }

  var line = lines++;
  var x = title.length + 1;

  draw(0, 0, title + ' ' + message);

  return {
    update: function(percent, message){
      draw(x, lines - line, drawBarLine(percent, message));
    },
    done: function(message){
      draw(x, lines - line, message);
    }
  };
}


function run(tasks){
  var startTime = Date.now();
  var doneCount = 0;
  var captionWidth = Math.max.apply(null, tasks.map(function(task){
    return task.name ? task.name.length : 0;
  }));

  tasks.forEach(function(task){
    var unexpectedExit = true;

    var bar = createProgress(
      boxStr(task.name || '', Math.min(MAX_CAPTION_LENGTH, captionWidth), { truncate: 'left' }),
      chalk.gray('waiting...')
    );

    task.process
      .on('exit', function(code){
        if (unexpectedExit)
          bar.done(chalk.gray('\u2013 ') + chalk.red('Unexpected exit (code ' + code + ')'));

        if (++doneCount == tasks.length)
        {
          console.log('All tasks done in ' + ((Date.now() - startTime) / 1000).toFixed(3) + 'sec');
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
              var warningCount = res.stat ? res.stat.warnings : 0;
              unexpectedExit = false;
              bar.done(
                warningCount
                  ? boxStr(chalk.bgRed(warningCount), 5, { align: 'right' }) + chalk.red(warningCount > 1 ? ' warnings found' : ' warning found')
                  : chalk.gray('\u2013 ') + chalk.green('OK')
              );
              break;
          }
        }
      });
  });
}

module.exports = function(command, tasks){
  run(tasks.map(function(task){
    return {
      name: task.name,
      process: command.fork(task.args, { silent: true })
    };
  }));
};
