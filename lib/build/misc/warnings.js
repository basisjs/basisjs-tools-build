var chalk = require('chalk');

module.exports = function(flow){
  var fconsole = flow.console;
  var warns = {};

  if (flow.options.silent)
    return;

  if (!flow.options.verbose)
  {
    fconsole.resetDeep();
    fconsole.enabled = true;
  }

  if (!flow.warns.length)
  {
    if (flow.options.warnings)
      fconsole.log(chalk.green('\nNo warning'));
    return;
  }
  else
  {
    fconsole.log('\nWarnings: ' + chalk.bgRed(flow.warns.length));
  }

  if (!flow.options.warnings)
    return;

  flow.warns.forEach(function(item){
    var filename = item.file || '[no file]';
    if (!warns[filename])
      warns[filename] = [];
    warns[filename].push(item.message);
  });

  fconsole.incDeep();
  for (var filename in warns)
  {
    fconsole.start(filename);
    fconsole.list(warns[filename]);
    fconsole.endl();
  }
  fconsole.end();
};

module.exports.handlerName = 'Warnings';
module.exports.silent = true;
