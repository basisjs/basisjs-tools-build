var assert = require('assert');
var path = require('path');
var program = require('../../lib/cli');
var build = require('../../lib/build');
var buildCommand = require('../../lib/build/command');
var CWD = path.normalize(process.env.PWD || process.cwd());

// describe('config apply', function(){
//   it('should return true for ES3 keywords', function(){
//     program.run(['basis', 'build']);
//   });
// });

var getConfig = (function(){
  var configFile_;
  var config_;

  return function(argv, cwd, raw){
    // set new cwd
    var PWD = process.env.PWD;
    process.chdir(cwd || CWD);
    process.env.PWD = cwd || CWD;

    // run command
    var config = buildCommand.getConfig();

    // restore pwd
    process.env.PWD = PWD;
    process.chdir(CWD);

    // return config info as result
    return config;
  };
})();

function unixpath(path, base){
  path = path.normalize(path).replace(/^[a-z]+:/i, '').replace(/\\/g, '/');

  if (base)
    path.resolve(base, path);

  return path;
}

// tests are broken
// TODO: fix it
describe.skip('paths', function(){
  describe('base & file', function(){
    it('default values', function(){
      var cwd = CWD;
      var config = getConfig(['build']);

      assert.equal(config.filename, null);
      assert.equal(config.options.base, CWD);
      assert.equal(config.options.file, CWD + 'index.html');
      assert.equal(config.options.output, CWD + 'build' + path.sep);
    });

    //          config     cli
    // base      foo        -
    // file      bar
    // output    baz
    it('values from config with cwd equals config path', function(){
      var cwd = path.resolve(__dirname, 'env/basic');
      var config = getConfig(['build'], cwd, true);

      assert.equal(config.filename, path.resolve(cwd, 'basis.config'));
      assert.equal(config.options.base, path.resolve(cwd, 'foo') + path.sep);
      assert.equal(config.options.file, path.resolve(cwd, 'foo/bar'));
      assert.equal(config.options.output, path.resolve(cwd, 'foo/baz') + path.sep);
    });

    // it('values from config with cwd equals nested dir from config', function(){
    //   var cwd = path.resolve(__dirname, 'env/basic/nested');
    //   var config = getConfig(['build'], cwd);

    //   assert.equal(config.filename, path.resolve(cwd, '../basis.config'));
    //   assert.equal(config.options.base, path.resolve(cwd, '../foo') + path.sep);
    //   assert.equal(config.options.file, path.resolve(cwd, '../foo/bar'));
    //   assert.equal(config.options.output, path.resolve(cwd, '../foo/baz') + path.sep);
    // });
  });

  describe('output', function(){
    it('default values', function(){
      var cwd = CWD;
      var config = getConfig(['build']);

      assert.equal(config.filename, null);
      assert.equal(config.options.output, path.resolve(CWD, 'build') + path.sep);
    });

    //          config     cli
    // output    baz        -
    it('values from config with cwd equals to config path', function(){
      var cwd = path.resolve(__dirname, 'env/basic');
      var config = getConfig(['build'], cwd);

      assert.equal(config.filename, path.resolve(cwd, 'basis.config'));
      assert.equal(config.options.output, path.resolve(cwd, 'baz') + path.sep);
    });

    //          config     cli
    // output    baz        -
    it('value from command line should override config', function(){
      var cwd = path.resolve(__dirname, 'env/basic');
      var config = getConfig(['build', '--output', 'booo'], cwd);

      assert.equal(config.filename, path.resolve(cwd, 'basis.config'));
      assert.equal(config.options.output, path.resolve(cwd, 'booo') + path.sep);
    });
  });
});
