var html_at = require('basisjs-tools-ast').html;
var at = require('basisjs-tools-ast').js;
var createGlobalScope = require('./globalScope');
var path = require('path');
var l10nContext = require('../l10n/context');

var processBasisFile = require('./processBasisFile');
var basisResolveNSFilename;
var basisResolveURI;


function unixpath(filename){
  return path.normalize(filename).replace(/^[a-z]+:/i, '').replace(/\\/g, '/');
}

function resolveToBase(filename, baseURI){
  return unixpath(path.resolve(baseURI || '', filename));
}

function relToIndex(flow, filename, baseURI){
  return unixpath(path.relative(path.dirname(flow.options.file), resolveToBase(filename, baseURI)));
}

module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  //
  // Init js section
  //

  fconsole.log('Init js');

  var globalScope = createGlobalScope();

  // temporary solution to build Web Worker scripts
  // TODO: make it right, create new build flow with global scope to assembly web worker script
  globalScope.put('importScripts', 'env', at.createRunner(function(token_, this_, args, scope){
    args.forEach(function(arg, idx){
      var filename = resolveString(scope, arg);
      asset(flow, this, this.file, filename, arg);
    }, this);
  }));

  basisResolveNSFilename = false;
  basisResolveURI = false;

  flow.js = {
    globalScope: globalScope,
    throwIdx: 0,
    rootBaseURI: {},
    rootFilename: {},
    rootNSFile: {},
    getFileContext: getFileContext,
    resources: [],
    namespaces: {},
    fn2ns: {},
    asset: []
    //resources: {}
  };

  flow.tmpl = {
    themes: {},
    themeResources: {},
    defineKeys: [],
    implicitDefine: {
      base: {}
    }
  };


  //
  // Process files
  //

  fconsole.start('Process scripts');
  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && !file.ast)
    {
      fconsole.start(file.relpath);

      if (file.htmlNode)
      {
        var attrs = html_at.getAttrs(file.htmlNode);
        var configAttr = false;

        if (attrs.hasOwnProperty('data-basis-config'))
          configAttr = 'data-basis-config';
        else
          if (attrs.hasOwnProperty('basis-config'))
            configAttr = 'basis-config';

        if (configAttr)
        {
          fconsole.log('[i] basis.js marker found (' + configAttr + ' attribute)');
          processBasisFile(flow, file, attrs[configAttr] || '');
          basisResolveNSFilename = flow.js.basis.resolveNSFilename;
          basisResolveURI = flow.js.basis.resource.resolveURI;
        }
      }

      processFile(file, flow);

      fconsole.endl();
    }
  fconsole.endl();

  if (flow.tmpl.module && !flow.tmpl.themeModule)
  {
    flow.warn({
      fatal: true,
      message: 'basis.template module found, but theme module is missed'
    });
  }
};

module.exports.handlerName = '[js] Extract';
module.exports.extraInfo = function(flow){
  if (flow.js.basisId)
    return flow.js.basisId;
};


//
// main part
//

function getFileContext(file){
  return {
    __filename: file.filename || '',
    __dirname: file.baseURI,
    namespace: file.namespace || ''
  };
}

function createScope(file, flow, module){
  if (file.type == 'script' && !file.jsScope)
  {
    var exports;

    if (!module)
    {
      exports = ['object', []];
      module = ['object', [
        ['exports', exports]
      ]];
      module.obj = {
        exports: exports
      };
    }
    else
    {
      exports = module.obj.exports;
    }

    var scope = new at.Scope('function', flow.js.globalScope, exports);
    var basisResource = flow.js.basisScope.resolve(['dot', ['name', 'basis'], 'resource']);
    var baseURI = ['string', file.baseURI.replace(/\/$/, '')];
    var names = {
      __filename: ['string', file.filename],
      __dirname: ['string', file.dirname],
      global: flow.js.globalScope.get('global'),
      basis: flow.js.basisScope.resolve(['name', 'basis']),
      resource: at.createRunner(function(token, this_, args, scope){
        // resource(path) -> basis.resource("__dirname" + path)
        token[1] = ['dot', ['name', 'basis'], 'resource'];
        token[1].ref_ = basisResource;

        var filename = resolveString(scope, args[0]);

        if (typeof filename == 'string')
        {
          filename = basisResolveURI // since 1.4
            ? basisResolveURI(filename, file.baseURI, 'resource(\'{url}\')')
            : relToIndex(flow, filename, file.baseURI);

          token[2] = [args[0] = ['string', filename]];
        }

        token[2][1] = args[1] = baseURI.slice(0);

        basisResource.run.call(this, token, this_, args, scope);
      }),
      module: module,
      exports: exports
    };

    var basisRequire = flow.js.basisScope.resolve(['dot', ['name', 'basis'], 'require']);
    names.require = at.createRunner(function(token, this_, args){
      // require(path, base) -> basis.require(path, base || "__dirname")
      token[1] = ['dot', ['name', 'basis'], 'require'];
      token[1].ref_ = basisRequire;
      //token[2] = [args[0], args[1] = baseURI.slice(0)];
      args[1] = args[1] || baseURI.slice(0);
      basisRequire.run.call(this, token, this_, args, scope);
    });

    // local `asset` function supported since 1.4
    if (basisResolveURI)
    {
      names.asset = at.createRunner(function(token, this_, args, scope){
        var filename = resolveString(scope, args[0]);

        asset(flow, this, file, filename, token);
      });
    }

    for (var name in names)
      scope.put(name, 'arg', names[name]);

    file.jsScope = scope;
    scope.strict = true;
    scope.file = file;
    scope.virtual = true;
  }
}

function asset(flow, context, file, newFilename, token){
  if (newFilename)
  {
    token.loc = file.location(token.start);

    var newFile = flow.files.add({
      initiator: {
        file: file,
        loc: token.loc,
        token: at.translate(token)
      },
      filename: basisResolveURI // since 1.4
        ? basisResolveURI(newFilename, file.baseURI, 'asset(\'{url}\')')
        : relToIndex(flow, newFilename, file.baseURI)
    });
    context.file.link(newFile, token);

    newFile.output = true;
    flow.js.asset.push({
      token: token,
      sourceFile: context.file,
      file: newFile
    });

    return token;
  }
  else
  {
    flow.warn({
      file: context.file.relpath,
      message: 'basis.asset: first argument is not resolved, token: ' + at.translate(token)
    });
  }
}

function defineHandler(scope, name, fn){
  if (name.indexOf('.') != -1)
  {
    var token = scope.resolve(at.parse(name, 1));

    if (!token)
      throw 'handler ' + name + ' is not resolved in specified scope';

    token.run = fn;
  }
  else
  {
    var symbol = scope.get(name);

    if (!symbol)
      throw 'symbol ' + name + ' is not resolved in specified scope';

    symbol.run = fn;  // does it affect anything?
    symbol.token.run = fn;
    symbol.token = at.createRunner(fn);
  }
}

function astExtend(scope, dest, source){
  if (dest && source && source[0] == 'object')
  {
    if (!dest.obj)
      dest.obj = {};
    if (!dest.objSource)
      dest.objSource = {};
    for (var i = 0, props = source[1], prop; prop = props[i]; i++)
    {
      dest.obj[prop[0]] = scope.resolve(prop[1]) || prop[1];
      dest.objSource[prop[0]] = source;
    }
  }
}

function astComplete(scope, dest, source){
  if (dest && source && source[0] == 'object')
  {
    if (!dest.obj)
      dest.obj = {};
    if (!dest.objSource)
      dest.objSource = {};
    for (var i = 0, props = source[1], prop; prop = props[i]; i++)
      if (prop[0] in dest.obj == false)
      {
        dest.obj[prop[0]] = scope.resolve(prop[1]) || prop[1];
        dest.objSource[prop[0]] = source;
      }
  }
}

function resolveString(scope, token){
  if (!token)
    return;

  token = scope.simpleExpression(token);

  if (token && token[0] == 'string')
    return token[1];
}

function processFile(file, flow){
  var defineHandler_ = defineHandler;
  defineHandler = function(scope, name, fn){
    try {
      defineHandler_(scope, name, fn);
    } catch(e) {
      flow.warn({
        file: scope.file.relpath,
        message: e
      });
    }
  };


  // if file has ast - it's already processed
  if (file.ast)
    return;

  var globalScope = flow.js.globalScope;
  var fconsole = flow.console;
  var content = file.content;

  if (flow.options.jsCutDev)
    content = content.replace(/(;;;|\/\*\*\s*@cut.*?\*\/).*([\r\n]|$)/g, '$2');

  // extend file info
  file.context = getFileContext(file);
  file.deps = [];
  file.resources = [];

  // parse
  try {
    file.ast = at.parse(content);
  } catch(e) {
    file.ast = ['toplevel', []];
    flow.warn({
      fatal: true,
      file: file.relpath,
      message: 'Javascript parse error of ' + file.relpath + (' (line: ' + e.line + ', col: ' + e.col + ')') + ':\n' + (e.message || e)
    });
  }

  // apply scope
  if (!file.jsScope)
    file.jsScope = globalScope;

  file.ast = at.applyScope(file.ast, file.jsScope);

  if (file.jsScope != globalScope)
  {
    file.originalAst = file.ast.slice(0);
    file.ast[1] = [['function', null, ['exports', 'module', 'basis', 'global', '__filename', '__dirname', 'require', 'resource', 'asset'],
      file.ast[1]
    ]];
    file.ast[1][0].scope = file.jsScope;
    file.ast.scopes.unshift(file.jsScope);
  }

  try {
    switch (file.namespace)
    {
      case 'basis.template':
        fconsole.log('[i] load basis/template.js module');

        flow.js.basis.require('basis.template');
      break;
    }
  } catch(e) {
    flow.warn({
      fatal: true,
      file: file.relpath,
      message: 'Namespace ' + file.namespace + ' load fault:\n' + (e.message || e)
    });
  }

  if (file.basisScript)
  {
    // get last global subscope as basis scope
    var basisScope = file.ast.scope.subscopes.slice(-1)[0];
    file.jsScope = basisScope;
    flow.js.basisScope = basisScope;

    //
    // namespaces
    //

    var createNS = function(path){
      var pathToken = ['string', path];
      var exports = ['object', [
        ['path', pathToken]
      ]];
      exports.obj = {
        path: pathToken
      };

      var token = ['function', path, []];
      token.objSource = {};
      token.obj = {
        extend: at.createRunner(function(token_, this_, args, scope){
          astExtend(scope, this_.obj.exports, args[0]);
          astComplete(scope, this_, args[0]);
          token_.obj = this_.obj;
          token_.ref_ = token;
        }),
        path: ['string', path],
        exports: exports
      };

      flow.js.namespaces[path] = token;

      return token;
    };

    var rootNamespaces = {};
    var getNamespace = function(namespace){
      var path = namespace.split('.');
      var root = path[0];
      var ns = globalScope.get(root);

      // override root namespace if unknown
      // TODO: take in account noConflict option
      if (!ns || !rootNamespaces[root])
      {
        rootNamespaces[root] = true;
        ns = globalScope.put(root, 'ns', createNS(root)).token;
        ns.scope = globalScope;
      }
      else
        ns = ns.token;

      for (var i = 1; i < path.length; i++)
      {
        var pathPart = path[i];

        if (!ns.obj[pathPart])
          ns.obj[pathPart] = createNS(path.slice(0, i + 1).join('.'));

        ns = ns.obj[pathPart];
      }

      return ns;
    };


    //
    // resources
    //

    var resourceMap = {};
    var createResource = function(uri, resourceFile){
      if (resourceMap[uri])
        return resourceMap[uri];

      function createFetchMethod(methodName){
        return function(token){
          if (resourceFile.type != 'script')
            return;

          fconsole.log('[basis.resource]', methodName, '(' + resourceFile.relpath + ')');
          if (!resourceFile.deps)
          {
            fconsole.incDeep(2);
            processFile(resourceFile, flow);
            fconsole.decDeep(2);
          }

          if (resourceFile.deps)
            resourceFile.deps.forEach(function(dep){
              if (this.deps.indexOf(dep) == -1)
                this.deps.push(dep);
            }, this.file);

          token.ref_ = resourceFile.jsScope.get('module').token.obj.exports;
        };
      }

      var token = resourceMap[uri] = ['function', null, []];
      token.obj = {
        fetch: at.createRunner(createFetchMethod('resource#fetch method call'))
      };
      token.run = createFetchMethod('resource call');
      return token;
    };

    function getResourceRunner(token, this_, args, scope){
      var newFilename = resolveString(scope, args[0]);

      if (typeof newFilename != 'string')
      {
        // FIXME: temporary solution to avoid warnings in basis.template/basis.l10n that using
        // basis.resource to get templates & dictionary dinamically
        if (!/^basis\.(template|l10n)(\.|$)/.test(this.file.namespace))
          flow.warn({
            file: this.file.relpath,
            message: 'Unresolved basis.resource: ' + at.translate(token)
          });

        return;
      }

      if (newFilename)
      {
        token.loc = this.file.location(token.start);

        var file = this.file;
        var arg1 = args[1] && args[1][0] == 'string' ? args[1][1] : '';  // TODO: check it
        var filename = basisResolveURI
          ? basisResolveURI(newFilename, arg1 || flow.indexFile.baseURI, 'basis.resource(\'{url}\')')
          : resolveToBase(newFilename, arg1 || flow.indexFile.baseURI);
        var newFile = flow.files.add({
          initiator: {
            file: this.file,
            loc: token.loc,
            token: at.translate(token)
          },
          filename: filename,
          jsRefCount: 0
        });
        newFile.isResource = true;

        createScope(newFile, flow);

        file.link(newFile, token);
        file.resources.push(newFile);
        newFile.jsRefCount++;

        token.resourceRef = newFile;
        token[2] = [['string', newFile.relpath]];
        token.call = createResource(newFilename, newFile);
        token.obj = token.call.obj;

        flow.js.resources.push(token);
      }
    }


    //
    // main part
    //

    var handlers = {
      // basis.object.extend
      extend: function(token, this_, args, scope){
        //fconsole.log('extend', arguments);
        if (this.file.jsScope == basisScope)
        {
          var arg0 = token[2][0];
          if (arg0[0] == 'name' && arg0[1] == 'Object')
            flow.exit('Too old basis.js (prior 1.0) detected! Current tools doesn\'t support it. Use basisjs-tools 1.3 or lower.');
        }

        astExtend(scope, args[0], args[1]);
        token.obj = args[0];
      },

      // basis.object.complete
      complete: function(token, this_, args, scope){
        //fconsole.log('comlete', arguments);
        astComplete(scope, args[0], args[1]);
        token.obj = args[0];
      },

      // basis.namespace
      getNamespace: function(token, this_, args){
        //fconsole.log('getNamespace', arguments);
        var namespace = args[0];
        if (namespace && namespace[0] == 'string')
        {
          var ns = getNamespace(namespace[1]);
          token.obj = ns.obj;
          token.ref_ = ns.ref_;
          if (args[1])
            token.obj.setWrapper.run(token, this_, [args[1]]);
        }
      },

      // basis.require
      requireNamespace: function(token, this_, args, scope){
        var arg0 = resolveString(scope, args[0]);

        if (typeof arg0 != 'string')
        {
          if (this.file.namespace != 'basis')
            flow.warn({
              file: this.file.relpath,
              message: 'Unresolved basis.require: ' + at.translate(token)
            });

          return;
        }

        token.loc = this.file.location(token.start);

        //fconsole.log('requireNamespace', token);
        if (!/[^a-z0-9_\.]/i.test(arg0) && path.extname(arg0) != '.js')
        {
          var namespace = args[0][1];
          var parts = namespace.split(/\./);
          var root = parts[0];
          var rootFile = flow.js.rootNSFile[root];
          var nsToken = getNamespace(namespace);
          var newFile;
          var file = this.file;

          if (root == namespace)
          {
            if (!rootFile)
            {
              rootFile = flow.files.add({
                initiator: {
                  file: this.file,
                  loc: token.loc,
                  token: at.translate(token)
                },
                filename:
                  flow.js.rootFilename[root] ||
                  flow.files.resolve(root + '.js', flow.js.rootBaseURI[root]),
                nsToken: nsToken,
                package: flow.js.rootNSFile.basis.package,
                namespace: root
              });
              rootFile.isResource = true;
              token.file = rootFile;
              flow.js.fn2ns[rootFile.jsRef] = root;
              flow.js.rootNSFile[root] = rootFile;
            }

            newFile = rootFile;
          }
          else
          {
            newFile = flow.files.add({
              initiator: {
                file: this.file,
                loc: token.loc,
                token: at.translate(token)
              },
              filename: basisResolveNSFilename
                ? basisResolveNSFilename(namespace)
                : path.resolve(
                    path.dirname(flow.js.rootFilename[root] || flow.files.resolve(root + '.js', flow.js.rootBaseURI[root])),
                    parts.join('/') + '.js'
                  ),
              nsToken: nsToken
            });
            newFile.isResource = true;
            newFile.namespace = namespace;

            flow.js.fn2ns[newFile.jsRef] = namespace;
            token.file = newFile;
            //newFile.package = root;
          }

          //token.file = newFile;

          createScope(newFile, flow, nsToken);

          file.link(newFile, token);
          file.deps.push(newFile);

          token.resourceRef = newFile;
          flow.js.resources.push(token);

          fconsole.incDeep(2);
          processFile(newFile, flow);
          fconsole.decDeep(2);

          token[2].splice(1); // remove all arguments except first one
          token.ref_ = newFile.jsScope.get('module').token.obj.exports;
          token.obj = token.ref_.obj;
        }
        else
        {
          var arg1 = args[1] && args[1][0] == 'string' ? args[1][1] : '';  // TODO: check it
          var filename = basisResolveURI // since 1.4
            ? basisResolveURI(arg0, arg1 || flow.indexFile.baseURI, 'basis.require(\'{url}\')')
            : resolveToBase(arg0, arg1 || flow.indexFile.baseURI);
          var file = this.file;

          var newFile = flow.files.add({
            initiator: {
              file: this.file,
              loc: token.loc,
              token: at.translate(token)
            },
            filename: filename,
            jsRefCount: 0
          });

          newFile.isResource = true;
          newFile.jsRefCount++;

          file.link(newFile, token);
          file.resources.push(newFile);

          token.resourceRef = newFile;
          flow.js.resources.push(token);

          if (newFile.type == 'script')
          {
            createScope(newFile, flow);

            fconsole.incDeep(2);
            processFile(newFile, flow);
            fconsole.decDeep(2);

            token.ref_ = newFile.jsScope.get('module').token.obj.exports;
            token.obj = token.ref_.obj;
          }
          else
          {
            token.ref_ = ['string', newFile.content];
          }
        }
      }
    };

    for (var key in handlers)
      defineHandler(basisScope, key, handlers[key]);

    // search for config and populate it
    var basisConfig = file.jsScope.resolve(['name', 'config']);
    if (basisConfig)
    {
      fconsole.start('[i] config token found');

      basisConfig.obj = {};

      // if (file.autoload)
      // {
      //   fconsole.log('  * add autoload to config: ' + file.autoload);
      //   basisConfig.obj.autoload = ['string', file.autoload];
      // }

      fconsole.end();
    }
    else
    {
      fconsole.log('[!] config token not found');
    }

    // process ast
    file.ast = at.struct(file.ast, {
      file: file,
      console: fconsole
    });

    //var CLASS_SELF = globalScope.resolve(at.parse('basis.Class.SELF', true));

    // basis.resource
    defineHandler(globalScope, 'basis.resource', getResourceRunner);

    // basis.asset
    defineHandler(globalScope, 'basis.asset', function(token, this_, args, scope){
      var newFilename = resolveString(scope, args[0]);

      if (typeof newFilename != 'string')
      {
        flow.warn({
          file: this.file.relpath,
          message: 'Unresolved basis.asset: ' + at.translate(token)
        });

        return;
      }

      if (newFilename)
      {
        token.loc = this.file.location(token.start);
        var newFile = flow.files.add({
          initiator: {
            file: this.file,
            loc: token.loc,
            token: at.translate(token)
          },
          filename: basisResolveURI // since 1.4
            ? basisResolveURI(newFilename, null, 'basis.asset(\'{url}\')')
            : newFilename
        });
        this.file.link(newFile, token);

        newFile.output = true;
        flow.js.asset.push({
          token: token,
          sourceFile: this.file,
          file: newFile
        });

        return token;
      }
      else
      {
        flow.warn({
          file: this.file.relpath,
          message: 'basis.asset: first argument is not resolved, token: ' + at.translate(token)
        });
      }
    });

    // autoload here because we can't resolve basis.resource before ast.struct
    if (file.autoload)
    {
      var processAutoload = function(ns){
        var autoRequire = at.parse('basis.require("' + ns + '")', true);
        handlers.requireNamespace.call({ file: file }, autoRequire, null, [['string', ns]], file.jsScope);
        return autoRequire;
      };

      flow.js.autoload = !Array.isArray(file.autoload)
        // basis.js prior 1.3.0
        ? processAutoload(file.autoload)
        // basis.js after 1.3.0
        : file.autoload.map(processAutoload);
    }
  }
  else
  {
    // FIXME: temporary here - move to proper place
    if (file.namespace == 'basis.template.htmlfgen')
      flow.tmpl.fgen = file;

    if (file.namespace == 'basis.template.theme')
      require('./tmpl.js')(file, flow, defineHandler);

    if (file.namespace == 'basis.template')
    {
      flow.tmpl.module = file;
      require('./tmpl.js')(file, flow, defineHandler);
    }

    // process ast
    file.ast = at.struct(file.ast, {
      file: file,
      console: fconsole
    });

    if (file.nsToken)
    {
      astComplete(file.jsScope, file.nsToken, file.nsToken.obj.exports);
      astExtend(file.jsScope, file.nsToken.obj.exports, file.nsToken.obj.exports);
    }

    // FIXME: temporary here - move to proper place
    if (file.namespace == 'basis.l10n')
    {
      if (!file.jsScope.resolve(at.parse('basis.l10n.dictionary', 1)))
        flow.exit('basis.l10n prior to basis.js 1.0 is not supported');

      require('./l10n.js')(file, flow, defineHandler, globalScope);
    }
  }

  // collect throws
  file.throwCodes = file.ast.throws.map(function(token){
    return [++flow.js.throwIdx, token.slice(), token];
  });
}
