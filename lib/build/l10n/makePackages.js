var js_at = require('basisjs-tools-ast').js;

(module.exports = function(flow){
  var fconsole = flow.console;

  var storagePrefix = flow.options.l10nPackage;
  var defaultCulture = flow.options.l10nDefaultCulture;

  var cultures = flow.l10n.cultures;
  var dictionaries = flow.l10n.dictionaries;

  //
  // process dictionaries
  //

  fconsole.start('Split cultures by packages');

  var packageContent = {};
  var cultureList = [];
  var baseCulture;

  for (var culture in cultures)
  {
    if (!baseCulture)
      baseCulture = culture;

    cultureList.push(cultures[culture].join('/'));

    packageContent[culture] = [];
    cultures[culture].push(baseCulture);
  }

  for (var path in dictionaries)
  {
    var dictionary = dictionaries[path];
    var basisjsDictionary = dictionary.basisjsDictionary;
    var dictOffset = parseInt(dictionary.file.jsRef, 36);

    for (var culture in cultures)
      packageContent[culture][dictOffset] = {
        _meta: {
          type: {}
        }
      };

    for (var tokenName in dictionary.tokens)
      for (var culture in cultures)
        for (var i = 0, fallbackCulture; fallbackCulture = cultures[culture][i]; i++)
        {
          var descriptor = basisjsDictionary.getCultureDescriptor(fallbackCulture, tokenName);
          if (descriptor)
          {
            var dictContent = packageContent[culture][dictOffset];
            var isLeafToken = typeof descriptor.value == 'string';
            var isSubtoken = descriptor.name.indexOf('.') != -1;

            if (isLeafToken)
            {
              if (isSubtoken)
              {
                var namePath = descriptor.name.split('.');
                dictContent[namePath[0]][namePath[1]] = descriptor.value;
              }
              else
              {
                dictContent[descriptor.name] = descriptor.value;
              }
            }
            else
            {
              dictContent[descriptor.name] = {};
            }

            if (!isSubtoken && descriptor.types[descriptor.name] != 'default')
              dictContent._meta.type[descriptor.name] = descriptor.types[descriptor.name];

            break;
          }
        }

    for (var culture in cultures)
    {
      var dictContent = packageContent[culture][dictOffset];
      if (!Object.keys(dictContent._meta.type).length)
        delete dictContent._meta;
    }

    dictionary.file.jsResourceContent = '';
  }

  fconsole.endl();

  //
  // generate package files
  //

  fconsole.start('Create generic files');

  var packages = {};

  for (var culture in packageContent)
    if (culture == defaultCulture)
    {
      packages[culture] = {
        content: packageContent[culture]
      };
    }
    else
    {
      var file = flow.files.add({
        type: 'culture',
        generated: true,
        outputContent: JSON.stringify(packageContent[culture])
      });

      file.outputFilename = 'res/' + file.digest + '.culture';

      packages[culture] = {
        cacheKey: storagePrefix + ':' + culture,
        filename: './res/' + file.digest + '.culture',
        digest: file.digest
      };

      fconsole.log(packages[culture].filename + ' (' + culture + ')');
    }

  fconsole.endl();

  //
  // inject package load script into module code
  //

  var injection = {
    body: function(cultureList, defaultCulture, packages){
      /* eslint-env browser */
      /* global basis, setCulture, setCultureList, dictionaryByUrl, currentCulture, onCultureChange, Dictionary, internalResolveDictionary */

      setCultureList(cultureList);
      setCulture(defaultCulture);

      var packageCache = {};
      packageCache[defaultCulture] = packages[defaultCulture].content;

      basis.resource.extensions['.l10n'] = function(content, url){
        var packageContent = getPackageContent(currentCulture);
        if (packageContent)
        {
          var dictOffset = parseInt(url.match(/.+\/(.+)\.l10n$/)[1], 36);
          var dictContent = {};
          dictContent[currentCulture] = packageContent[dictOffset];
          return internalResolveDictionary(url, true).update(dictContent);
        }
      };

      Dictionary.extend(function(super_, proto_){
        return {
          syncValues: function(){
            if (getPackageContent(currentCulture))
              proto_.syncValues.call(this);
          }
        };
      });

      onCultureChange(function(culture){
        var packageContent = getPackageContent(culture);
        if (packageContent)
          applyPackage(packageContent);
        else
          loadPackage(culture);
      }, null, true);

      function getPackageContent(culture){
        var packageContent = packageCache[culture];
        if (!packageContent)
        {
          var cacheData;
          try {
            cacheData = basis.json.parse(localStorage.getItem(packages[culture].cacheKey));
          } catch(e) {};

          if (cacheData && cacheData[1] == packages[culture].digest)
            packageContent = packageCache[culture] = cacheData[0];
          else
            try {
              localStorage.removeItem(packages[culture].cacheKey);
            } catch(e) {};
        }

        return packageContent;
      }

      function applyPackage(packageContent){
        for (var i = 0, cultureData; cultureData = packageContent[i]; i++)
        {
          var url = basis.path.resolve(i.toString(36) + '.l10n');
          if (dictionaryByUrl[url])
          {
            var dictContent = {};
            dictContent[currentCulture] = cultureData;
            dictionaryByUrl[url].update(dictContent);
          }
        }
      }

      function loadPackage(culture){
        var xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function(){
          if (this.readyState == 4 && ((this.status >= 200 && this.status < 300) || this.status == 304))
          {
            var packageContent;
            try {
              packageContent = basis.json.parse(this.responseText);
            } catch(e) {};

            if (packageContent)
            {
              packageCache[culture] = packageContent;
              try {
                localStorage.setItem(packages[culture].cacheKey, JSON.stringify([packageContent, packages[culture].digest]));
              } catch(e) {};
              applyPackage(packageContent);
            }
          }
        };

        xhr.open('GET', packages[culture].filename, true);
        xhr.send();
      }
    },

    args: [cultureList, defaultCulture, packages].map(JSON.stringify).join(',')
  };

  js_at.append(flow.l10n.module.ast, js_at.parse('(' + injection.body + ')(' + injection.args + ')'));

}).handlerName = '[l10n] Make packages';

module.exports.skip = function(flow){
  if (!flow.l10n)
    return 'basis.l10n not found';

  if (!flow.options.l10nPackage)
    return 'Use option --l10n-package to split cultures by packages.';

  if (typeof (flow.js.basis.l10n.getDictionaries()[0] || {}).getDescriptor != 'function')
    return 'l10n packages supported only in basis.js 1.7+';
};
