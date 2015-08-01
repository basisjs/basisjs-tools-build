var path = require('path');
var clap = require.main.require('clap');

var targets = ['output-graph', 'fs']; // last is default
var handlers = {
  target: function(target){
    target = String(target).toLowerCase();

    if (targets.indexOf(target) == -1)
      return 'fs';

    return target;
  }
};

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
        if (name == 'file' || name == 'output' || name == 'base')
          config[name] = path.resolve(configPath, config[name]);

        command.setOption(name, config[name]);
      }
      else
      {
        if (name == 'preprocess' || name == 'extFileTypes')
          command.values[name] = config[name];
        else
          console.warn('Unknown option `' + name + '` in config (ignored)');
      }
    }

    // if no base in config, set config path as base
    if ('base' in config == false)
      command.setOption('base', configPath);
  }

  return command;
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

  // locations
  options.file = path.normalize(path.resolve(options.file));
  options.base = path.normalize((options.base ? path.resolve(options.base) : path.dirname(options.file)) + '/');
  options.output = path.normalize(path.resolve(options.output) + '/');

  // process preprocessing handlers
  if (!options.preprocess)
    options.preprocess = {};

  if (options.pack)
  {
    this.jsBuildMode = true;
    this.jsCutDev = true;
    this.jsPack = true;
    this.cssPack = true;
  }

  var configExtFileTypes = options.extFileTypes;
  var extFileTypes = {};
  var configPreprocess = options.preprocess;

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

module.exports = clap.create('build', '[file]')
  .description('Build an app')

  .init(function(){
    var config = this.context.config = this.root.getConfig(this.values);
    if (config)
      applyConfig(this, config.data['build'] || {}, config.path);
  })
  .args(function(filename){
    this.setOption('file', filename);
  })

  .option('-b, --base <path>',
    'Base input path for path resolving (current path by default)',
    resolveCwd
  )
  .option('-f, --file <filename>',
    'File name of file to build, resolve from base path (index.html by default)',
    resolveCwd,
    'index.html'
  )
  .option('-o, --output <path>',
    'Path for output, resolve from file path (build by default)',
    resolveCwd,
    'build'
  )
  .option('--verbose', 'Makes output more verbose')
  .option('--no-color', 'Suppress color output')
  .option('--warnings', 'List warning messages in summary')

  .option('--same-filenames', 'Give script and style files name like basename of index file')
  .option('-t, --target <target>',
    'Define what build should produce. Target could be: ' + targets.join(', ') + ' (file system by default).',
    handlers.target,
    targets[targets.length - 1]
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
  .option('--js-cut-dev', 'Remove code marked as debug from javascript source (cut off lines after ;;; and /** @cut .. */)')
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

    require('./index.js').build.call(this, this.values);
  });

module.exports.norm = normOptions;
