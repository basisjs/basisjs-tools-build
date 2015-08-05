var path = require('path');
var clap = require.main.require('clap');
var common = require('../common/command.js');

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function applyConfig(command, config, configPath){
  for (var name in config)
  {
    if (command.hasOption(name))
    {
      if (name == 'file' || name == 'base')
        config[name] = path.resolve(configPath, config[name]);

      command.setOption(name, config[name]);
    }
  }

  // if no base in config, set config path as base
  if ('base' in config == false)
    command.setOption('base', configPath);

  return command;
}

function normOptions(options){
  common.normalize(options);

  return options;
}

module.exports = clap.create('find', '<reference>')
  .description('Resolve filename by reference')
  .extend(common)

  .init(function(){
    var config = this.context.config = this.root.getConfig(this.values);
    if (config)
      applyConfig(this, config.data['build'] || {}, config.path);
  })
  .args(function(ref){
    this.setOption('reference', ref);
  })

  .option('--reference <string>', 'Reference to resolve')
  .option('--verbose', 'Output some debug information')

  .action(function(){
    return require('./index.js').find.call(this, this.values);
  });

module.exports.norm = normOptions;
