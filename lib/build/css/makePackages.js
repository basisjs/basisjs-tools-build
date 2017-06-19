var cssTools = require('basisjs-tools-ast').css;
var htmlAt = require('basisjs-tools-ast').html;
var jsAt = require('basisjs-tools-ast').js;
var utils = require('basisjs-tools-ast/lib/js/utils');

module.exports = function(flow) {
    //
    // build generic style file (style from js & tmpl)
    //

    var fconsole = flow.console;
    var queue = flow.files.queue;
    var htmlFile;
    var styleFileMap = {};
    var targetMap = {};
    var packages = [];
    var multipleThemeBuild = false;

    function putStyle(pkg, file) {
        if (!styleFileMap[pkg]) {
            styleFileMap[pkg] = [];
        }

        styleFileMap[pkg].push(file);
    }

    //
    // split generic files by package
    //

    for (var i = 0, file; file = queue[i]; i++) {
        if (file.type == 'style' && file.isResource) {
            if (file.themes && (file.themes.length > 1 || (file.themes.length == 1 && file.themes[0] != 'base'))) {
                multipleThemeBuild = true;
                break;
            }
        }
    }

    fconsole.log('Style package mode: ' + (multipleThemeBuild ? 'Multiple themes' : 'Single theme') + '\n');

    fconsole.start('Split style by packages');
    for (i = 0; file = queue[i]; i++) {
        if (file.type == 'style' && file.isResource && !file.conditional) {
            // as we add file to some package mark it as non-resource anymore
            file.isResource = false;

            if (!multipleThemeBuild || !file.themes) {
                fconsole.log(file.relpath, '(all)');
                putStyle('style', file);
            } else {
                fconsole.log(file.relpath, '[' + file.themes.join(', ') + ']');
                file.themes.forEach(function(themeName) {
                    putStyle('theme-' + themeName, file);
                });
            }

            continue;
        }

        if (file.type == 'html' && file.ast && !htmlFile) {
            htmlFile = file;
        }
    }
    fconsole.endl();

    //
    // generate package files
    //

    fconsole.start('Create generic files');
    for (var name in styleFileMap) {
        fconsole.start(name + '.css');

        var genericStyle = createGenericFile(flow, name, styleFileMap[name]);

        targetMap[name] = true;
        packages.push(genericStyle);

        if (name == 'style' && htmlFile && !flow.options.singleFile) {
            fconsole.log('Inject generic file link into html');

            genericStyle.htmlFile = htmlFile;
            genericStyle.htmlNode = {
                type: 'tag',
                name: 'link',
                children: [],
                attribs: {
                    rel: 'stylesheet',
                    type: 'text/css',
                    media: 'all'
                }
            };

            htmlAt.injectToHead(htmlFile.ast, genericStyle.htmlNode);
            htmlFile.link(genericStyle, genericStyle.htmlNode);
        }

        fconsole.endl();
    }

    if (multipleThemeBuild && flow.tmpl.module) {
        var themeUrlsMap = false;

        packages.forEach(function(file) {
            if (file.theme) {
                if (!themeUrlsMap) {
                    themeUrlsMap = {};
                }

                file.themeUrlsMap = themeUrlsMap;
                file.themeName = file.theme.replace(/^theme-/, '');
            }
        });

        if (themeUrlsMap) {
            flow.files.add({
                jsRef: '_theme_css_',
                generated: true,
                type: 'json',
                isResource: true,
                jsResourceContent: themeUrlsMap
            });
        }

        utils.append(flow.tmpl.themeModule.ast, jsAt.parse('(' + function(themes) {
            /* global document, basis, getTheme, onThemeChange */
            var linkEl = document.getElementById('theme-style');
            var storage = global.localStorage || {};
            var inDom = !!linkEl;
            var head;

            var themeName = linkEl && linkEl.startupTheme;

            try {
                themeName = themeName || storage._basisjs_theme_;
            } catch (e) {
                // dummy
            }

            if (themes.indexOf(themeName) != -1) {
                getTheme(themeName).apply();
            }

            onThemeChange(function(name) {
                var path = basis.resource('./_theme_css_').fetch()[name];

                try {
                    storage._basisjs_theme_ = name;
                } catch (e) {
                    // dummy
                }
                if (path) {
                    if (!linkEl) {
                        linkEl = document.createElement('link');
                        linkEl.rel = 'stylesheet';
                        linkEl.type = 'text/css';
                        linkEl.media = 'all';
                        (basis.doc ? basis.doc.head.ready : basis.ready)(function() {
                            head = document.head || document.getElementByTagName('head')[0];
                            head.appendChild(linkEl);
                        });
                    }

                    if (path != linkEl.href.substr(linkEl.href.length - path.length)) {
                        linkEl.href = path;
                    }
                    if (head && !inDom) {
                        head.appendChild(linkEl);
                    }
                } else {
                    if (inDom && linkEl && linkEl.parentNode) {
                        linkEl.parentNode.removeChild(linkEl);
                    }
                }
            }, null, true);
        } + ')(' + JSON.stringify(Object.keys(flow.tmpl.themes)) + ')'));
    }

    //
    // output files
    //

    flow.css.packages = queue.filter(function(file) {
        if (file.type == 'style' &&
            file.htmlNode &&
            !file.outputFilename &&
            !file.conditional) {
            if (!file.inline || !file.htmlId) {
                setOutputFilename(file, this);
            }

            fconsole.log(file.relOutputFilename);

            return file;
        }
    }, targetMap).concat(packages);
};

module.exports.handlerName = '[css] Make packages';

function createGenericFile(flow, name, files) {
    var fconsole = flow.console;

    var genericFile = flow.files.add({
        outputFilename: name + '.css',
        type: 'style',
        generated: true,
        media: 'all',
        content: '',
        ast: {
            type: 'StyleSheet',
            loc: null,
            children: new cssTools.List()
        }
    });

    // set filename aside, to prevent file manager to read file with that name
    // filename requires for jsRef generation, and actualy it's a hack
    // TODO: solve the problem
    genericFile.filename = name + '.css';
    genericFile.filename = genericFile.jsRef && null; // generate jsRef

    if (name != 'style') {
        genericFile.theme = name;
    }

    genericFile.imports = files.map(function(file) {
        var placeholder = cssTools.List.createItem(cssTools.Comment('placeholder'));

        fconsole.log(file.relpath);

        this.ast.children
            .append(placeholder)
            .appendData(cssTools.WhiteSpace('\n'));

        return {
            list: this.ast.children,
            item: placeholder,
            code: '@import url(' + file.filename + ');',
            file: file,
            media: null
        };
    }, genericFile);

    return genericFile;
}

function setOutputFilename(file, targetMap) {
    var baseOutputFilename = file.outputFilename || file.name || 'style';
    var idx = 0;
    var outputFilename = baseOutputFilename;

    while (targetMap[outputFilename]) {
        outputFilename = baseOutputFilename + (++idx);
    }
    targetMap[outputFilename] = true;

    file.outputFilename = outputFilename + '.css';

    return file.outputFilename;
}
