var path = require('path');
var Minimatch = require('minimatch').Minimatch;

function initPluginApi(flow, pluginOptions){
  var ignore;

  if (Array.isArray(pluginOptions.ignore))
    ignore = pluginOptions.ignore.map(function(fileMask){
      return new Minimatch(fileMask, { dot: true });
    });

  return {
    addSymlink: function(from, to){
      flow.files.addSymlink(from, to);
    },
    addPreprocessor: function(ext, fn){
      if (ext in flow.files.preprocess === false)
        flow.files.preprocess[ext] = [];

      flow.files.preprocess[ext].push(function(content, file, baseURI){
        var shouldIgnore = ignore && ignore.some(function(minimatch){
          return minimatch.match(path.relative(baseURI, file.fsFilename));
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

  return plugins.map(function(pluginCfg){
    var initPlugin;
    var target = pluginCfg.target;

    // if target is specified and has no `build` - ignore plugin
    if (target)
    {
      if (!Array.isArray(target))
        target = String(target).trim().split(/\s+/);

      if (target.indexOf('build') == -1)
        if (!flow.command || target.indexOf('build:' + flow.command) == -1)
          return;
    }

    if (typeof pluginCfg.init == 'function')
    {
      pluginCfg.filename = '<inline>';
      initPlugin = pluginCfg.init;
    }
    else
    {
      initPlugin = require(pluginCfg.filename);
    }

    if (typeof initPlugin.build == 'function')
      initPlugin = initPlugin.build;

    if (typeof initPlugin == 'function')
    {
      initPlugin(initPluginApi(flow, pluginCfg), pluginCfg.options || {});
      return pluginCfg.name;
    }
  }).filter(Boolean);
};
