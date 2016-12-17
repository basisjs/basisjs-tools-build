var fs = require('fs');
var path = require('path');
var resolve = require('resolve');
var assign = require('./utils').assign;
var clap = require.main.require('clap');

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function list(name){
  return function(value){
    var list = this.values[name];
    if (!list || list.fromConfig)
      list = [];
    list = list.concat(value);
    if (value && value.fromConfig)
      list.fromConfig = true;
    return list;
  };
}

function buildConfig(command, config, configPath, presetPath){
  function collectPresets(source, baseConfig, path){
    var presets = [];

    for (var name in source)
    {
      if (!source[name] || typeof source[name] != 'object')
        throw new clap.Error('Preset config should be an object (' + fullPath + ')');

      var presetConfig = assign({}, baseConfig, source[name]);
      var fullPath = path ? path + '/' + name : name;

      presetConfig = buildConfig(command, presetConfig, configPath, fullPath);

      if (presetConfig.preset)
      {
        presets = presets.concat(presetConfig.preset);
        presetConfig = presetConfig.preset;
      }

      presets.push({
        name: fullPath,
        config: presetConfig
      });
    }

    return presets;
  }

  var result = {};
  var preset;

  for (var name in config)
  {
    switch (name)
    {
      case 'ignoreWarnings':
        result.ignoreWarnings = Array.isArray(config[name]) ? config[name].slice() : [];
        result.ignoreWarnings.fromConfig = true;
        break;

      case 'preset':
        if (command.hasOption('preset'))
          preset = config.preset;
        break;

      case 'theme':
        result.theme = [Array.isArray(config.theme) ? config.theme : [config.theme]];
        result.theme[0].fromConfig = true;
        break;

      case 'preprocess':
      case 'extFileTypes':
        console.warn('Config option `' + name + '` is not supported anymore. Use `plugins` section instead.');
        break;

      default:
        if (!command.hasOption(name))
        {
          if (command.name == 'build')
            console.warn('Unknown option `' + name + '` in config (ignored)');
          continue;
        }

        if (name == 'file' || name == 'output' || name == 'base')
          result[name] = path.resolve(configPath, config[name]);
        else
          result[name] = config[name];
    }
  }

  // if no base in config, set config path as base
  if ('base' in config == false)
    result.base = configPath;

  if (preset)
    result.preset = collectPresets(preset, result, presetPath || '');

  return result;
}

function processConfig(command, config){
  var result = buildConfig(command, config.data['build'] || {}, config.path);

  if (config.data.plugins)
    command.values.plugins = config.data.plugins;

  return result;
}

module.exports = function(command, options){
  command
    .option('-b, --base <path>',
      'Base input path for path resolving (current path by default)',
      resolveCwd
    )
    .option('-f, --file <filename>',
      'File name of file to extract, resolve from base path (index.html by default)',
      resolveCwd
    )
    .option('--js-cut-dev', 'Remove code marked as debug from JavaScript source (cut off lines after ;;; and /** @cut .. */)')
    .option('--theme <name>', 'Which template themes to use (all by default)', list('theme'))
    .option('--ignore-warnings <pattern>', 'Set file pattern to be ignored by linter', list('ignoreWarnings'));

  if (options && options.preset)
    command
      .option('--preset <name>', 'Preset settings to use', { hot: true, beforeInit: true })
      .init(function(){
        var config = this.context.config = this.root.getConfig(this.values);

        if (config)
        {
          config = processConfig(this, config);

          for (var key in config)
            if (key == 'preset')
              this.presets = config.preset.reduce(function(result, preset){
                result[preset.name] = preset.config;
                return result;
              }, {});
            else
              this.setOption(key, config[key]);
        }

        this._baseValues = assign({}, this.values);
      })
      .args(function(args){
        var value = args[0];
        var file = resolveCwd(value);

        if (this.presets)
        {
          if (this.values.preset)
            throw new clap.Error('Value for --preset option is already set');

          if (value in this.presets)
            return this.setOption('preset', value);

          if (!fs.existsSync(file) || !fs.statSync(file).isFile())
            throw new clap.Error('Preset or file `' + value + '` doesn\'t found');
        }

        this.setOption('file', file);
      });
};

module.exports.processConfig = processConfig;

module.exports.normalize = function(options, command){
  options.file = path.normalize(options.file ? path.resolve(options.file) : resolveCwd('index.html'));
  options.base = path.normalize(options.base ? path.resolve(options.base) : path.dirname(options.file));

  options.theme = options.theme ? String(options.theme).trim().split(/\s*,\s*|\s+/) : '';
  if (!options.theme.length)
    options.theme = false;

  var resolvePath = options.configFile ? path.dirname(options.configFile) : process.cwd();
  options.plugins = (Array.isArray(options.plugins) ? options.plugins : [])
    .filter(function(config){
      if (!config)
        return;

      // if target is specified and has no `build` - ignore plugin
      if (config.target)
      {
        var target = config.target;

        if (!Array.isArray(target))
          target = String(target).trim().split(/\s+/);

        if (target.indexOf('build') == -1)
          if (!command || target.indexOf('build:' + command) == -1)
            return;
      }

      return true;
    })
    .map(function(config){
      if (typeof config == 'string')
        config = {
          name: config,
          ignore: false
        };
      else
        config.ignore = Array.isArray(config.ignore)
          ? config.ignore.map(function(fileMask){
              return path.resolve(resolvePath, fileMask);
            })
          : false;

      config.name = config.name || config.filename;
      config.filename = resolve.sync(config.filename || config.name, { basedir: resolvePath });

      return config;
    });

  // add preprocessor to cut lines starting with /** @cut */ or ;;;
  if (options.jsCutDev)
    options.plugins.unshift({
      name: 'js-cut-dev',
      init: function(api){
        api.addPreprocessor('.js', function(content){
          return content.replace(/(;;;|\/\*\*\s*@cut.*?\*\/).*([\r\n]|$)/g, '$2');
        });
      }
    });
};

module.exports.processPresets = function(command){
  var config = command.context.config;
  var values = assign({}, command.values);
  var presetName = values.preset;
  var cliValues = {};

  // CLI values has priority over preset values
  for (var option in values)
    if (command._baseValues[option] !== values[option])
      cliValues[option] = values[option];

  if (command.presets && !values.file)
  {
    var presets;
    if (presetName)
    {
      if (presetName in command.presets == false)
        throw new clap.Error('Preset `' + command.preset + '` does\'t found');
      presets = command.presets[presetName];
    }
    else
    {
      presets = [];
      for (var name in command.presets)
        if (!Array.isArray(command.presets[name]))
          presets.push({
            name: name,
            config: command.presets[name]
          });
    }

    if (Array.isArray(presets))
    {
      if (presets.length > 1)
      {
        if (!command.parallelSupport)
        {
          console.warn('`' + command.name + '` doesn\'t parallel tasks running');
          process.exit(2);
        }

        var options = typeof command.getParallelOptions == 'function' ? command.getParallelOptions() : null;
        var tasks = presets.map(function(preset){
          return {
            name: preset.name,
            args: [
              '--no-config',
              '--process-config', JSON.stringify(assign({}, values, preset.config, cliValues))
            ]
          };
        }, command);

        require('../common/parallel.js')(command.name, tasks, options);

        return;
      }

      assign(values, presets[0].config, cliValues);
    }
    else
      assign(values, presets, cliValues);
  }

  if (!values.base && config)
    values.base = config.path;

  return values;
};
