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
    var target = pluginCfg.target;
    var plugin;

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
      pluginCfg.filename_ = '<inline>';
      plugin = {
        build: pluginCfg.init
      };
    }
    else
    {
      pluginCfg.filename_ = resolve.sync(pluginCfg.name, { basedir: process.cwd() });
      plugin = require(pluginCfg.filename_);
    }

    if (typeof plugin.build == 'function')
    {
      plugin.build(initPluginApi(flow, pluginCfg), pluginCfg.options || {});
      return pluginCfg.name;
    }
  }).filter(Boolean);
};
