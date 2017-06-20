/**
* @class
*/
var Token = function(dictionary, name){
  this.dictionary = dictionary;
  this.name = name;
  this.ref = [];
};

Token.prototype.type = 'default';
Token.prototype.comment = null;

Token.prototype.addRef = function(file, refToken, explicit){
  for (var i = 0, ref; ref = this.ref[i]; i++)
    if (ref.file === file && ref.refToken === refToken)
      return;

  this.hasExplicitRef = Boolean(this.hasExplicitRef || explicit);
  this.ref.push({
    file: file,
    refToken: refToken,
    explicit: Boolean(explicit)
  });
};

module.exports = Token;
