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

Token.prototype.addRef = function(file, refToken, type){
  for (var i = 0, ref; ref = this.ref[i]; i++)
    if (ref.file === file && ref.refToken === refToken)
      return;

  // explicit has more priority than through
  this.usage = type === 'explicit' ? type : this.usage || type;
  this.ref.push({
    file: file,
    refToken: refToken,
    type: type
  });
};

module.exports = Token;
