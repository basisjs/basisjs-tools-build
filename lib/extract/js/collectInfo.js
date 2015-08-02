var walk = require('basisjs-tools-ast').js.walk;

(module.exports = function(flow){
  function checkDuplicateParameters(token){
    var args = token[2];
    var names = {};

    for (var i = 0; i < args.length; i++)
    {
      if (hasOwnProperty.call(names, args[i]))
        flow.warn({
          file: file.hostFilename,
          message: 'Strict mode function may not have duplicate parameter names: ' + args[i],
          loc: file.location(args.loc && args.loc[i])
        });

      names[args[i]] = true;
    }
  }

  function checkDuplicateProperty(token){
    var properties = token[1];
    var names = {};

    for (var i = 0; i < properties.length; i++)
    {
      var prop = properties[i];

      if (hasOwnProperty.call(names, prop[0]))
        flow.warn({
          file: file.hostFilename,
          message: 'Strict mode object may not have duplicate property names: ' + prop[0],
          loc: file.location(prop.start)
        });

      names[prop[0]] = true;
    }
  }

  var fconsole = flow.console;
  var queue = flow.files.queue;
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var ignoreBasisImplicitNames = ['require', 'exports', '__resources__', '__namespace_map__'];

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && file.ast)
    {
      var strictScopes = 0;

      fconsole.start(file.relpath);

      file.ast.scopes.forEach(function(scope){
        scope.usage = {};
        strictScopes += scope.strict;
      });

      // check for implicit names usage
      file.ast.names.forEach(function(token){
        var name = token[1];
        var scope = token.scope.scopeByName(name);

        if (!scope)
        {
          // temporary ignore some basis.js implicit names usage for now
          if (file.hostFilename == flow.js.basisScript && ignoreBasisImplicitNames.indexOf(name) != -1)
            return;

          flow.warn({
            file: file.hostFilename,
            message: 'Implicit global usage: ' + name,
            loc: file.location(token.start)
          });
        }
        else
        {
          if (!scope.usage)
            return;

          var info = scope.get(name);
          var type = info[0];

          // if some argument in argument list is used then all
          // other arguments before it considered as used too, i.e.
          // | 'foo'.replace(/x(\d+)/g, function(m, num){
          // |   return num * 2;
          // | });
          // in this case `m` will be considered used as can't be
          // removed or omited
          if (type == 'arg' && info.extra)
            for (var i = 0; i < info.extra.index; i++)
              scope.usage[info.extra.list[i]] = true;

          scope.usage[name] = true;
        }
      });

      // check all declared names in use
      file.ast.scopes.forEach(function(scope){
        scope.getOwnNames().forEach(function(name){
          // ignore scope if created by function but body is empty
          // (treat those functions as placeholder)
          if (scope.type == 'function' && scope.sourceToken && !scope.sourceToken[3].length)
            return;

          var info = scope.get(name);
          var type = info[0];

          // ignore any names except var and function declarations,
          // ang arguments but not for virtual scopes (implicit module wrapper function scope)
          if (type != 'var' && type != 'defun' && (type != 'arg' || scope.virtual))
            return;

          if (!hasOwnProperty.call(scope.usage, name))
            flow.warn({
              file: file.hostFilename,
              message: 'Defined but never used: ' + name,
              loc: file.location(info.loc)
            });
        });
      });

      // make some checks for strict mode as something may break build in IE
      if (strictScopes)
        walk(file.ast, {
          'defun': checkDuplicateParameters,
          'function': checkDuplicateParameters,
          'object': checkDuplicateProperty
        });

      fconsole.endl(file.relpath);
    }
}).handlerName = '[js] Collect info';
