function lazyRequire(path){
  var exports;
  return {
    enumerable: true,
    get: function(){
      if (!exports)
        exports = require(path);
      return exports;
    }
  };
}

Object.defineProperties(module.exports, {
  cli: lazyRequire('./cli'),
  extract: lazyRequire('./extract'),
  lint: lazyRequire('./lint'),
  build: lazyRequire('./build')
});
