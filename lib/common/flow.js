var Console = require('./console');
var FileManager = require('./files');
var chalk = require('chalk');
var path = require('path');
var exit = require('exit');

function Flow(options){
  this.startTime = Date.now();
  this.options = options;
  this.warns = [];
  this.console = new Console();

  var baseURI = options.base;
  var relBaseURI = path.dirname(path.relative(options.base, options.file));
  this.files = new FileManager(baseURI, relBaseURI, this.console, this);
}

Flow.prototype = {
  exitOnFatal: false,

  time: function(){
    return Date.now() - this.startTime;
  },
  warn: function(warn){
    this.warns.push(warn);

    if (warn.fatal)
    {
      var enabled = this.console.enabled;

      this.console.enabled = true;
      this.console.log.apply(this.console, [chalk.red('[FATAL]')].concat(warn.message));
      this.console.enabled = enabled;

      if (this.exitOnFatal)
        exit(2);
    }
    else
    {
      this.console.log.apply(this.console, [chalk.red('[WARN]')].concat(warn.message));
    }
  },
  removeWarn: function(warn){
    var idx = this.warns.indexOf(warn);
    if (idx != -1)
      this.warns.splice(idx, 1);
  }
};

module.exports = Flow;
