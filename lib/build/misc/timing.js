var fixedWidth = require('fixed-width-string');

module.exports = function(flow) {
    var fconsole = flow.console;
    var timing = flow.timing;

    // timing
    timing.forEach(function(t) {
        fconsole.log(fixedWidth(t.time || 0, 5, { align: 'right' }) + '  ' + (t.name || '[No title step]'));
    });
};

module.exports.handlerName = 'Timing';
module.exports.silent = true;
module.exports.skip = function(flow) {
    return !flow.options.verbose;
};
