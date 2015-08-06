var path = require('path');
var fs = require('fs');
var clap = require.main.require('clap');
var common = require('../common/command.js');
var isChildProcess = typeof process.send == 'function'; // child process has send method
var targets = ['fs', 'output-graph']; // first is default

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
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
      config = common.processConfig(this, config.data['build'] || {}, config.path);

      for (var key in config)
        if (key == 'preset')
          this.presets = config.preset.reduce(function(result, preset){
            result[preset.name] = preset.config;
            return result;
          }, {});
        else
          this.setOption(key, config[key]);
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

    var values = common.processPresets(this, 'build');

    if (values)
      require('./index.js').build.call(this, values);
  });

if (isChildProcess)
  module.exports
    .option('--process-config <config>', 'For internal usage only', function(value){
      this.setOptions(JSON.parse(value));
    });

module.exports.norm = normOptions;
