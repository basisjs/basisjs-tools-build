(module.exports = function(flow){
  function deleteIfEmpty(obj, key, message){
    if (key in obj == false)
      return;

    if (!obj[key] || (Object.keys(obj[key]).length == 0))
    {
      fconsole.log(message);
      delete obj[key];
    }
  }

  function cleanupMeta(content, culture){
    if ('_meta' in content)
    {
      if (content._meta)
      {
        if ('source' in content._meta)
        {
          delete content._meta.source;
          fconsole.log('Delete `' + (culture ? culture + '.' : '') + '_meta.source`');
        }
        deleteIfEmpty(content._meta, 'type', 'Delete empty `' + (culture ? culture + '.' : '') + '_meta.type`');
      }
      deleteIfEmpty(content, '_meta', 'Delete empty `' + (culture ? culture + '.' : '') + '_meta`');
    }
  }

  var fconsole = flow.console;

  //
  // process basis.l10n.dictionary
  //
  fconsole.start('Clean up dictionaries');
  for (var path in flow.l10n.dictionaries)
  {
    var dictionary = flow.l10n.dictionaries[path];
    var content = dictionary.file.jsResourceContent;

    fconsole.start(path);

    cleanupMeta(content);

    // delete unused clutures
    for (var key in content)
      if (!/^_|_$/.test(key)) // ignore names with underscore in the begining or ending (reserved for meta)
      {
        var culture = key;

        if (!Object.prototype.hasOwnProperty.call(flow.l10n.cultures, culture))
        {
          fconsole.log('Delete `' + culture + '` culture branch');
          delete content[culture];
        }
        else
          cleanupMeta(content[culture], culture);
      }
      else
      {
        if (key !== '_meta')
        {
          fconsole.log('Delete `' + key + '`');
          delete content[key];
        }
      }

    fconsole.endl();
  }
  fconsole.end();

  var basisFile = flow.js.basisScript && flow.files.get(flow.js.basisScript);
  if (basisFile && basisFile.config)
  {
    fconsole.start('Clean up basis-config');

    if (basisFile.config.l10n && 'patch' in basisFile.config.l10n)
    {
      delete basisFile.config.l10n.patch;
      fconsole.log('Delete `l10n.patch`');
    }

    fconsole.end();
  }

}).handlerName = '[l10n] Clean up';

module.exports.skip = function(flow){
  if (!flow.l10n)
    return 'basis.l10n not found';
};
