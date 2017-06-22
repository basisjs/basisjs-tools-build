var js_at = require('basisjs-tools-ast').js;
var utils = js_at.utils;

module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'template')
    {
      fconsole.log(file.relpath + (file.jsRefCount ? ' -> ' + file.jsRef : ''));
      if (file.ast && file.astResources.length)
        file.jsResourceContent = {
          resources: file.astResources.map(function(item){
            return {
              type: item.type,
              url: item.file.jsRef
            };
          }),
          tokens: file.ast
        };
      else
        file.jsResourceContent = file.ast || file.content;
    }
  }

  //
  // inject implicit
  //
  if (flow.tmpl.themeModule)
  {
    fconsole.log();
    fconsole.log('Inject implicit defines in ' + flow.tmpl.themeModule.namespace);
    for (var themeName in flow.tmpl.themes)
    {
      var map = flow.tmpl.implicitDefine[themeName];
      var object = {
        type: 'ObjectExpression',
        properties: []
      };
      var files = [];

      for (var key in map)
      {
        file = map[key];

        var token = utils.callExpression('basis', 'resource');

        token.arguments[0] = utils.createLiteral('./' + file.jsRef);
        token.ref_ = flow.js.globalScope.resolve(token.callee);
        token.resourceRef = file;

        object.properties.push({
          type: 'Property',
          key: utils.createKeyIdentifier(key),
          value: token
        });
        files.push(file);
      }

      if (object.properties.length)
      {
        // getTheme(themeName).define({ ... })
        var injectCode = {
          type: 'ExpressionStatement', expression: {
            type: "CallExpression",
            callee: {
              type: "MemberExpression",
              computed: false,
              object: utils.setCallArgs(utils.callExpression('getTheme'), utils.createLiteral(themeName)),
              property: utils.createIdentifier('define')
            },
            arguments: [object]
          }
        };

        var themeModuleBody = flow.tmpl.themeModule.ast.body[0];

        utils.append(themeModuleBody, injectCode);

        Array.prototype.push.apply(flow.tmpl.module.resources, files);
      }
    }
  }
};

module.exports.handlerName = '[tmpl] Translate';
