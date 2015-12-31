var path = require('path');
var fs = require('fs');
var clap = require.main.require('clap');
var common = require('../common/command.js');
var isChildProcess = typeof process.send == 'function'; // child process has send method
var targets = ['fs', 'output-graph', 'none']; // first is default

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
  options.output = path.normalize(path.resolve(options.output));

  if (options.pack)
  {
    options.jsCutDev = true;
    options.jsPack = true;
    options.cssPack = true;
  }

  if (options.singleFile)
  {
    options.cssInlineImage = 1e10; // make sure all images are inline
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
  .description('Make a build of app')
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

  .option('--preset <name>', 'Preset settings to use', { hot: true, beforeInit: true })
  .option('-o, --output <path>',
    'Path for output, resolve from file path (current folder by default)',
    resolveCwd,
    '.'
  )

  .option('--silent', 'No any output')
  .option('--verbose', 'Makes output more verbose')
  .option('--no-color', 'Suppress color output')
  .option('--warnings', 'List warning messages in summary')

  .option('--single-file', '(experimental) Produce single js file that includes all resources if possible (build fails otherwise)')

  .option('--same-filenames', 'Give script and style files name like basename of index file')
  .option('-t, --target <target>',
    'Define what command should produce. Target could be: ' + targets.join(', ') + ' (' + targets[0] + ' by default)',
    function(target){
      if (targets.indexOf(target) == -1)
        return new clap.Error('Wrong value for --target option: ' + target);

      return target;
    },
    targets[0]
  )

  // bulk flags
  .shortcut('-p, --pack',
    'Compress sources. It equals to: --js-cut-dev --js-pack --css-pack',
    function(value){
      return {
        jsCutDev: value,
        jsPack: value,
        cssPack: value
      };
    }
  )

  // javascript
  .option('--js-optimize-throws', 'Replace throw expressions for number codes')
  //.option('--js-info', 'Collect JavaScript usage info')
  .option('--js-pack', 'Compress JavaScript')
  .option('--js-pack-cmd <string>', 'Command to launch JavaScript packer, should accept input in stdio and output result in stdout (`google-closure-compiler --charset UTF-8` by default)')

  // css
  .option('--css-optimize-names', 'Replace CSS class names for shorter one')
  //.option('--css-cut-unused', 'Cut unused selectors and rules')
  .option('--css-pack', 'Compress CSS')
  .option('-i, --css-inline-image <max-size>', 'Max size for image to be inlined (in bytes). Default is 0, don\'t inline images', Number, 0)

  // l10n
  .option('-l, --l10n-pack', 'Build l10n index, pack dictionaries and replace token names for shorter one if possible (temporary do nothing)')
  .option('--l10n-packages', 'Split dictionaries by cultures and move it to external files (packages)')
  .option('--l10n-default-culture <name>', 'Culture by default (used in l10n-packages mode, default: en-US)', 'en-US')
  .option('--l10n-storage-key <name>', 'Key is used for save culture packages in browser local storage (used in l10n-packages mode, default: l10n)', 'l10n')

  // tmpl
  .option('--tmpl-default-theme <name>', 'Template theme by default (uses for basis.template, default: base)', 'base')
  //.option('--tmpl-pregenerate', 'Pregenerate template functions to avoid building template functions in runtime')

  .action(function(){
    var config = this.context.config;

    if (this.values.verbose && config && config.filename)
      console.log('Config: ' + config.filename + '\n');

    var values = common.processPresets(this, 'build');

    if (values)
      return require('./index.js').build.call(this, values);
  });

if (isChildProcess)
  module.exports
    .option('--process-config <config>', 'For internal usage only', function(value){
      this.setOptions(JSON.parse(value));
    });

module.exports.norm = normOptions;
