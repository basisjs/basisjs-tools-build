var at = require('basisjs-tools-ast').js;
var pathUtils = require('path');

//
// export handler
//

(module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;
  var basisResource = flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'resource']);
  var basisRequire = flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'require']);

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      if (flow.options.jsOptimizeThrows)
      {
        // replace value for idx
        // TODO: make sure it's has no side effect, otherwise this replacement may break code
        file.throwCodes.forEach(function(item){
          var expr = item[2][1];

          // throw 'string'  =>  throw 123
          if (expr[0] == 'string')
          {
            item[2][1] = ['num', item[0]];
            return;
          }

          // throw new Error(expr)  => throw new Error(123)
          if (expr[0] == 'new' && expr[1][0] == 'name' && expr[1][1] == 'Error' && expr[2].length <= 1)
          {
            expr[2] = [['num', item[0]]];
            return;
          }
        });
      }

      if (file.deps.length || file.resources.length)
      {
        fconsole.start(file.relpath);

        file.ast = at.walk(file.ast, {
          'call': function(token){
            var expr = token[1];
            var args = token[2];

            switch (this.scope.resolve(token[1]))
            {
              case basisResource:
                var code = at.translate(token);
                var file = token.resourceRef;

                if (file && file.jsRef)
                {
                  token[2] = [['string', './' + file.jsRef]];
                  flow.console.log(code + ' -> ' + at.translate(token));
                }
                else
                {
                  if (token.resourceRef)
                    flow.warn({
                      file: this.file.relpath,
                      message: code + ' has no jsRef (ignored)'
                    });
                }

                break;

              case basisRequire:
                if (args[0] && args[0][0] == 'string')
                {
                  if (!token.resourceRef)
                  {
                    //console.log(at.translate(token));
                    flow.warn({
                      fatal: true,
                      file: this.file.relpath,
                      message: 'token `' + at.translate(token) + '` has no file ref'
                    });
                  }
                  // cut off args except first one
                  args.splice(1, args.length);
                  // replace for resource reference
                  args[0][1] = './' + token.resourceRef.jsRef;
                }
            }
          }
        }, { file: file });

        fconsole.endl();
      }
    }

  //
  // relink assets
  //
  if (flow.js.asset.length)
  {
    fconsole.start('Relink assets');

    var stat = flow.js.asset.reduce(function(res, asset){
      var path = asset.sourceFile.relpath;
      if (!res.hasOwnProperty(path))
        res[path] = [];
      res[path].push(asset);
      return res;
    }, {});

    for (var path in stat)
    {
      fconsole.start(path);
      stat[path].forEach(function(asset){
        var newPath = asset.file.fileRef || '';

        if (asset.sourceFile.outputFilename)
          newPath = pathUtils.relative(pathUtils.dirname(asset.sourceFile.outputFilename), newPath);

        fconsole.log(at.translate(asset.token) + ' -> "' + newPath + '"');
        asset.token.splice(0, asset.token.length, 'string', newPath);
      });
      fconsole.endl();
    }

    fconsole.endl();
  }


}).handlerName = '[js] Relink';
