module.exports = function(warns, fileFilter) {
    var result = {};

    warns.forEach(function(warn) {
        var filename = warn.file || '<UnknownFile>';

        if (fileFilter && filename.indexOf(fileFilter) !== 0) {
            return;
        }

        if (!result[filename]) {
            result[filename] = [];
        }

        result[filename].push({
            loc: warn.loc,
            message: warn.message
        });
    });

    return result;
};
