var cli = require('../../lib/cli.js');
var path = require('path');
var assert = require('assert');

function assertExtract(baseURI, path, args){
  process.env.PWD = baseURI + path;
  return cli.extract.run(args.concat('--silent'));
};

function hasWarning(warns, criteria){
  function checkValue(value, checker){
    if (checker instanceof RegExp)
      return checker.test(value);
    if (typeof checker == 'function')
      return Boolean(checker(value));
    return checker === value;
  }
  return warns.some(function(warning){
    for (var key in criteria)
      if (!checkValue(warning[key], criteria[key]))
        return false;

    return true;
  });
}

describe('check files not found warning', function(){
  var envPath = __dirname + '/env/not-found';

  it('default base', function(){
    return assertExtract(envPath, '', []).then(function(flow){
      assert(flow.warns.length === 3);
      assert(hasWarning(flow.warns, { fatal: true, file: '/not-found/app.l10n', message: new RegExp('not-found/bad-ref.tmpl') }));
      assert(hasWarning(flow.warns, { fatal: true, file: '/not-found/app.tmpl', message: new RegExp('not-found/some/bad.path') }));
      assert(hasWarning(flow.warns, { fatal: true, file: '/not-found/app.tmpl', message: new RegExp('bad.tmpl.ref') }));
    });
  });
});
