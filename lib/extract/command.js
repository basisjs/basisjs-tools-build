var path = require('path');
var clap = require.main.require('clap');

var targets = ['app-profile', 'log', 'input-graph']; // first is default

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function applyConfig(command, config, configPath){
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
        if (name == 'sameFilenames' || name == 'tmplDefaultTheme')
          continue;

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
  // locations
  options.file = path.normalize(options.file ? path.resolve(options.file) : resolveCwd('index.html'));
  options.base = path.normalize((options.base ? path.resolve(options.base) : path.dirname(options.file)) + '/');
  options.output = path.normalize(path.resolve(options.output) + '/');

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
      return path.normalize(path.resolve(this.context.configPath || '.', fn));
    }, this);
  }

  return options;
}

module.exports = clap.create('extract', '[file]')
  .description('Extract file graph')

  .init(function(){
    var config = this.context.config = this.root.getConfig(this.values);
    if (config)
      applyConfig(this, config.data['build'] || {}, config.path);
  })

  .option('-b, --base <path>',
    'Base input path for path resolving (current path by default)',
    resolveCwd
  )
  .option('-f, --file <filename>',
    'File name of file to extract, resolve from base path (index.html by default)',
    resolveCwd
  )
  .option('-o, --output <path>',
    'Path for output, resolve from file path (current folder by default)',
    resolveCwd,
    '.'
  )

  .option('-t, --target <target>',
    'Define what command should produce. Target could be: ' + targets.join(', ') + ' (' + targets[0] + ' by default).',
    function(target){
      if (targets.indexOf(target) == -1)
        throw new clap.Error('Wrong value for --target option: ' + target);

      return target;
    },
    targets[0]
  )
  .option('--silent', 'No any output')

  .option('--js-cut-dev', 'Remove code marked as debug from javascript source (cut off lines after ;;; and /** @cut .. */)')
  .option('--js-info', 'Collect javascript usage info')

  .option('--css-info', 'Collect css names info from html, style and templates')
  .option('--l10n-info', 'Collect l10n keys and dictionaries')

  .args(function(filename){
    this.setOption('file', filename);
  })

  .action(function(){
    var config = this.context.config;

    if (this.values.target == 'log' && config && config.filename)
      console.log('Config: ' + config.filename + '\n');

    return require('./index.js').extract.call(this, this.values);
  });

module.exports.norm = normOptions;
