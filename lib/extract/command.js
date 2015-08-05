var path = require('path');
var clap = require.main.require('clap');
var common = require('../common/command.js');

var targets = ['app-profile', 'log', 'input-graph']; // first is default

function resolveCwd(value){
  console.log(value);
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function normOptions(options){
  // locations
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
      return path.normalize(path.resolve(this.context.config.path || '.', fn));
    }, this);
  }

  return options;
}

module.exports = clap.create('extract', '[file]')
  .description('Extract file graph')
  .extend(common)

  .init(function(){
    var config = this.context.config = this.root.getConfig(this.values);
    if (config)
    {
      this._configPath = config.path;
      this.setOptions(common.processConfig(this, config.data['build'] || {}, config.path));
    }
  })
  .args(function(args){
    this.setOption('file', resolveCwd(args[0]));
  })

  .option('--silent', 'No any output')
  .option('-t, --target <target>',
    'Define what command should produce. Target could be: ' + targets.join(', ') + ' (' + targets[0] + ' by default).',
    function(target){
      if (targets.indexOf(target) == -1)
        throw new clap.Error('Wrong value for --target option: ' + target);

      return target;
    },
    targets[0]
  )

  .option('--js-info', 'Collect javascript usage info')
  .option('--css-info', 'Collect css names info from html, style and templates')
  .option('--l10n-info', 'Collect l10n keys and dictionaries')

  .action(function(){
    var config = this.context.config;

    if (this.values.target == 'log' && config && config.filename)
      console.log('Config: ' + config.filename + '\n');

    return require('./index.js').extract.call(this, this.values);
  });

module.exports.norm = normOptions;
