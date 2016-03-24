var path = require('path');
var clap = require.main.require('clap');
var common = require('../common/command');
var isChildProcess = typeof process.send == 'function'; // child process has send method
var targets = ['fs', 'output-graph', 'none']; // first is default

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function normOptions(options){
  common.normalize(options);
  options.output = path.normalize(path.resolve(options.output));

  if (options.pack)
  {
    options.jsCutDev = true;
    options.jsPack = true;
    options.cssPack = true;
  }

  if (options.singleFile)
    options.cssInlineImage = 1e10; // make sure all images are inline

  if (options.silent)
  {
    options.verbose = false;
    options.stat = false;
    options.warnings = false;
  }

  if (options.verbose)
  {
    options.stat = true;
    options.warnings = true;
  }

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
  .extend(common, { preset: true })

  .option('-o, --output <path>',
    'Path for output, resolve from file path (current folder by default)',
    resolveCwd,
    '.'
  )

  .option('--silent', 'No any output')
  .option('--stat', 'Output statistics')
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

  // tmpl
  .option('--tmpl-default-theme <name>', 'Template theme by default (uses for basis.template, default: base)', 'base')
  //.option('--tmpl-pregenerate', 'Pregenerate template functions to avoid building template functions in runtime')

  .action(function(){
    var config = this.context.config;

    if (this.values.verbose && config && config.filename)
      console.log('Config: ' + config.filename + '\n');

    var values = common.processPresets(this);

    if (values)
      return require('./index.js').build.call(this, values);
  });

if (isChildProcess)
  module.exports
    .option('--process-config <config>', 'For internal usage only', function(value){
      this.setOptions(JSON.parse(value));
    });

module.exports.norm = normOptions;
module.exports.parallelSupport = true;
