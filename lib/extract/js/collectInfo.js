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
  var ignoreBasisImplicitNames = [
    'require',
    'exports',
    '__resources__',
    '__namespace_map__',
    '__filename'
  ];

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
      file.ast.names.forEach(function(info){
        var token = info.token;
        var name = token[1];
        var scope = info.scope.scopeByName(name);

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

          var info = scope.getOwn(name);
          var type = info.type;

          // if some argument in argument list is used then all
          // other arguments before it considered as used too, i.e.
          // | 'foo'.replace(/x(\d+)/g, function(m, num){
          // |   return num * 2;
          // | });
          // in this case `m` will be considered used as can't be
          // removed or omited
          if (type == 'arg' && info.args)
            for (var i = 0; i < info.index; i++)
              scope.usage[info.args[i]] = true;

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

          var info = scope.getOwn(name);
          var type = info.type;

          // ignore any names except var and function declarations,
          // and arguments but not for implicit scopes (implicit module wrapper function scope)
          if (type != 'var' && type != 'defun' && (type != 'arg' || scope.implicit))
            return;

          if (!hasOwnProperty.call(scope.usage, name))
            flow.warn({
              file: file.hostFilename,
              message: 'Defined but never used: ' + name,
              loc: file.location(info.loc)
            });
        });
      });

      // check for top level duplicate var declarations
      file.ast.scopes.forEach(function(scope){
        if (!scope.declarations)
          return;

        var names = new Set();

        scope.declarations.forEach(function(info){
          var parentType = info.parent[0];

          if (parentType == 'toplevel' ||
              parentType == 'defun' ||
              parentType == 'function')
          {
            var name = info.name;

            if (names.has(name))
              flow.warn({
                file: file.hostFilename,
                message: 'Duplicate top-level var declaration: ' + name,
                loc: file.location(info.loc)
              });

            names.add(name);
          }
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
