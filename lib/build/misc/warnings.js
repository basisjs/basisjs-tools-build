var chalk = require('chalk');

module.exports = function(flow){
  var fconsole = flow.console;
  var warns = {};

  if (!flow.options.verbose)
  {
    fconsole.resetDeep();
    fconsole.enabled = true;
    fconsole.log();
  }

  if (false && !flow.warns.length)
  {
    fconsole.log(chalk.green('No warning'));
    return;
  }
  else
  {
    if (!flow.options.verbose)
      fconsole.log('Warnings: ' + chalk.bgRed(flow.warns.length));
  }

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
module.exports.skip = function(flow){
  return !flow.options.warnings;
};
