var js_at = require('basisjs-tools-ast').js;

(module.exports = function(flow){
  var fconsole = flow.console;
  var cultureByName = flow.l10n.cultures;
  var dictionaryByUrl = flow.l10n.dictionaries;
  var patchByUrl = flow.l10n.patches;
  var defaultCulture = flow.options.l10nDefaultCulture;
  var storageKey = flow.options.l10nStorageKey;

  //
  // make culture packs
  //

  fconsole.start('Make packages');

  var packageByCulture = {};
  var cultureList = [];

  for (var name in cultureByName)
  {
    cultureList.push(cultureByName[name].join('/'));
    if (name != defaultCulture)
      packageByCulture[name] = {};
  }

  for (var path in dictionaryByUrl)
  {
    var dict = dictionaryByUrl[path];
    var dictContent = dict.file.jsResourceContent;

    var patches = patchByUrl[path];

    for (var culture in dictContent)
      if (!/^_|_$/.test(culture) && culture != defaultCulture)
      {
        var dictPackage = {};

        for (var i = 0, fallback; fallback = cultureByName[culture][i]; i++)
        {
          var cultureValues = dict.cultureValues[fallback];
          for (var token in cultureValues)
            if (token.indexOf('.') == -1 && !dictPackage[token])
              dictPackage[token] = cultureValues[token];
        }

        packageByCulture[culture][dict.file.jsRef] = dictPackage;

        delete dictContent[culture];
      }
  }

  fconsole.endl();

  //
  // generate package files
  //

  fconsole.start('Create generic files');

  var digestByCulture = {};

  for (var cultureName in packageByCulture)
  {
    var file = flow.files.add({
      generated: true,
      type: 'l10n',
      outputFilename: 'l10n/' + cultureName + '.l10n',
      outputContent: JSON.stringify(packageByCulture[cultureName])
    });

    digestByCulture[cultureName] = file.digest;
    fconsole.log(cultureName + ': ' + file.digest);
  }

  fconsole.endl();

  //
  // inject package load script into module code
  //

  js_at.append(flow.l10n.module.ast, js_at.parse('(' + function(digestByCulture, cultureList, defaultCulture, storageKey){
    setCultureList(cultureList);
    setCulture(defaultCulture);

    var resolvePath = basis.path.resolve;

    var storage = global.localStorage || {};
    var l10nCache = {};

    var isCultureApplied = {};
    isCultureApplied[defaultCulture] = true;

    try { l10nCache = JSON.parse(storage[storageKey]); } catch(e){};

    var applyPackage = function(culture){
      var cacheEntry = l10nCache[culture];
      var culturePackage = l10nCache[culture] && l10nCache[culture][1];

      if (culturePackage)
      {
        for (var filename in culturePackage)
        {
          var patch = {};
          patch[culture] = culturePackage[filename];
          module.exports.patch(resolvePath(filename), patch);
        }
        isCultureApplied[culture] = true;
      }
    };

    var loadPackage = (function(){
      var xhr;
      try { xhr = new(global.XMLHttpRequest || ActiveXObject)('MSXML2.XMLHTTP.3.0'); } catch(e){};
      return xhr ? function(culture){
        if (xhr.readyState != 0 && xhr.readyState != 4)
          xhr.abort();

        xhr.open('GET', './l10n/' + culture + '.l10n?' + digestByCulture[culture], true);
        xhr.onreadystatechange = function(){
          if (this.readyState == 4 && ((this.status >= 200 && this.status < 300) || this.status == 304))
          {
            try
            {
              l10nCache[culture] = [digestByCulture[culture], basis.json.parse(this.responseText)];
              storage[storageKey] = JSON.stringify(l10nCache);
            } catch(e){};

            applyPackage(culture);
          }
        };
        xhr.send('');
      } : basis.fn.$undef;
    })();

    onCultureChange(function(culture){
      if (isCultureApplied[culture])
        return;

      var cacheEntry = l10nCache[culture];
      if (cacheEntry && cacheEntry[0] == digestByCulture[culture])
        applyPackage(culture);
      else
        loadPackage(culture);

    }, global, true);
  } + ')(' + [digestByCulture, cultureList, defaultCulture, storageKey].map(JSON.stringify).join(',') + ')'));

}).handlerName = '[l10n] Make packages';

module.exports.skip = function(flow){
  if (!flow.l10n)
    return 'basis.l10n not found';

  if (!flow.options.l10nPackages)
    return 'Use option --l10n-packages to split dictionaries by packages.';
};
