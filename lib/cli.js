var exit = require('exit');
var clap = require('clap');
var configure = require('basisjs-tools-config');
var utils = require('./common/utils');

function command(name){
  return configure(require('./' + name + '/command'))
    .version(utils.getToolsId(true));
}

function run(command){
  return function(args){
    try {
      command.run(args);
    } catch(e) {
      if (e instanceof clap.Error)
        console.error(e.message || e);
      else
        throw e;

      exit(2);
    }
  };
}

var commands = {
  extract: configure(require('./extract/command')),
  lint: configure(require('./lint/command')),
  build: configure(require('./build/command'))
};

//
// registrate commands
//

//
// export
//

module.exports = {
  commands: commands,
  extract: run(commands.extract),
  lint: run(commands.lint),
  build: run(commands.build)
};
