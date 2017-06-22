var path = require('path');
var at = require('basisjs-tools-ast').js;
var l10nContext = require('../l10n/context.js');

function unixpath(filename){
  return path.normalize(filename).replace(/^[a-z]+:/i, '').replace(/\\/g, '/');
}

function resolveToBase(flow, filename, baseURI){
  return unixpath(path.resolve(baseURI || '', filename));
}

//
// NEW API
//
module.exports = function(file, flow, defineHandler, globalScope){
  var fconsole = flow.console;
  var basisResolveURI = flow.js.basis.resource.resolveURI;

  flow.l10n = l10nContext.create(flow, file);

  var resolveL10nToken = function(key, dictPath){
    var id = key + '@' + dictPath;
    var tokenDescriptor = flow.l10n.getToken(id);

    if (!tokenDescriptor.jsToken)
    {
      var token = {
        type: 'ObjectExpression',
        properties: []
      };

      token.obj = {
        compute: at.createRunner(function(token_){
          var id = key + '.{?}' + '@' + dictPath;

          fconsole.log('[basis.l10n] basis.l10n.Dictionary#token.compute ' + id);
          token_.obj = resolveL10nToken(key + '.{?}', dictPath).jsToken.obj;
        })
      };

      tokenDescriptor.jsToken = token;
    }

    return tokenDescriptor;
  };

  var resolveDictionary = function(filename){
    var dict = flow.l10n.getDictionary(filename);

    if (!dict.jsToken)
    {
      var file = dict.file;
      var token = {
        type: 'ObjectExpression',
        properties: []
      };

      token.file = file;
      token.obj = {
        token: at.createRunner(function(token_, this_, args, scope){
          var key = scope.simpleExpression(args[0]);

          if (key && key.type == 'Literal')
          {
            var id = key.value + '@' + file.filename;

            fconsole.log('[basis.l10n] basis.l10n.Dictionary#token ' + id);

            var l10nToken = resolveL10nToken(key.value, file.filename);
            l10nToken.addRef(this.file, token_);
            token_.obj = l10nToken.jsToken.obj;
          }
          else
          {
            flow.warn({
              file: this.file.relpath,
              message: 'First argument of basis.l10n.dictionary#token() is not resolved: ' + at.translate(token_),
              loc: this.file.location(token_.loc)
            });
          }
        })
      };

      dict.jsToken = token;
    }

    return dict;
  };

  // TODO: fetch culture list from basis.l10n
  defineHandler(globalScope, 'basis.l10n.setCultureList', function(token, this_, args, scope){
    flow.l10n.cultures = {};

    var list = scope.simpleExpression(args[0]);

    if (!list)
    {
      flow.warn({
        file: this.file.relpath,
        message: 'First argument of basis.l10n.setCulture() is not resolved: ' + at.translate(token),
        loc: this.file.location(token.loc)
      });
      return;
    }

    switch (list.type)
    {
      case 'Literal':
        list = list.value;
        break;

      case 'ArrayExpression':
        list = list.elements.map(function(val){
          return val && val.type == 'Literal' ? val.value : undefined;
        });

        if (list.every(function(val){
          return typeof val == 'string';
        }))
          break;

      default:
        flow.warn({
          file: this.file.relpath,
          message: 'First argument of basis.l10n.setCulture() should be string or array of string: ' + at.translate(token),
          loc: this.file.location(token.loc)
        });

        return;
    }

    fconsole.start('[basis.l10n] ' + at.translate(token) + ' in ' + this.file.relpath);

    if (typeof list == 'string')
      list = list.trim().split(/\s+/);

    if (Array.isArray(list))
    {
      for (var i = 0, cultureDef; cultureDef = list[i]; i++)
      {
        var clist = cultureDef.split(/\//);
        list[i] = clist[0];
        flow.l10n.cultures[clist[0]] = clist;
      }

      fconsole.log('[OK] Set culture list ' + JSON.stringify(Object.keys(flow.l10n.cultures)));
    }
    else
    {
      flow.warn({
        file: this.file.relpath,
        message: 'basis.l10n.setCultureList is not resolved (can\'t convert into array): ' + at.translate(token)
      });
    }

    fconsole.end();
  });

  defineHandler(file.jsScope, 'basis.l10n.dictionary', function(token, this_, args, scope){
    var filename = scope.simpleExpression(args[0]);
    if (filename && filename.type == 'Literal')
    {
      //filename = this.file.resolve(filename[1]);
      filename = basisResolveURI
        ? basisResolveURI(filename.value, flow.indexFile.baseURI)
        : resolveToBase(flow, filename.value, flow.indexFile.baseURI);
      var dict = resolveDictionary(filename);
      dict.addRef(this.file, token);
      dict.file.jsRefCount++;

      fconsole.log('[basis.l10n] dictionary ' + at.translate(args[0]) + ' -> ' + filename + ' -> ' + dict.file.relpath);

      token.obj = dict.jsToken.obj;
      this.file.link(dict.file);
    }
    else
    {
      return flow.warn({
        //fatal: true,
        file: this.file.relpath,
        message: 'basis.l10n.dictionary: first argument is not resolved, token: ' + at.translate(token)
      });
    }
  });
};
