var path = require('path');
var resolve = require('resolve');
var Minimatch = require('minimatch').Minimatch;

function initPluginApi(flow, pluginOptions){
  var ignore;

  if (Array.isArray(pluginOptions.ignore))
    ignore = pluginOptions.ignore.map(function(fileMask){
      return new Minimatch(fileMask, { dot: true });
    });

  return {
    addPreprocessor: function(ext, fn){
      if (ext in flow.files.preprocess === false)
        flow.files.preprocess[ext] = [];

      flow.files.preprocess[ext].push(function(content, file, baseURI, fconsole){
        var shouldIgnore = ignore && ignore.some(function(minimatch){
          return minimatch.match(file.relpath);
        });

        if (shouldIgnore)
          return content;

        return fn(content, file.fsFilename);
      });
    }
  };
};

module.exports = function initPlugins(flow, plugins){
  if (!Array.isArray(plugins))
    throw new Error('plugins should be an array');

  return plugins.map(function(pluginCfg, index, array){
    var pluginFilename = resolve.sync(pluginCfg.name, { basedir: process.cwd() });
    var plugin = require(pluginFilename);

    pluginCfg.filename_ = pluginFilename;

    if (typeof plugin.build == 'function')
    {
      plugin.build(initPluginApi(flow, pluginCfg), pluginCfg.options || {});
      return pluginCfg.name;
    }
  }).filter(Boolean);
};
