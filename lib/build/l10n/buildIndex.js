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
    for (var culture in content)
      if (!/^_|_$/.test(culture)) // ignore names with underscore in the begining or ending (reserved for meta)
        if (!Object.prototype.hasOwnProperty.call(flow.l10n.cultures, culture))
        {
          fconsole.log('Delete `' + culture + '` culture branch');
          delete content[culture];
        }
        else
          cleanupMeta(content[culture], culture);

    fconsole.endl();
  }
  fconsole.endl();

}).handlerName = '[l10n] Build index';

module.exports.skip = function(flow){
  if (!flow.l10n)
    return 'basis.l10n not found';
};
