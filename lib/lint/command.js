var path = require('path');
var clap = require.main.require('clap');
var common = require('../common/command.js');
var isChildProcess = typeof process.send == 'function'; // child process has send method

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function applyConfig(command, config, configPath){
  command._configPath = configPath;

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

module.exports = clap.create('lint', '[fileOrPreset]')
  .description('Lint files')
  .extend(common)

  .init(function(){
    var config = this.context.config = this.root.getConfig(this.values);
    if (config)
    {
      this._configPath = config.path;
      config = common.processConfig(this, config.data['build'] || {}, config.path);
      if (Array.isArray(config))
        this.presets = config.reduce(function(result, preset){
          result[preset.name] = preset.config;
          return result;
        }, {});
      else
        this.setOptions(config);
    }
  })
  .args(function(args){
    var value = args[0];

    if (this.presets)
    {
      if (this.values.preset)
        throw new clap.Error('Value for --preset option is already set');

      if (value in this.presets == false)
        throw new clap.Error('Preset `' + value + '` doesn\'t found');

      return this.setOption('preset', value);
    }

    this.setOption('file', resolveCwd(value));
  })

  .option('--preset <name>', 'Preset to use', { hot: true, beforeInit: true })

  .option('--no-color', 'Suppress color output')
  .option('--silent', 'No any output')

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
    var values = common.processPresets(this, 'lint');

    if (values)
      require('./index.js').lint.call(this, values);
  });

if (isChildProcess)
  module.exports
    .option('--process-config <config>', 'For internal usage only', function(value){
      this.setOptions(JSON.parse(value));
    });

module.exports.norm = normOptions;
