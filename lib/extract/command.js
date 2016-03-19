var path = require('path');
var clap = require.main.require('clap');
var common = require('../common/command');
var assign = require('../common/utils').assign;
var targets = ['app-profile', 'log', 'input-graph']; // first is default

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function normOptions(options){
  // locations
  common.normalize(options);

  return options;
}

module.exports = clap.create('extract', '[fileOrPreset]')
  .description('Extract app profile')
  .extend(common)

  .init(function(){
    var config = this.context.config = this.root.getConfig(this.values);
    if (config)
    {
      this._configPath = config.path;
      config = common.processConfig(this, config);

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

  .option('--silent', 'No any output')
  .option('-t, --target <target>',
    'Define what command should produce. Target could be: ' + targets.join(', ') + ' (' + targets[0] + ' by default)',
    function(target){
      if (targets.indexOf(target) == -1)
        throw new clap.Error('Wrong value for --target option: ' + target);

      return target;
    },
    targets[0]
  )

  .option('--js-info', 'Collect JavaScript usage info')
  .option('--css-info', 'Collect CSS names info from html, style and templates')
  .option('--l10n-info', 'Collect l10n keys and dictionaries info')

  .action(function(){
    var config = this.context.config;

    if (this.values.target == 'log' && config && config.filename)
      console.log('Config: ' + config.filename + '\n');

    var values = common.processPresets(this);

    if (values)
      return require('./index.js').extract.call(this, values);
  });

module.exports.norm = normOptions;
