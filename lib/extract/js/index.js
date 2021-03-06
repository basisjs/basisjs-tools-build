var html_at = require('basisjs-tools-ast').html;
var at = require('basisjs-tools-ast').js;
var createGlobalScope = require('./globalScope');
var path = require('path');

var processBasisFile = require('./processBasisFile');
var basisResolveNSFilename;
var basisResolveURI;
var utils = at.utils;

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
  globalScope.put('importScripts', {
    type: 'env',
    token: at.createRunner(function(token_, this_, args, scope){
      args.forEach(function(arg){
        asset(flow, this.file, this.file.baseURI, scope, [arg], arg, 'importScripts(\'{url}\')');
      }, this);
    })
  });

  basisResolveNSFilename = false;
  basisResolveURI = false;

  flow.js = {
    globalScope: globalScope,
    throwIdx: 0,
    rootBaseURI: {},
    rootFilename: {},
    rootNSFile: {},
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
    implicitDefineSeed: 0,
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

function createScope(file, flow, module){
  if (file.type != 'script' || file.jsScope)
    return;

  var exports;

  if (!module)
  {
    exports = { type: 'ObjectExpression', properties: [] };
    module = {
      type: 'ObjectExpression',
      properties: [
        {
          type: 'Property',
          key: utils.createIdentifier('exports'),
          computed: false,
          value: exports,
          kind: 'init',
          method: false,
          shorthand: false
        }
      ]
    };
    module.obj = {
      exports: exports
    };
  }
  else
  {
    exports = module.obj.exports;
  }

  var scope = new at.Scope('function', flow.js.globalScope, exports);
  var basisResource = flow.js.basisScope.resolve(utils.memberExpression('basis', 'resource'));
  var basisRequire = flow.js.basisScope.resolve(utils.memberExpression('basis', 'require'));
  var baseURI = utils.createLiteral(file.baseURI.replace(/\/$/, ''));

  var names = {
    module: module,
    exports: exports,
    __filename: utils.createLiteral(file.filename),
    __dirname: utils.createLiteral(file.dirname),
    global: flow.js.globalScope.get('global').token,
    basis: flow.js.basisScope.get('basis').token,
    resource: at.createRunner(function(token, this_, args, scope){
      // resource(path) -> basis.resource(__dirname + path)
      var filename = resolveString(scope, args[0]);
      var baseURI = args[1] ? resolveString(scope, args[1]) : false;

      if (typeof filename == 'string')
      {
        filename = basisResolveURI // since 1.4
          ? basisResolveURI(filename, baseURI || file.baseURI, 'resource(\'{url}\')')
          : relToIndex(flow, filename, file.baseURI);

        args = [utils.createLiteral(filename)];
      }

      basisResource.run.call(this, token, this_, args, scope);
    }),
    require: at.createRunner(function(token, this_, args){
      // require(path, base) -> basis.require(path, base || "__dirname")
      args = [
        args[0],
        args[1] || utils.cloneNode(baseURI)
      ];
      basisRequire.run.call(this, token, this_, args, scope);
    })
  };

  // local `asset` function supported since 1.4
  if (basisResolveURI)
  {
    names.asset = at.createRunner(function(token, this_, args, scope){
      asset(flow, file, file.baseURI, scope, args, token, 'asset(\'{url}\')');
    });
  }

  for (var name in names)
    scope.put(name, {
      type: 'arg',
      token: names[name]
    });

  file.jsScope = scope;
  scope.strict = true;
  scope.implicit = true;
}

function asset(flow, file, baseURI, scope, args, token, reason){
  var newFilename = resolveString(scope, args[0]);
  var inline;

  if (!args[1] || (args[1].type == 'Literal' && args[1].value))
  {
    inline = Boolean(args[1]);
  }
  else
  {
    flow.warn({
      file: file.relpath,
      fatal: true,
      message: 'Second argument of ' + reason + ' should be true or omitted: ' + at.translate(token)
    });

    return;
  }

  if (typeof newFilename == 'string')
  {
    token.loc = file.location(token.loc);

    var newFile = flow.files.add({
      initiator: {
        file: file,
        loc: token.loc,
        token: at.translate(token)
      },
      filename: basisResolveURI // since 1.4
        ? basisResolveURI(newFilename, baseURI, reason)
        : (baseURI ? relToIndex(flow, newFilename, baseURI) : newFilename)
    });
    file.link(newFile, token);

    if (!inline)
      newFile.output = true;

    flow.js.asset.push({
      token: token,
      sourceFile: file,
      file: newFile,
      inline: inline
    });

    return token;
  }
  else
  {
    flow.warn({
      file: file.relpath,
      fatal: true,
      message: 'basis.asset: first argument is not resolved to string, token: ' + at.translate(token)
    });
  }
}

function astExtend(scope, dest, source){
  if (dest && source && source.type == 'ObjectExpression')
  {
    if (!dest.obj)
      dest.obj = {};

    for (var i = 0, prop; prop = source.properties[i]; i++)
    {
      var key = prop.key.type == 'Identifier' ? prop.key.name : prop.key.value;

      if (key in dest.obj == false)
        dest.obj[key] = scope.resolve(prop.value) || prop.value;
    }
  }
}

function astComplete(scope, dest, source){
  if (dest && source && source.type == 'ObjectExpression')
  {
    if (!dest.obj)
      dest.obj = {};

    for (var i = 0, prop; prop = source.properties[i]; i++)
    {
      var key = prop.key.type == 'Identifier' ? prop.key.name : prop.key.value;

      if (key in dest.obj == false)
        dest.obj[key] = scope.resolve(prop.value) || prop.value;
    }
  }
}

function resolveString(scope, token){
  if (!token)
    return;

  token = scope.simpleExpression(token);

  if (token && typeof token.value == 'string')
    return token.value;
}

function processFile(file, flow){
  function defineHandler(scope, name, fn){
    if (name.indexOf('.') != -1)
    {
      var token = scope.resolve(at.parse(name, 1));

      if (token)
      {
        token.run = fn;
      }
      else
      {
        flow.warn({
          file: file.relpath,
          message: 'handler ' + name + ' is not resolved in specified scope'
        });
      }
    }
    else
    {
      var reference = scope.get(name);

      if (reference)
      {
        reference.token.run = fn;
        reference.token = at.createRunner(fn);
      }
      else
      {
        flow.warn({
          file: file.relpath,
          message: 'reference ' + name + ' is not resolved in specified scope'
        });
      }
    }
  };


  // if file has ast - it's already processed
  if (file.ast)
    return;

  var globalScope = flow.js.globalScope;
  var fconsole = flow.console;
  var content = file.content;

  // extend file info
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

  if (file.jsScope !== globalScope)
  {
    file.originalAst = {
      type: file.ast.type,
      body: file.ast.body
    };
    file.ast.body = [
      utils.createFunction(
        null,
        utils.createIdentifiers(['exports', 'module', 'basis', 'global', '__filename', '__dirname', 'require', 'resource', 'asset']),
        file.ast.body
      )
    ];
    file.ast.body[0].scope = file.jsScope;
    file.ast.scopes.unshift(file.jsScope);
  }

  if (file.namespace == 'basis.template')
    try {
      fconsole.log('[i] load basis/template.js module');
      flow.js.basis.require('basis.template');
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
      var pathToken = utils.createLiteral(path);
      var exports = {
        type: 'ObjectExpression',
        properties: [
          {
            type: 'Property',
            key: utils.createKeyIdentifier('path'),
            computed: false,
            value: pathToken,
            kind: 'init',
            method: false,
            shorthand: false
          }
        ]
      };
      var token = utils.createFunction(utils.createIdentifier(path));

      exports.obj = {
        path: pathToken
      };

      token.obj = {
        extend: at.createRunner(function(token_, this_, args, scope){
          astExtend(scope, this_.obj.exports, args[0]);
          astComplete(scope, this_, args[0]);
          token_.obj = this_.obj;
          token_.ref_ = token;
        }),
        path: utils.createLiteral(path),
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
        ns = createNS(root);
        ns.scope = globalScope;
        globalScope.put(root, {
          type: 'ns',
          token: ns
        });
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

      var token = resourceMap[uri] = utils.createFunction();
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
        var basisDir = path.dirname(flow.js.basisScript);
        var relativeToBasis = path.relative(basisDir, this.file.filename).replace(/\\/g, '/');

        // FIXME: temporary solution to avoid warnings in basis.template/basis.l10n that using
        // basis.resource to get templates & dictionary dinamically
        if (
          relativeToBasis !== 'basis/l10n.js' &&
          relativeToBasis !== 'basis/template.js' &&
          relativeToBasis !== 'basis/template/declaration.js' &&
          relativeToBasis !== 'basis/utils/source.js'
        )
          flow.warn({
            file: this.file.relpath,
            message: 'Unresolved basis.resource: ' + at.translate(token)
          });

        return;
      }

      if (newFilename)
      {
        token.loc = this.file.location(token.loc);
        token.replaceFor_ = 'basis.resource';

        var file = this.file;
        var arg1 = resolveString(scope, args[1]);
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
          var arg0 = token.arguments[0];

          if (arg0 && arg0.type == 'Identifier' && arg0.name == 'Object')
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
        if (namespace && namespace.type == 'Literal')
        {
          var ns = getNamespace(namespace.value);
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

        token.loc = this.file.location(token.loc);
        token.replaceFor_ = 'basis.require';

        //fconsole.log('requireNamespace', token);
        if (!/[^a-z0-9_\.]/i.test(arg0) && path.extname(arg0) != '.js')
        {
          var namespace = args[0].value;
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

          token.ref_ = newFile.jsScope.get('module').token.obj.exports;
          token.obj = token.ref_.obj;
        }
        else
        {
          var arg1 = args[1] && args[1].type == 'Literal' ? args[1].value : '';  // TODO: check it
          var filename = basisResolveURI // since 1.4
            ? basisResolveURI(arg0, arg1 || flow.indexFile.baseURI, 'basis.require(\'{url}\')')
            : resolveToBase(arg0, arg1 || flow.indexFile.baseURI);
          var file = this.file;

          if (!path.extname(filename))
            filename += '.js';

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
            token.ref_ = utils.createLiteral(newFile.content);
          }
        }
      }
    };

    for (var key in handlers)
    {
      // FIXME: temporary solution, since babel may rename extend to _extend
      if (key == 'extend' && !basisScope.get('extend') && basisScope.get('_extend'))
        key = '_extend';

      defineHandler(basisScope, key, handlers[key]);
    }

    // process ast
    file.ast = at.struct(file.ast, {
      file: file,
      console: fconsole
    });

    // basis.resource
    defineHandler(globalScope, 'basis.resource', getResourceRunner);

    // basis.asset
    defineHandler(globalScope, 'basis.asset', function(token, this_, args, scope){
      asset(flow, this.file, null, scope, args, token, 'basis.asset(\'{url}\')');
    });

    // autoload here because we can't resolve basis.resource before ast.struct
    if (file.autoload)
    {
      var processAutoload = function(ns){
        var autoRequire = utils.setCallArgs(utils.callExpression('basis', 'require'), utils.createLiteral(ns));
        handlers.requireNamespace.call({ file: file }, autoRequire, null, [utils.createLiteral(ns)], file.jsScope);
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
      if (!file.jsScope.resolve(utils.memberExpression('basis', 'l10n', 'dictionary')))
        flow.exit('basis.l10n prior to basis.js 1.0 is not supported');

      require('./l10n.js')(file, flow, defineHandler, globalScope);
    }
  }

  // collect throws
  file.throwCodes = file.ast.throws.map(function(token){
    return [++flow.js.throwIdx, utils.extend({}, token), token];
  });
}
