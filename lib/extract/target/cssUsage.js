module.exports = function(flow){
  flow.result = JSON.stringify(flow.css.usage || {});
};
