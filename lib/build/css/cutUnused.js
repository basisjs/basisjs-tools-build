(module.exports = function(flow){
  var fconsole = flow.console;
  var themeIdMap = flow.css.idMap;
  var themeClassMap = flow.css.classMap;

  for (var theme in themeClassMap)
  {
    var classMap = themeClassMap[theme];
    for (var name in classMap)
    {
      var list = classMap[name];

      if (list.unused)
      {
        console.log('Cut selectors contains .' + name);
        for (var i = 0, item; item = list[i]; i++)
          if (item.type == 'style-class')
            deleteSelector(item.token);
      }
    }
  }

  for (var theme in themeIdMap)
  {
    var idMap = themeIdMap[theme];
    for (var name in idMap)
    {
      var list = idMap[name];

      if (list.unused)
      {
        console.log('Cut selectors contains #' + name);
        for (var i = 0, item; item = list[i]; i++)
          if (item.type == 'style-id')
            deleteSelector(item.token);
      }
    }
  }

}).handlerName = '[css] Cut unused selectors';

module.exports.skip = function(flow){
  if (!flow.options.cssCutUnused)
    return 'Use --css-cut-unused option';
};

//
// utils
//

function deleteSelector(token){
  var simpleselector = token.stack[0];
  var selector = token.stack[1];
  var rule = token.stack[2];
  var stylesheet = token.stack[3];
  var idx;

  idx = selector.indexOf(simpleselector);
  if (idx != -1)
  {
    // delete selector from selector group
    selector.splice(idx > 2 ? idx - 1 : idx, 2);
  }

  // if no more selectors
  if (selector.length == 2)
  {
    idx = stylesheet.indexOf(rule);
    if (idx != -1)
    {
      // delete rule from stylesheet
      stylesheet.splice(idx, 1);
      if (stylesheet[idx] && stylesheet[idx][1] == 's')
        stylesheet.splice(idx, 1);
    }
  }
}
