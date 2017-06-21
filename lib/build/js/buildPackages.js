var path = require('path');
var at = require('basisjs-tools-ast').js;
var html_at = require('basisjs-tools-ast').html;
var utils = at.utils;

function formatList(title, items){
  return '// ' + title + '(' + items.length + '):' +
    items.map(function(item){
      return '\n//   ' + item;
    }).join('') + '\n' +
    '//\n';
}

(module.exports = function(flow){
  var packages = flow.js.packages;
  var fconsole = flow.console;

  // create package files
  //["dot",["name","this"],"__resource__"]

  // build source map
  var basisFile = flow.js.basisScript && flow.files.get(flow.js.basisScript);

  if (basisFile)
  {
    // inject resources
    var resourceToc = [];
    var resourceThrows = [];

    fconsole.start('Build resource map');
    var resourceAst = (function(){
      var res = [];
      //var stat = {};
      var resourceTypeWeight = {
        'json': 1,
        'template': 2,
        'l10n': 3,
        'script': 100
      };

      for (var jsRef in flow.js.resourceMap)
      {
        var file = flow.js.resourceMap[jsRef];
        var ast = file.type == 'script' && file.ast ? file.ast.body[0] : null;

        if (file.throwCodes)
          resourceThrows.push.apply(resourceThrows, file.throwCodes);

        // if (!file.jsRefCount && file.type == 'template')
        // {
        //   fconsole.log('[i] Drop resource:', file.relpath);
        //   continue;
        // }

        if (!ast)
        {
          var content = file.jsResourceContent != null
            ? file.jsResourceContent
            : file.outputContent || file.content;

          switch (typeof content)
          {
            case 'string':
              ast = utils.createLiteral(content);
              break;
            default:
              if (typeof content == 'function')
                content = content.toString().replace(/function\s+anonymous/, 'function');
              else
                content = JSON.stringify(content);

              ast = at.parseExpression(content, true);
          }
        }

        // if (!stat[file.type])
        //   stat[file.type] = { count: 0, size: 0 };

        // stat[file.type].count++;
        // stat[file.type].size += content.length;

        res.push({
          relpath: file.relpath,
          type: file.type,
          ref: file.jsRef,
          ast: ast
        });
      }

      // fconsole.start('Stat:');
      // for (var type in stat)
      //   fconsole.log('[' + type + '] ' + stat[type].size + ' bytes in ' + stat[type].count + ' resource(s)');
      // fconsole.end();

      res = {
        type: 'ObjectExpression',
        properties: res.sort(function(a, b){
          var wa = resourceTypeWeight[a.type] || 0;
          var wb = resourceTypeWeight[b.type] || 0;
          return wa > wb ? 1 : (wa < wb ? -1 : 0);
        }).map(function(item){
          resourceToc.push('[' + (item.ast.type || 'unknown') + '] ' + item.relpath + ' -> ' + item.ref);

          return {
            type: 'Property',
            key: utils.createIdentifier(item.ref, true),
            value: item.ast
          };
        })
      };

      return res;
    })();
    fconsole.endl();

    fconsole.start('Inject resource map');
    var stat = at.parse('var __resources__ = {};', true);

    stat.declarations[0].init = resourceAst;
    utils.prepend(basisFile.ast, stat);

    if (basisFile.config.noConflict)
    {
      var rootNamespaces = Object.keys(flow.js.rootNSFile).filter(function(name){
        return name != 'basis';
      });
      // todo reproduce
      if (rootNamespaces.length)
      {
        fconsole.start('Inject noConflict namespaces: ' + rootNamespaces);

        fconsole.log('Patch getRootNamespace');
        var getRootNamespaceToken = basisFile.jsScope.get('getRootNamespace').token;
        var getRootNamespaceFirstArg = getRootNamespaceToken[2][0];

        var rootNsAssignCode = at.parse(rootNamespaces.map(function(name){
          return 'if (' + getRootNamespaceFirstArg + ' == "' + name + '" && !' + name + ')' +
            name + ' = namespaces[' + getRootNamespaceFirstArg + '];';
        }).join(''))[1];

        Array.prototype.splice.apply(getRootNamespaceToken[3], [getRootNamespaceToken[3].length - 1, 0].concat(rootNsAssignCode));

        fconsole.log('Add root namespace declation');
        at.prepend(basisFile.ast, at.parse('var ' + rootNamespaces + ';'));

        fconsole.endl();
      }
    }
    fconsole.endl();

    if (flow.js.autoload)
      // replace namespaces for it's filename in resource map
      basisFile.config.autoload = flow.js.autoload.file
        // basis.js prior 1.3.0
        ? './' + flow.js.autoload.file.jsRef
        // basis.js after 1.3.0
        : flow.js.autoload.map(function(ns){
            return './' + ns.file.jsRef;
          });

    // replace config init
    fconsole.log('Replace config');

    utils.extend(basisFile.jsScope.get('config').token, basisFile.jsScope.has('__config')
      ? at.parse('__config || ' + JSON.stringify(basisFile.config), true)
      : at.parseExpression(JSON.stringify(basisFile.config), true));

    // todo reproduce
    // inject global vars
    if (flow.js.globalVars)
      basisFile.ast[1].unshift(['var', flow.js.globalVars]);
  }

  var scriptSequenceId = basisFile ? 1 : 0;
  var customFilenames = true; // flow.options.sameFilenames || (flow.tmpl.hasIsolated && !flow.tmpl.isolationReproducible)
  var scriptNamePrefix = flow.options.sameFilenames
    ? path.basename(flow.options.file, path.extname(flow.options.file))
    : 'script';

  for (var name in packages)
  {
    var pkg = packages[name];
    var outputFilename = false;
    var throwCodes = [];

    // log package file list
    fconsole.start('Package ' + name + ':');
    pkg.forEach(function(f){
      fconsole.log(f.relpath);
    });
    fconsole.endl();

    if (flow.options.jsOptimizeThrows)
      throwCodes = pkg
        .reduce(function(res, file){
          return res.concat(file.throwCodes);
        }, [])
        .sort(function(a, b){
          return a[0] - b[0];
        });

    switch (pkg.layout){
      case 'basis':
        var isCoreFile = basisFile && flow.js.rootNSFile[name] === basisFile;

        var packageFile = flow.files.add({
          type: 'script',
          outputContent:
            (isCoreFile ? formatList('resources', resourceToc) : '') +
            (flow.options.jsOptimizeThrows && throwCodes.length
              ? formatList('throw codes',
                  throwCodes
                    .concat(resourceThrows)
                    .map(function(item){
                      return item[0] + ' -> ' + at.translate(item[1]);
                    })
                )
              : '') +
            wrapPackage(
              pkg.filter(function(file){
                return file != basisFile;
              }),
              flow,
              isCoreFile
                ? at.translate(basisFile.ast)
                : ''
            )
        });

        if (customFilenames)
          outputFilename = isCoreFile ? scriptNamePrefix + '.js' : name + '.js';

        packages[name].file = packageFile;

        if (isCoreFile)
        {
          packageFile.htmlNode = basisFile.htmlNode;
          packageFile.htmlFile = basisFile.htmlFile;
          basisFile.htmlFile.unlink(basisFile, basisFile.htmlNode);
          basisFile.htmlFile.link(packageFile, basisFile.htmlNode);
          delete basisFile.htmlNode;
          delete basisFile.htmlFile;
        }

        break;

      default:
        var htmlNode = null;
        var htmlFile = null;
        var packageFile = flow.files.add({
          type: 'script',
          outputContent:
            formatList('filelist', pkg.map(function(file){
              return file.filename;
            })) +
            (flow.options.jsOptimizeThrows && throwCodes.length
              ? formatList('throw codes',
                  throwCodes
                    .concat(resourceThrows)
                    .map(function(item){
                      return item[0] + ' -> ' + at.translate(item[1]);
                    })
                )
              : '') +
            '\n' +

            pkg.map(function(file){
              if (file.htmlNode)
              {
                if (!htmlNode)
                {
                  htmlFile = file.htmlFile;
                  htmlNode = file.htmlNode;
                  htmlFile.unlink(file, htmlNode);
                }
                else
                {
                  file.htmlFile.unlink(file, file.htmlNode);
                  html_at.removeToken(file.htmlNode, true);
                }

                delete file.htmlNode;
              }

              return '// [' + file.relpath + ']\n' + file.outputContent;
            }).join(';\n\n') + ';'
        });

        if (customFilenames)
          outputFilename = scriptNamePrefix + (scriptSequenceId++) + '.js';

        htmlFile.link(packageFile, htmlNode);
        packageFile.htmlFile = htmlFile;
        packageFile.htmlNode = htmlNode;
        packages[name].file = packageFile;
    }

    if (outputFilename)
    {
      packageFile.outputFilename = outputFilename;
      packageFile.htmlRef = outputFilename + '?' + packageFile.digest;
    }
    else
    {
      packageFile.outputFilename = flow.outputResourceDir + packageFile.digest + '.js';
    }

  }
}).handlerName = '[js] Build packages';

//
// wrap package
//

function wrapPackage(pkg, flow, contentPrepend){
  return [
    formatList('filelist', pkg.map(function(file){
      return file.filename;
    })),

    '(function(){\n',
    '"use strict";\n\n',
    'var __namespace_map__ = ' + JSON.stringify(flow.js.fn2ns) + ';\n',

    contentPrepend,

    '\n}).call(this);'
  ].join('');
}
