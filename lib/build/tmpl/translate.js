var jsAt = require('basisjs-tools-ast').js;

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
            var object = ['object', []];
            var files = [];

            for (var key in map) {
                file = map[key];

                var token = ['call', ['dot', ['name', 'basis'], 'resource'], [['string', './' + file.jsRef]]];

                token.ref_ = flow.js.globalScope.resolve(token[1]);
                token.resourceRef = file;

                object[1].push([key, token]);
                files.push(file);
            }

            if (object[1].length) {
                var injectCode = jsAt.parse('getTheme().define()')[1];

                injectCode[0][1][1][1][2] = [['string', themeName]];
                injectCode[0][1][2][0] = object;

                jsAt.append(flow.tmpl.themeModule.ast, ['stat', injectCode]);

                Array.prototype.push.apply(flow.tmpl.module.resources, files);
            }
        }
    }
};

module.exports.handlerName = '[tmpl] Translate';
