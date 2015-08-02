var path = require('path');
var clap = require.main.require('clap');
var common = require('../common/command.js');

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function applyConfig(command, config, configPath){
  command._configPath = configPath;

  if (config)
  {
    for (var name in config)
    {
      if (command.hasOption(name))
      {
        if (name == 'file' || name == 'base')
          config[name] = path.resolve(configPath, config[name]);

        command.setOption(name, config[name]);
      }
      else
      {
        if (name == 'preprocess' || name == 'extFileTypes')
          command.values[name] = config[name];
      }
    }

    // if no base in config, set config path as base
    if ('base' in config == false)
      command.setOption('base', configPath);
  }

  return command;
}

function normOptions(options){
  common.normalize(options);

  // process preprocessing handlers
  if (!options.preprocess)
    options.preprocess = {};

  for (var type in options.preprocess)
  {
    var handlerList = options.preprocess[type];

    if (!Array.isArray(handlerList))
    {
      if (typeof handlerList == 'string')
        handlerList = [handlerList];
      else
        handlerList = [];

      options.preprocess[type] = handlerList;
    }

    options.preprocess[type] = handlerList.map(function(fn){
      return path.normalize(path.resolve(module.exports._configPath || '.', fn));
    });
  }

  return options;
}

module.exports = clap.create('lint', '[file]')
  .description('Lint files')
  .extend(common)

  .init(function(){
    var config = this.context.config = this.root.getConfig(this.values);
    if (config)
      applyConfig(this, config.data['build'] || {}, config.path);
  })

  .option('--filter <filename>', 'Show warnings only for specified file', resolveCwd)
  .option('-r, --reporter <reporter>', 'Reporter console (default), checkstyle, junit',
    function(reporter){
      var reporters = ['console', 'checkstyle', 'junit'];

      if (reporters.indexOf(reporter) == -1)
        throw 'Wrong value for --reporter: ' + reporter;

      return reporter;
    }
  )

  .action(function(){
    return require('./index.js').lint.call(this, this.values);
  });

module.exports.norm = normOptions;
