var exec = require('child_process').exec;

function repeat(str, count){
  return new Array(count + 1).join(str);
}

(module.exports = function(flow, startFn, doneFn){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  startFn();

  tryCmd(flow, function(processor){
    flow.js.compressProcessor = processor.name;

    // process files
    fconsole.start();
    for (var i = 0, file; file = queue[i]; i++)
      if (file.type == 'script' && file.outputContent && (file.htmlNode || file.outputFilename))
        processor.process(file, flow, processor.name, startFn, doneFn);

    doneFn();
  });
}).handlerName = '[js] Compress';

module.exports.extraInfo = function(flow){
  return flow.js.compressProcessor;
};
module.exports.skip = function(flow){
  if (!flow.options.jsPack)
    return 'Use --js-pack or --pack to allow javascript file compess.';
};

//
// choose processor
//

function tryCmd(flow, callback){
  var command = flow.options.jsPackCmd;
  var processor = {
    name: 'uglify-js',
    process: uglifyProcess
  };

  if (!command)
  {
    process.nextTick(function(){
      callback(processor);
    });
    return;
  }

  // check command is works
  exec(
    'echo "" | ' + command,
    function(error){
      // if command doesn't work
      if (error)
      {
        if (flow.options.jsPackCmd)
          flow.exit('Pack command: `' + flow.options.jsPackCmd + '`\n' + error);

        flow.warn({ message: '[WARN] `google-closure-compiler` is not available, downgrade to uglify.js' });
      }
      else
      {
        processor = {
          name: flow.options.jsPackCmd || 'google-closure-compiler',
          process: cmdProcess
        };
      }

      callback(processor);
    }
  );
}

//
// process handlers
//

function cmdProcess(file, flow, command, startFn, doneFn){
  var packStartTime = new Date;
  var fconsole = flow.console;
  var gcc;

  fconsole.log('Init compression for ' + file.relOutputFilename);
  gcc = exec(
    command, {
      maxBuffer: 10 * 1024 * 1024
    }, function(error, stdout, stderr){
      stderr = String(stderr || '').replace(/^The compiler is waiting for input via stdin\.\r?\n/, '');

      if (stderr)
      {
        var errorMsg;

        if (stderr.match(/^stdin:(\d+):\s+(.+)/))
        {
          var CHARS = 40;
          var lines = stderr.split(/\r\n?|\n\r?/);
          var m = (lines[2] || '').match(/^\s*/);
          var pos = (m ? m[0].length : 0);
          var left = Math.min(pos, CHARS);

          errorMsg =
            lines[0] + '\n' +
            (pos > CHARS ? '...' : '') +
            lines[1].substr(pos - left, CHARS) +
            lines[1].substr(pos, CHARS) +
            (pos + CHARS < stderr.length ? '...' : '') + '\n' +
            repeat(' ', left + (pos > CHARS ? 3 : 0)) + '^';
        }
        else
          errorMsg = stderr.length < 256
            ? stderr
            : stderr.substr(0, 128) + '...' + stderr.substr(stderr.length - 128);

        flow.warn({
          fatal: true,
          message:
            file.relOutputFilename + ' compression error:\n' +
            errorMsg
        });

        return doneFn();
      }

      fconsole.log(file.relOutputFilename + ' compressed in ' + ((new Date - packStartTime) / 1000).toFixed(3) + 's');
      if (error !== null)
        fconsole.log('exec error: ' + error);
      else
        file.outputContent = stdout.replace(/;[\r\n\s]*$/, '');

      doneFn();
    }
  );

  startFn();
  gcc.stdin.on('error', function(error){
    flow.warn({
      fatal: true,
      message:
        'Pack command: `' + command + '`\n' +
        error
    });
  });
  gcc.stdin.write(file.outputContent);
  gcc.stdin.end();
}

function uglifyProcess(file, flow){
  flow.console.log('Compress ' + file.relOutputFilename);
  file.outputContent = require('uglify-js').minify(file.outputContent);
}
