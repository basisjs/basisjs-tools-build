var js_at = require('basisjs-tools-ast').js;

(module.exports = function(flow){
  var fconsole = flow.console;

  //
  // make culture packs
  //

  fconsole.start('Make packages');

  var packages = {};
  for (var culture in flow.l10n.cultures)
    packages[culture] = {};

  for (var path in flow.l10n.dictionaries)
  {
    var dict = flow.l10n.dictionaries[path];
    var dictContent = dict.file.jsResourceContent;

    for (var cultureName in dictContent)
      if (!/^_|_$/.test(cultureName))
      {
        var cultureFallback = flow.l10n.cultures[cultureName];
        var dictPackage = {};

        for (var i = 0, culture; culture = cultureFallback[i]; i++)
        {
          var cultureValues = dict.cultureValues[culture];
          for (var tokenKey in cultureValues)
            if (!dictPackage[tokenKey] && typeof cultureValues[tokenKey] == 'string')
              dictPackage[tokenKey] = cultureValues[tokenKey];
        }

        packages[cultureName][dict.file.jsRef] = dictPackage;

        delete dictContent[cultureName];
      }
  }

  fconsole.endl();

  //
  // generate package files
  //

  fconsole.start('Create generic files');

  var path = {};

  for (var cultureName in packages)
  {
    var isDefaultCulture = cultureName == flow.options.l10nDefaultCulture;
    var file = flow.files.add({
      generated: true,
      type: 'json',
      isResource: isDefaultCulture,
      jsResourceContent: isDefaultCulture ? packages[cultureName] : true,
      outputFilename: isDefaultCulture ? '' : 'l10n/' + cultureName + '.json',
      outputContent: isDefaultCulture ? '' : JSON.stringify(packages[cultureName])
    });

    if (isDefaultCulture)
      file.filename = cultureName + '.json';

    path[cultureName] = './' + (isDefaultCulture ? file.jsRef : file.outputFilename + '?' + file.digest);

    fconsole.log(cultureName + ': ' + path[cultureName]);
  }

  fconsole.endl();

  //
  // inject package load script into module code
  //

  js_at.append(flow.l10n.module.ast, js_at.parse('(' + function(cultureUrl, defaultCulture){
    var pkg;

    Dictionary.extend({
      getValue: function(tokenName){
        var dictUrl = basis.path.basename(this.resource.url);
        return pkg && pkg[dictUrl] && pkg[dictUrl][tokenName];
      }
    });

    var loadCulture = function(name){
      try { pkg = basis.require(cultureUrl[name]); } catch(e){};
    };

    module.exports.setCulture = function(name){
      if (name)
        loadCulture(name);

      setCulture(name);
    };

    module.exports.setCulture(defaultCulture);
  } + ')(' + JSON.stringify(path) + ', ' + JSON.stringify(flow.options.l10nDefaultCulture) + ')'));

}).handlerName = '[l10n] Make packages';

module.exports.skip = function(flow){
  if (!flow.l10n)
    return 'basis.l10n not found';

  if (!flow.options.l10nPackages)
    return 'Use option --l10n-packages to split dictionaries by packages.';
};
