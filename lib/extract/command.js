var clap = require.main.require('clap');
var common = require('../common/command');
var targets = [
  'app-profile', // first is default
  'log',
  'input-graph',
  'css-usage'
];

function normOptions(options){
  // locations
  common.normalize(options, 'extract');

  if (options.target === 'css-usage')
    options.cssInfo = true;

  return options;
}

module.exports = clap.create('extract', '[fileOrPreset]')
  .description('Extract app profile')
  .extend(common, { preset: true })

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
