var js_at = require('basisjs-tools-ast').js;
var path = require('path');
var hasOwnProperty = Object.prototype.hasOwnProperty;
var stableIsolate = false;
var utils = js_at.utils;

function createSeedRandomIsolatePrefixFactory(flow){
  var seedrandom = require('seedrandom');
  var crypto = require('crypto');
  var queue = flow.files.queue;
  var lastFile = 0;
  var seed = '';
  var used = {};
  var random;

  return function(){
    // update seed by content hash
    if (lastFile < queue.length)
    {
      var hash = crypto.createHash('sha1');
      hash.update(seed);
      for (; lastFile < queue.length; lastFile++)
      {
        var file = queue[lastFile];
        hash.update(file.content || '', file.encoding);
      }

      seed = hash.digest('base64');
      random = seedrandom(seed);
    }

    return (function genRandomPrefix(){
      // prefix should starts with alpha
      var result = Math.round(10 + 25 * random()).toString(36);

      while (result.length < 16)
        result += Math.round(10e10 * random()).toString(36);

      result = result.substr(0, 16) + '__';

      // double sure we are not produce some uid twice
      if (result in used)
        return genRandomPrefix();

      used[result] = true;
      return result;
    })();
  };
}

function createStableIsolatePrefixFactory(){
  var stableIsolateSeed = 1;
  return function(){
    return 'stablePrefix' + (stableIsolateSeed++) + '__';
  };
}

function arrayAddUnique(array, value){
  return array.indexOf(value) == -1 && !!array.push(value);
}

function sortThemes(map){
  var weightMap = {};

  for (var name in map)
  {
    var weight = 1;
    var cursor = name;

    while (cursor != 'base')
    {
      cursor = map[cursor];
      weight++;
    }

    weightMap[name] = weight;
  }

  return Object.keys(weightMap).sort(function(a, b){
    return weightMap[a] - weightMap[b];
  });
}

function correctLoc(loc){
  if (!loc)
    return null;

  return {
    line: loc.line - 1,
    column: loc.column - 1
  };
}

function copyWarnsToFlow(warns, knownNestedWarnings, flow, themeName, sourceFilename){
  if (warns)
    warns.forEach(function(warn){
      var filename = sourceFilename;

      if (warn.loc)
      {
        var locFilename = warn.loc.replace(/\:\d+\:\d+$/, '');
        if (locFilename != filename)
        {
          filename = locFilename;

          // filter duplicated
          if (!knownNestedWarnings[filename])
            knownNestedWarnings[filename] = {};

          if (knownNestedWarnings[filename][warn + warn.loc])
            return;

          knownNestedWarnings[filename][warn + warn.loc] = true;
        }
      }

      flow.warn({
        file: filename,
        theme: themeName,
        fatal: /<b:include .+ not resolved/.test(String(warn)),
        message: String(warn),
        loc: warn.loc
      });
    });
}


(module.exports = function(flow){
  var fconsole = flow.console;
  var basisTemplate = flow.js.basis.template;
  var genIsolatePrefix;

  //
  // setup isolate prefix generation
  //

  if (stableIsolate)
    genIsolatePrefix = createStableIsolatePrefixFactory();
  else
    genIsolatePrefix = createSeedRandomIsolatePrefixFactory(flow);

  if (typeof basisTemplate.setIsolatePrefixGenerator == 'function')
  {
    fconsole.start('Set reproducing isolate prefix generator – OK');
    basisTemplate.setIsolatePrefixGenerator(genIsolatePrefix);
    flow.tmpl.isolationReproducible = true;
    genIsolatePrefix = null;
  }
  else
  {
    fconsole.start('Setting reproducing isolate prefix generator is not supported');
  }


  //
  // process tmpl resources
  //

  var implicitMap = {};
  var implicitDefine = flow.tmpl.implicitDefine;
  var themeFallbackMap = {};

  fconsole.start('Check templates and implicit define');
  flow.js.resources.forEach(function(token){
    var file = token.resourceRef;
    if (file.type == 'template')
    {
      if (!token.themeDefined)
      {
        var templateGet = js_at.parse('basis.template.get', 1);
        var id;

        if (!implicitMap[file.relpath])
        {
          id = '.' + (flow.tmpl.implicitDefineSeed++).toString(36);
          implicitMap[file.relpath] = id;
          var resToken = utils.extend({}, token);
          resToken.ref_ = token.ref_;
          resToken.resourceRef = token.resourceRef;
          flow.tmpl.themeResources.base[id] = resToken;
          implicitDefine.base[id] = token.resourceRef;
        }
        else
        {
          id = implicitMap[file.relpath];
        }

        var beforeChanges = js_at.translate(token);
        token.ref_ = flow.js.globalScope.resolve(templateGet);
        token.replaceFor_ = 'basis.template.get';
        token.replaceForArgs_ = [utils.createLiteral(id)];
        //console.log(token);
        //token.splice(0, token.length, ['call', templateGet, [['string', 'xx']]]);
        fconsole.log(beforeChanges, '->', js_at.translate(token));
      }
      else
      {
        fconsole.log(js_at.translate(token), 'already in theme define');
      }
    }
  });
  fconsole.endl();

  //
  // process themes
  //

  // collect keys
  var defineKeys = flow.tmpl.defineKeys;
  for (var themeName in flow.tmpl.themes)
  {
    var themeResources = flow.tmpl.themeResources[themeName];
    for (var key in themeResources)
      arrayAddUnique(defineKeys, key);
  }

  fconsole.start('Apply template defines');
  for (var themeName in flow.tmpl.themes)
  {
    fconsole.start('theme `' + themeName + '`');

    var theme = flow.tmpl.themes[themeName];
    var themeResources = flow.tmpl.themeResources[themeName];
    var basisTheme = flow.js.basis.require('basis.template').theme(themeName);

    if (theme.fallback_)
      basisTheme.fallback(theme.fallback_);

    themeFallbackMap[themeName] = theme.fallback_ || 'base';

    for (var key in themeResources)
    {
      var resource = themeResources[key];
      if (resource.resourceRef)
      {
        var filename = resource.resourceRef.filename;
        if (filename)
        {
          basisTheme.define(key, flow.js.basis.resource(filename));

          fconsole.log(key + (filename ? ' -> basis.resource(\'' + filename + '\')' : ' -> virtual resource ' + resource.url));
        }
      }
      else
      {
        flow.warn({
          message: 'template source is not a basis.js resource: path `' + key + '` in theme `' + themeName + '`'
        });
      }
    }
    fconsole.endl();
  }
  fconsole.endl();

  // sort theme list according to fallback deep
  themeOrdered = sortThemes(themeFallbackMap);


  //
  // process templates
  //

  fconsole.start('Make template declarations');
  var declCache = {};
  var knownResources = {};
  var knownNestedWarnings = {};
  var themeOrdered = sortThemes(themeFallbackMap);
  var fallbackDecl = themeOrdered.reduce(function(res, name){
    res[name] = {};
    return res;
  }, {});

  themeOrdered.forEach(function(themeName){
    fconsole.start('theme `' + themeName + '`');
    basisTemplate.setTheme(themeName);

    var themeProcessedResources = [];
    if (!implicitDefine[themeName])
      implicitDefine[themeName] = {};

    for (var defineIdx = 0, key; key = defineKeys[defineIdx]; defineIdx++)
    {
      var source = basisTemplate.get(key);

      // prevent double resource processing as it can produce the same result but with various isolation
      if (typeof source.value == 'object' && !arrayAddUnique(themeProcessedResources, source.value))
        continue;

      var resource = flow.tmpl.themeResources[themeName][key];
      var file = resource && resource.resourceRef;

      // find closest fallback decl
      var fallbackTheme = themeName;
      var hasFallback;
      while (fallbackTheme != 'base' && !hasOwnProperty.call(fallbackDecl[fallbackTheme], key))
        fallbackTheme = themeFallbackMap[fallbackTheme];
      hasFallback = hasOwnProperty.call(fallbackDecl[fallbackTheme], key);

      // if no resource (implicit define) and no fallback, nothing to do
      if (!resource && !hasFallback)
        continue;

      // main part
      fconsole.start(key + (file ? ': basis.resource("' + ((file.jsRefCount ? file.jsRef : '') || file.relpath) + '")' : ''));

      // build a declaration
      if (file)
        flow.files.contextFile_ = file.filename || file.ownerUrl;

      var declCacheKey = source.url;
      var declFromCache = declCacheKey in declCache;
      var decl = declFromCache
        ? declCache[declCacheKey]
        : basisTemplate.makeDeclaration(source.get(), path.dirname(source.url) + '/', {
            optimizeSize: flow.options.jsCutDev,
            loc: true,
            isolate: genIsolatePrefix ? genIsolatePrefix() : false,
            autocreate: false
          }, source.url.replace(/:.+$/, ''), source);

      if (!declFromCache)
      {
        var hasNamedIncludes = decl.deps.some(function(dep){
          return dep instanceof flow.js.basis.template.SourceWrapper;
        });

        // add declaration to cache that has no named templates i.e. <b:include src="foo.bar"/>
        // and l10n tokens, as token could be implicit resolved by template filename
        if (!hasNamedIncludes)
          declCache[declCacheKey] = decl;
      }

      // generate declaration hash
      var hash = [source.get()]
        .concat(decl.deps.map(function(dep){
          return dep.url || dep;
        }))
        .join('\x00');

      // store result
      if (resource && (!file || !file.usedAsExplicit))
      {
        fconsole.log('[i] explicit define');

        // reg as fallback
        fallbackDecl[themeName][key] = {
          hash: hash,
          decl: decl,
          file: file
        };

        if (file)
        {
          file.usedAsExplicit = true;
          file.themes = (file.themes || []).concat(themeName);
        }

        // copy warnings to flow
        copyWarnsToFlow(decl.warns, knownNestedWarnings, flow, themeName, file && file.relpath);
      }
      else
      {
        // theme may has no it's own template source for that path
        // but template may contains inclusions that differ theme to themes;
        // also file may be already used by explicit define
        if (!hasFallback || hash != fallbackDecl[fallbackTheme][key].hash)
        {
          // template result has difference with base template -> some inclusion depends on theme
          // create fake file for result, and mark it to store in resource map
          var genericFilename = 'genericTemplate' + (flow.tmpl.implicitDefineSeed++) + '.tmpl';
          fconsole.log('[i] implicit define', genericFilename);

          file = flow.files.add({
            jsRefCount: 1,
            generatedFrom: source.url || false,
            generated: true,
            themes: [themeName],
            type: 'template',
            isResource: true
          });

          // set filename aside, to prevent file manager to read file with that name
          // filename requires for jsRef generation, and actualy it's a hack
          // TODO: solve the problem
          file.filename = genericFilename;
          file.filename = file.jsRef && null; // generate jsRef

          // add to implicit map
          implicitDefine[themeName][key] = file;

          // add to fallback map
          fallbackDecl[themeName][key] = {
            hash: hash,
            decl: decl,
            file: file
          };

          // copy warnings to flow
          copyWarnsToFlow(decl.warns, knownNestedWarnings, flow, themeName, source.url);
        }
        else
        {
          fconsole.log('[i] fallback on `' + fallbackTheme + '` (no define)');

          var fallback = fallbackDecl[fallbackTheme][key];

          if (fallback.file)
            arrayAddUnique(fallback.file.themes, themeName);

          // declaration the same, just mask all template resource as required in current theme too
          fallback.decl.resources.forEach(function(item){
            var resourceFilename = typeof item == 'string' ? item : item.url;
            var resFile = flow.js.basis.resource(resourceFilename).buildFile;
            if (resFile && resFile.themes && arrayAddUnique(resFile.themes, themeName))
              fconsole.log('[i] ' + resFile.relpath + ' adds `' + themeName + '` to theme list');
          });

          fconsole.endl();
          continue;
        }
      }

      var l10nTokens = decl.l10n;

      if (Array.isArray(l10nTokens) && l10nTokens.length)
      {
        fconsole.start('[ ] l10n tokens found:');
        fconsole.incDeep(2);
        l10nTokens.forEach(function(path){
          fconsole.log(path);
          // init dictionary
          flow.l10n.getDictionary(path.split('@')[1]);
        });
        fconsole.decDeep(3);
      }

      if (file)
      {
        // if file exists, store declaration and link it with resources
        file.decl = decl;
        file.ast = decl.tokens;
        file.astResources = [];
        file.isolate = decl.isolate;
        file.removals = decl.removals;

        if (file.isolate)
          flow.tmpl.hasIsolated = true;

        var stylesMap = {};

        if (Array.isArray(decl.styles))
          decl.styles.forEach(function(item){
            if (item && item.resource)
              stylesMap[item.resource] = item;
          });

        decl.resources.forEach(function(item){
          var resourceFilename = typeof item == 'string' ? item : item.url;
          var resourceType = typeof item == 'string' ? 'style' : item.type;
          var resource = flow.js.basis.resource(resourceFilename);
          var resourceSourceUrl = resource().url.replace(/\?.*$/, '');

          if (resourceType != 'style')
          {
            // non-style resource processing
            if (resource.virtual)
              resFile = flow.files.add({
                type: resourceType,
                inline: true,
                generatedFrom: resource().url,
                generated: true,
                baseURI: resource().baseURI
              });
            else
            {
              resFile = flow.files.add({
                filename: resourceFilename,
                isResource: true
              });

              if (file.astResources.indexOf(resFile) == -1)
                file.astResources.push({
                  type: resourceType,
                  file: resFile
                });
            }
          }
          else
          {
            // style resources processing
            var resFile = knownResources[resourceFilename] || flow.files.add(
              resource.virtual  // treat virtual resources as inline
                ? {
                    type: 'style',  // are there possible other kind of resources?
                    inline: true,
                    sourceOffsetMap: resource().map,
                    generatedFrom: resource().url,
                    generated: true,
                    baseURI: resource().baseURI,
                    content: resource().cssText,
                    themes: []
                  }
                : {
                    filename: resourceFilename, // resource filename already resolved, and should be absolute
                    themes: []
                  }
            );

            if (!hasOwnProperty.call(knownResources, resourceFilename) &&
                hasOwnProperty.call(stylesMap, resourceFilename))
            {
              var styleInfo = stylesMap[resourceFilename];
              if (styleInfo.constructor === Object)
              {
                var styleToken = styleInfo.styleToken;

                fconsole.incDeep();

                if (styleInfo.isolate)
                {
                  if (!resFile.originator && !styleInfo.namespace)
                  {
                    resFile.originator = file.filename || file.generatedFrom;
                    fconsole.log('[i] set originator: ' + resFile.originator);
                  }

                  if (!resFile.isolate)
                  {
                    resFile.isolate = styleInfo.isolate;
                    fconsole.log('[i] mark as isolated: ' + styleInfo.isolate);
                  }
                }

                if (styleInfo.inline)
                {
                  var text = styleToken.children[0];
                  resFile.embed = {
                    file: styleToken.sourceUrl || file.filename,
                    start: correctLoc(text ? text.loc && text.loc.start : styleToken.loc && styleToken.loc.end),
                    end: correctLoc(text ? text.loc && text.loc.end : styleToken.loc && styleToken.loc.end)
                  };
                }

                fconsole.decDeep();
              }
            }

            // to prevent duplicates
            knownResources[resourceFilename] = resFile;

            // if file has no themes property, that means css file used by other sources
            if (resFile.themes)
            {
              if (arrayAddUnique(resFile.themes, themeName))
                fconsole.log('[i] ' + resFile.relpath + ' adds `' + themeName + '` to theme list');
            }
            else
            {
              resFile.noThemes = true;
              fconsole.log('[i] mark `' + resFile.relpath + '` as not a theme specific');
            }

            // set filename for virtual resources to add them to file-graph
            if (resource.virtual && resourceSourceUrl != resource().url)
            {
              resFile.filename = resourceSourceUrl;
              resFile.source = flow.js.basis.resource(resourceSourceUrl).fetch().cssText;
            }

            resFile.isResource = true;
            resource.buildFile = resFile;
          }

          file.link(resFile, decl.resources);
        });

        // reset context file
        flow.files.contextFile_ = null;
      }
      fconsole.endl();
    }
    fconsole.endl();
  });
  fconsole.endl();

  //
  // consistent theme sorter
  //
  var themeOrder = themeOrdered.reduce(function(res, theme, idx){
    res[theme] = idx;
    return res;
  }, {});
  flow.tmpl.sortThemes = function(themes){
    return Array.prototype.slice.call(themes).sort(function(a, b){
      return themeOrder[a] - themeOrder[b];
    });
  };
}).handlerName = '[tmpl] Extract';

module.exports.skip = function(flow){
  if (!flow.tmpl.module)
    return 'basis.template is not found';
};
