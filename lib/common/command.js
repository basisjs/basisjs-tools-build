var path = require('path');

function assign(dest, source){
  for (var key in source)
    dest[key] = source[key];

  for (var i = 2; i < arguments.length; i++)
    assign(dest, arguments[i]);

  return dest;
}

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function processConfig(command, config, configPath, presetPath){
  function collectPresets(source, baseConfig, path){
    var presets = [];

    for (var name in source)
    {
      if (!source[name] || typeof source[name] != 'object')
        throw new clap.Error('Preset config should be an object (' + fullPath + ')');

      var presetConfig = assign({}, baseConfig, source[name]);
      var fullPath = path ? path + '/' + name : name;
      var nested = false;

      presetConfig = processConfig(command, presetConfig, configPath, fullPath);

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
      case 'preset':
        if (command.hasOption('preset'))
          preset = config.preset;
        break;

      case 'theme':
        result.theme = [Array.isArray(config.theme) ? config.theme : [config.theme]];
        result.theme[0].fromConfig = true;
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

module.exports = function(command){
  return command
    .option('-b, --base <path>',
      'Base input path for path resolving (current path by default)',
      resolveCwd
    )
    .option('-f, --file <filename>',
      'File name of file to extract, resolve from base path (index.html by default)',
      resolveCwd
    )
    .option('--js-cut-dev', 'Remove code marked as debug from JavaScript source (cut off lines after ;;; and /** @cut .. */)')
    .option('--theme <name>', 'Which template themes to use (all by default)', function(value){
      var themes = this.values.theme;
      if (!themes || themes.fromConfig)
        themes = [];
      themes = themes.concat(value);
      if (value.fromConfig)
        themes.fromConfig = true;
      return themes;
    });
};

module.exports.processConfig = function(command, config){
  var result = processConfig(command, config.data['build'] || {}, config.path);

  if (config.data.plugins)
    command.values.plugins = config.data.plugins;

  return result;
};

module.exports.normalize = function(options){
  options.file = path.normalize(options.file ? path.resolve(options.file) : resolveCwd('index.html'));
  options.base = path.normalize(options.base ? path.resolve(options.base) : path.dirname(options.file));

  options.theme = options.theme ? String(options.theme).trim().split(/\s*,\s*|\s+/) : '';
  if (!options.theme.length)
    options.theme = false;

  var plugins = Array.isArray(options.plugins) ? options.plugins : [];
  options.plugins = plugins.map(function(item){
    if (!item)
      return false;

    if (typeof item == 'string')
      return { name: item };

    item.ignore = Array.isArray(item.ignore)
      ? item.ignore.map(function(fileMask){
          return module.exports._configPath ? path.resolve(module.exports._configPath, fileMask) : fileMask;
        })
      : false;

    return item;
  }).filter(Boolean);
};

module.exports.processPresets = function(command){
  var config = command.context.config;
  var values = assign({}, command.values);
  var presetName = values.preset;

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
        var options = typeof command.getParallelOptions == 'function' ? command.getParallelOptions() : null;
        var tasks = presets.map(function(preset){
          return {
            name: preset.name,
            args: [
              '--no-config',
              '--process-config', JSON.stringify(assign({}, values, preset.config))
            ]
          };
        }, command);

        require('../common/parallel.js')(command.name, tasks, options);

        return;
      }

      assign(values, presets[0].config);
    }
    else
      assign(values, presets);
  }

  if (!values.base && config)
    values.base = config.path;

  return values;
};
