var exit = require('exit');
var clap = require.main.require('clap');
var configure = require('basisjs-tools-config');
var utils = require('./common/utils');

function command(name){
  return configure(require('./' + name + '/command'))
    .version(utils.getToolsId(true));
}

function run(commandName, args){
  if (!commands.hasOwnProperty(commandName))
    throw new Error('Unknown command: ' + commandName);

  try {
    commands[commandName].run(args);
  } catch(e) {
    if (e instanceof clap.Error)
      console.error(e.message || e);
    else
      throw e;

    exit(2);
  }
}

var commands = {
  extract: command('extract'),
  lint: command('lint'),
  build: command('build')
};

//
// registrate commands
//

//
// export
//

module.exports = {
  run: run,
  extract: commands.extract,
  lint: commands.lint,
  build: commands.build
};
