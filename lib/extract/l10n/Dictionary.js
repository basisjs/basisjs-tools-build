var Token = require('./Token.js');
var dictionaryInitPriorBasis_1_7 = require('./basisjs-prior-1.7.js');

/**
* @class
*/
var Dictionary = function(file, flow){
  this.file = file;
  this.tokens = {};
  this.markupTokens = [];
  this.ref = [];

  dictionaryInitPriorBasis_1_7.call(this, file, flow);
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
