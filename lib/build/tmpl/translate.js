var jsAt = require('basisjs-tools-ast').js;
var utils = require('basisjs-tools-ast/lib/js/utils');

module.exports = function(flow) {
    var fconsole = flow.console;
    var queue = flow.files.queue;
    var file;

    for (var i = 0; file = queue[i]; i++) {
        if (file.type == 'template') {
            fconsole.log(file.relpath + (file.jsRefCount ? ' -> ' + file.jsRef : ''));
            if (file.ast && file.astResources.length) {
                file.jsResourceContent = {
                    resources: file.astResources.map(function(item) {
                        return {
                            type: item.type,
                            url: item.file.jsRef
                        };
                    }),
                    tokens: file.ast
                };
            } else {
                file.jsResourceContent = file.ast || file.content;
            }
        }
    }

    //
    // inject implicit
    //
    if (flow.tmpl.themeModule) {
        fconsole.log();
        fconsole.log('Inject implicit defines in ' + flow.tmpl.themeModule.namespace);
        for (var themeName in flow.tmpl.themes) {
            var map = flow.tmpl.implicitDefine[themeName];
            var object = {
                type: 'ObjectExpression',
                properties: []
            };
            var files = [];

            for (var key in map) {
                file = map[key];

                var token = jsAt.parse('basis.resource()', true);

                token.arguments[0] = utils.createLiteral('./' + file.jsRef);
                token.ref_ = flow.js.globalScope.resolve(token.callee);
                token.resourceRef = file;

                object.properties.push({
                    type: 'Property',
                    key: utils.createIdentifier(key, true),
                    value: token
                });
                files.push(file);
            }

            if (object.properties.length) {
                var injectCode = jsAt.parse('getTheme().define()', true);

                injectCode.callee.object.arguments[0] = utils.createLiteral(themeName);
                injectCode.arguments[0] = object;

                utils.append(flow.tmpl.themeModule.ast, { type: 'ExpressionStatement', expression: injectCode });

                Array.prototype.push.apply(flow.tmpl.module.resources, files);
            }
        }
    }
};

module.exports.handlerName = '[tmpl] Translate';
