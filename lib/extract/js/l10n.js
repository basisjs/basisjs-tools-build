var path = require('path');
var at = require('basisjs-tools-ast').js;

function unixpath(filename){
  return path.normalize(filename).replace(/^[a-z]+:/i, '').replace(/\\/g, '/');
}

function resolveToBase(flow, filename, baseURI){
  return unixpath(path.resolve(baseURI || '', filename));
}

function resolveL10nToken(flow, key, dictPath){
  var tokenDescriptor = flow.l10n.getToken(key + '@' + dictPath);

  if (!tokenDescriptor.jsToken)
  {
    tokenDescriptor.jsToken = ['object', []];
    tokenDescriptor.jsToken.obj = {
      compute: at.createRunner(function(token_){
        flow.console.log('[basis.l10n] basis.l10n.Dictionary#token.compute ' + key + '.{?}' + '@' + dictPath);
        token_.obj = resolveL10nToken(flow, key + '.{?}', dictPath).jsToken.obj;
      })
    };
  }

  return tokenDescriptor;
}

function resolveDictionary(flow, filename){
  var dict = flow.l10n.getDictionary(filename);

  if (!dict.jsToken)
  {
    dict.jsToken = ['object', []];
    dict.jsToken.file = dict.file;
    dict.jsToken.obj = {
      token: at.createRunner(function(token_, this_, args, scope){
        var key = scope.simpleExpression(args[0]);
        if (key && key[0] == 'string')
        {
          flow.console.log('[basis.l10n] basis.l10n.Dictionary#token ' + key[1] + '@' + dict.file.filename);

          var l10nToken = resolveL10nToken(flow, key[1], dict.file.filename);

          l10nToken.addRef(this.file, token_);
          token_.obj = l10nToken.jsToken.obj;
        }
        else
        {
          flow.warn({
            file: this.file.relpath,
            message: 'First argument of basis.l10n.dictionary#token() is not resolved: ' + at.translate(token_),
            loc: this.file.location((token_[2][0] || token_[1]).start)
          });
        }
      })
    };
  }

  return dict;
}

//
// NEW API
//
module.exports = function(file, flow, defineHandler, globalScope){
  var fconsole = flow.console;
  var basisResolveURI = flow.js.basis.resource.resolveURI;

  flow.l10n = require('../l10n/context.js')(flow, file);

  // TODO: fetch culture list from basis.l10n
  defineHandler(globalScope, 'basis.l10n.setCultureList', function(token, this_, args, scope){
    flow.l10n.cultures = {};

    var list = scope.simpleExpression(args[0]);

    if (!list)
    {
      flow.warn({
        file: this.file.relpath,
        message: 'First argument of basis.l10n.setCulture() is not resolved: ' + at.translate(token_),
        loc: this.file.location((token_[2][0] || token_[1]).start)
      });
      return;
    }

    switch (list[0])
    {
      case 'string':
        list = list[1];
        break;

      case 'array':
        list = list[1].map(function(val){
          return val && val[0] == 'string' ? val[1] : undefined;
        });

        if (list.every(function(val){
          return typeof val == 'string';
        }))
          break;

      default:
        flow.warn({
          file: this.file.relpath,
          message: 'First argument of basis.l10n.setCulture() should be string or array of string: ' + at.translate(token_),
          loc: this.file.location((token_[2][0] || token_[1]).start)
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
    if (!filename || filename[0] != 'string')
      return flow.warn({
        file: this.file.relpath,
        message: 'basis.l10n.dictionary: first argument is not resolved, token: ' + at.translate(token)
      });

    filename = basisResolveURI
      ? basisResolveURI(filename[1], flow.indexFile.baseURI)
      : resolveToBase(flow, filename[1], flow.indexFile.baseURI);

    var dict = resolveDictionary(flow, filename);

    dict.addRef(this.file, token);
    dict.file.jsRefCount++;

    fconsole.log('[basis.l10n] dictionary ' + at.translate(args[0]) + ' -> ' + filename + ' -> ' + dict.file.relpath);

    token.obj = dict.jsToken.obj;
    this.file.link(dict.file);
  });

  defineHandler(file.jsScope, 'basis.l10n.patch', function(token, this_, args, scope){
    var dictFilename = scope.simpleExpression(args[0]);
    if (!dictFilename || dictFilename[0] != 'string')
      return flow.warn({
        file: this.file.relpath,
        message: 'basis.l10n.patch: first argument is not resolved, token: ' + at.translate(token)
      });

    var patchFilename = scope.simpleExpression(args[1]);
    if (!patchFilename || patchFilename[0] != 'string')
      return flow.warn({
        file: this.file.relpath,
        message: 'basis.l10n.patch: second argument is not resolved, token: ' + at.translate(token)
      });

    dictFilename = basisResolveURI
      ? basisResolveURI(dictFilename[1], flow.indexFile.baseURI)
      : resolveToBase(flow, dictFilename[1], flow.indexFile.baseURI);

    patchFilename = basisResolveURI
      ? basisResolveURI(patchFilename[1], flow.indexFile.baseURI)
      : resolveToBase(flow, patchFilename[1], flow.indexFile.baseURI);

    var patch = flow.l10n.getPatch(dictFilename, patchFilename);

    patch.addRef(this.file, token);
    patch.file.jsRefCount++;

    fconsole.log('[basis.l10n] patch ' + at.translate(args[1]) + ' -> ' + patchFilename + ' -> ' + patch.file.relpath);
    this.file.link(patch.file);
  });
};
