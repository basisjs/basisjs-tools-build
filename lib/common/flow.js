var Console = require('./console');
var FileManager = require('./files');
var initPlugins = require('../common/plugins');
var chalk = require('chalk');
var path = require('path');
var isChildProcess = typeof process.send == 'function'; // child process has send method
var minimatch = require('minimatch');

function Flow(options, command){
  this.command = command;
  this.startTime = Date.now();
  this.options = options;
  this.warns = [];
  this.console = new Console();

  var baseURI = options.base;
  var relBaseURI = path.dirname(path.relative(options.base, options.file));
  this.files = new FileManager(baseURI, relBaseURI, this.console, this);
  this.plugins = initPlugins(this, options.plugins);

  var patterns = Array.isArray(this.options.ignoreWarnings) ? this.options.ignoreWarnings : [];
  this.ignoreWarning = function(filename) {
    return patterns.some(function(pattern) {
      return minimatch(filename, pattern);
    });
  }
}

Flow.prototype = {
  exitOnFatal: false,

  time: function(){
    return Date.now() - this.startTime;
  },

  exit: function(message){
    this.exitOnFatal = true;
    this.warn({
      fatal: true,
      message: message
    });
  },

  warn: function(warn){
    if (!warn.fatal && warn.file && this.ignoreWarning(warn.file))
      return false;

    this.warns.push(warn);

    if (warn.fatal)
    {
      if (this.exitOnFatal)
      {
        if (isChildProcess)
          process.send({
            errorType: 'Fatal',
            error: warn.message
          });

        this.console.resetDeep();
        this.console.enabled = true;
      }

      this.console.log.apply(this.console, [chalk.enabled ? chalk.bgRed.white('FATAL') : '[FATAL]'].concat(warn.message));

      if (this.exitOnFatal)
        process.exit(2);
    }
    else
    {
      this.console.log.apply(this.console, [chalk.enabled ? chalk.bgRed.white('WARN') : '[WARN]'].concat(warn.message));
    }
  },
  removeWarn: function(warn){
    var idx = this.warns.indexOf(warn);
    if (idx != -1)
      this.warns.splice(idx, 1);
  },
  hasWarn: function(warn){
    return this.warns.some(function(flowWarn){
      return warn.fatal == flowWarn.fatal &&
             warn.file == flowWarn.file &&
             warn.loc == flowWarn.loc &&
             warn.message == flowWarn.message;
    });
  }
};

module.exports = Flow;
