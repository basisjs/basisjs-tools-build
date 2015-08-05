var path = require('path');
var fs = require('fs');
var clap = require.main.require('clap');
var common = require('../common/command.js');

var targets = ['fs', 'output-graph']; // first is default

function assign(dest, source){
  for (var key in source)
    dest[key] = source[key];

  return dest;
}

// {
//   "build": {
//     ...,
//     "preset": {
//       "foo": {
//         "option": value,
//         "option": value,
//         "preset": {
//           "main": {
//             ...
//           },
//           "landing": {
//             ...
//           }
//         }
//       },
//     }
//   }
// }


function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function processConfig(command, config, configPath, presetPath){
  function collectPresets(source, baseConfig, path){
    if (!baseConfig)
    {
      baseConfig = {};
      path = '';
    }

    var presets = [];

    for (var name in source)
    {
      if (!source[name] || typeof source[name] != 'object')
        throw new clap.Error('Preset config should be an object (' + fullPath + ')');

      var presetConfig = assign(assign({}, baseConfig), source[name]);
      var fullPath = path ? path + '/' + name : name;
      var nested = false;

      presetConfig = processConfig(command, presetConfig, configPath, fullPath);

      presets.push({
        name: fullPath,
        config: presetConfig
      });

      if (Array.isArray(presetConfig))
        presets = presets.concat(presetConfig);
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
        preset = config.preset;
        break;

      case 'preprocess':
      case 'extFileTypes':
        break;

      default:
        if (!command.hasOption(name))
        {
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
    result = collectPresets(preset, result, presetPath || '');

  return result;
}

function normOptions(options){

  function addPreprocessors(type, handlerList){
    if (!Array.isArray(handlerList))
    {
      if (typeof handlerList == 'string')
        handlerList = [handlerList];
      else
        handlerList = [];
    }

    handlerList = handlerList.map(function(fn){
      return path.normalize(path.resolve(module.exports._configPath || '.', fn));
    });

    var processors = options.preprocess[type];
    if (processors)
      processors.push.apply(processors, handlerList);
    else
      options.preprocess[type] = handlerList;
  }

  common.normalize(options);
  options.output = path.normalize(path.resolve(options.output) + '/');

  if (options.pack)
  {
    this.jsBuildMode = true;
    this.jsCutDev = true;
    this.jsPack = true;
    this.cssPack = true;
  }

  // process preprocessing handlers
  var configExtFileTypes = options.extFileTypes;
  var extFileTypes = {};
  var configPreprocess = options.preprocess || {};

  options.extFileTypes = extFileTypes;
  options.preprocess = {};

  for (var type in configExtFileTypes)
  {
    var cfg = configExtFileTypes[type];
    extFileTypes[type] = cfg.type;
    if (cfg.preprocess)
      addPreprocessors(type, cfg.preprocess);
  }

  for (var type in configPreprocess)
    addPreprocessors(type, configPreprocess[type]);

  /*if (options.jsCutDev)
  {
    if (!options.preprocess['script'])
      options.preprocess['script'] = [];
    options.preprocess['script'].push('./misc/preprocess/js-cut-dev.js');
  }*/

  return options;
}

module.exports = clap.create('build', '[fileOrPreset]')
  .description('Build an app')
  .extend(common)

  .init(function(){
    var config = this.context.config = this.root.getConfig(this.values);
    if (config)
    {
      this._configPath = config.path;
      config = processConfig(this, config.data['build'] || {}, config.path);
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

  .option('--preset <name>', 'Preset to use', { beforeInit: true })
  .option('-o, --output <path>',
    'Path for output, resolve from file path (current folder by default)',
    resolveCwd,
    '.'
  )

  .option('--verbose', 'Makes output more verbose')
  .option('--no-color', 'Suppress color output')
  .option('--warnings', 'List warning messages in summary')

  .option('--same-filenames', 'Give script and style files name like basename of index file')
  .option('-t, --target <target>',
    'Define what command should produce. Target could be: ' + targets.join(', ') + ' (' + targets[0] + ' by default).',
    function(target){
      if (targets.indexOf(target) == -1)
        return new clap.Error('Wrong value for --target option: ' + target);

      return target;
    },
    targets[0]
  )

  // bulk flags
  .shortcut('-p, --pack',
    'Pack sources. It equals to: --js-build-mode --js-cut-dev --js-pack --css-pack',
    function(value){
      return {
        jsBuildMode: value,
        jsCutDev: value,
        jsPack: value,
        cssPack: value
      };
    }
  )
  .shortcut('--no-single-file',
    'Avoid merge sources into one file. It equals to: --js-no-single-file --css-no-single-file',
    function(value){
      return {
        jsSingleFile: value,
        cssSingleFile: value
      };
    }
  )

  // javascript
  .option('--js-no-single-file', 'Avoid merge javascript source into one file.')
  .option('--js-build-mode', 'Evaluate modules code (close to how basis.require works).')
  .option('--js-optimize-throws', 'Replace throw expressions for number codes.')
  .option('--js-info', 'Collect javascript usage info')
  .option('--js-pack', 'Pack javascript source.')
  .option('--js-pack-cmd <string>', 'Command to launch javascript packer, should accept input in stdio and output result in stdout (`google-closure-compiler --charset UTF-8` by default).')

  // css
  .option('--css-no-single-file', 'Avoid merge CSS source into one file.')
  .option('--css-optimize-names', 'Replace css class names for shorter one.')
  .option('--css-cut-unused', 'Cut unused selectors and rules')
  .option('--css-pack', 'Pack CSS source.')
  .option('-i, --css-inline-image <max-size>', 'Max size for image to be inlined (in bytes). Default is 0, don\'t inline images.', Number, 0)

  // l10n
  .option('-l, --l10n-pack', 'Build l10n index, pack dictionaries and replace token names for shorter one if possible.')

  // tmpl
  .option('--tmpl-default-theme <name>', 'Template theme by default (uses for basis.template, default: base).', 'base')
  .option('--tmpl-pregenerate', 'Pregenerate template functions to avoid building template functions in runtime.')

  //.on('target', handlers.target)

  .action(function(){
    var config = this.context.config;

    if (this.values.verbose && config && config.filename)
      console.log('Config: ' + config.filename + '\n');

    var values = assign({}, this.values);
    var presetName = values.preset;

    if (this.presets)
    {
      var presets;
      if (presetName)
      {
        if (presetName in this.presets == false)
          throw new clap.Error('Preset `' + this.preset + '` does\'t found');
        presets = this.presets[presetName];
      }
      else
      {
        presets = [];
        for (var name in this.presets)
          if (!Array.isArray(this.presets[name]))
            presets.push({
              name: name,
              config: this.presets[name]
            });
      }

      if (Array.isArray(presets))
      {
        if (presets.length > 1)
          return require('../common/parallel.js')(require('./index.js'), presets.map(function(preset){
            return {
              name: preset.name,
              args: ['--config-file', config.filename, '--preset', preset.name]
            };
          }, this));

        values = assign(values, presets[0].config);
      }
      else
        values = assign(values, presets);
    }

    require('./index.js').build.call(this, values);
  });

module.exports.norm = normOptions;
