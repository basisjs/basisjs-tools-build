var Token = require('./Token.js');
var dictionaryInitPriorBasis_1_7 = require('./basisjs-prior-1.7.js');

/**
* @class
*/
var Dictionary = function(file, flow/*, dict*/){
  this.file = file;
  this.tokens = {};
  this.markupTokens = [];
  this.ref = [];

  // process old dictionaries as before (for basis.js 1.6 and below)
  // if (typeof dict.getDescriptor != 'function')
    dictionaryInitPriorBasis_1_7.call(this, file, flow);

  // for (var culture in dict.cultureValues)
  //   for (var key in dict.cultureValues[culture])
  //   {
  //     var descriptor = dict.cultureValues[culture][key];

  //     if (!descriptor)
  //     {
  //       flow.warn({
  //         file: this.file.relpath,
  //         theme: culture,
  //         message: 'Markup token is not a string: ' + key
  //       });
  //       continue;
  //     }

  //     var templateKey = '#' + (flow.tmpl.implicitDefineSeed++).toString(36);
  //     var content = descriptor.value;
  //     console.log(content);

  //     if (typeof content == 'string' && descriptor.placeholder)
  //       content = content.replace(/\{#\}/g, '{__templateContext}');

  //     var tokenFile = flow.files.add({
  //       type: 'template',
  //       inline: true,
  //       jsRefCount: 1,
  //       themes: [],
  //       isResource: true,
  //       content: content,
  //       ownerUrl: file.relpath
  //     });

  //     var resource = flow.js.basis.resource.virtual(
  //       'tmpl',
  //       tokenFile.content,
  //       file.relpath
  //     );

  //     this.markupTokens.push({
  //       token: this.tokens[key],
  //       templatePath: templateKey
  //     });

  //     flow.js.basis.template.define(templateKey, resource);
  //     if (flow.tmpl.defineKeys.indexOf(templateKey) == -1)
  //       flow.tmpl.defineKeys.push(templateKey);
  //     flow.tmpl.implicitDefine.base[templateKey] = tokenFile;
  //     flow.tmpl.themeResources.base[templateKey] = {
  //       resourceRef: tokenFile,
  //       themeDefined: true
  //     };

  //     tokenFile.filename = 'l10n-template.tmpl';
  //     tokenFile.filename = tokenFile.jsRef && null; // generate jsRef

  //     file.link(tokenFile);
  //   }
};

Dictionary.prototype.getToken = function(name){
  if (!this.hasToken(name))
  {
    var token = new Token(this, name);
    token.implicit = true;
    this.tokens[name] = token;
  }

  return this.tokens[name];
};

Dictionary.prototype.hasToken = function(name){
  return name in this.tokens;
};

Dictionary.prototype.addRef = function(file, refToken){
  for (var i = 0, ref; ref = this.ref[i]; i++)
    if (ref.file === file && ref.refToken === refToken)
      return;

  this.ref.push({
    file: file,
    refToken: refToken
  });
};

module.exports = Dictionary;
