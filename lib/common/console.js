var slice = Array.prototype.slice;
var push = Array.prototype.push;

function output(con, args){
  if (con.enabled)
    console.log.apply(console, args);
}

function Console(){
  var logDeep = 0;

  return {
    enabled: true,

    log: function(){
      if (!this.enabled)
        return;

      var args = slice.call(arguments);

      if (logDeep)
        args.unshift(new Array(logDeep + 1).join('  ').substr(1));

      output(this, args);
    },

    list: function(list, prefix){
      if (!this.enabled)
        return;

      if (Array.isArray(list))
        list.forEach(function(line){
          this.log(prefix || '*', line);
        }, this);
      else
        this.log('console.log: list is not an array', list);
    },

    incDeep: function(deep){
      logDeep += deep || 1;
    },
    decDeep: function(deep){
      logDeep = Math.max(0, logDeep - (deep || 1));
    },
    resetDeep: function(){
      logDeep = 0;
    },

    start: function(){
      if (!this.enabled)
        return;

      this.log.apply(this, arguments);
      this.incDeep();
    },
    end: function(){
      this.decDeep();
    },
    endl: function(){
      if (!this.enabled)
        return;

      if (arguments.length)
        this.log.apply(this, arguments);

      this.decDeep();
      this.log();
    }
  };
}

module.exports = Console;
