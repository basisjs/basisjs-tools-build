var path = require('path');
var clap = require.main.require('clap');
var common = require('../common/command');
var isChildProcess = typeof process.send == 'function'; // child process has send method
var handleUnusedL10n = require('./reporter/parallel-process-unused-l10n');

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function normOptions(options){
  common.normalize(options, 'lint');

  return options;
}

module.exports = clap.create('lint', '[fileOrPreset]')
  .description('Lint source code and output report')
  .extend(common, { preset: true })

  .option('--no-color', 'Suppress color output')
  .option('--silent', 'No any output')

  .option('--warn-unused-l10n <dir>', 'Warn about unused l10n tokens for specified path. Avoid using with --js-cut-dev since it might cause to incorrect results')
  .option('--filter <filename>', 'Show warnings only for specified file', resolveCwd)
  .option('-r, --reporter <name>', 'Reporter console (default), checkstyle, junit',
    function(reporter){
      var reporters = ['console', 'checkstyle', 'junit'];

      if (reporters.indexOf(reporter) == -1)
        throw 'Wrong value for --reporter: ' + reporter;

      return reporter;
    }
  )

  .action(function(){
    var values = common.processPresets(this);

    if (values)
      require('./index.js').lint.call(this, values);
  });

if (isChildProcess)
  module.exports
    .option('--process-config <config>', 'For internal usage only', function(value){
      this.setOptions(JSON.parse(value));
    });

module.exports.norm = normOptions;
module.exports.parallelSupport = true;
module.exports.getParallelOptions = function(){
  var command = this;
  if (command.values.reporter)
    return {
      silent: true,
      callback: function(res){
        handleUnusedL10n(res);

        var reporter = require(require('./reporter')[command.values.reporter]);
        var data = require('./reporter/parallel-process-warns.js')(res);
        console.log(reporter(data));
      }
    };
};
