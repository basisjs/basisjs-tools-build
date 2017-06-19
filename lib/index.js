function lazyRequire(path) {
    return {
        enumerable: true,
        get: function() {
            return require(path);
        }
    };
}

Object.defineProperties(module.exports, {
    cli: lazyRequire('./cli'),
    extract: lazyRequire('./extract'),
    lint: lazyRequire('./lint'),
    build: lazyRequire('./build')
});
