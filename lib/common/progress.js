var chalk = require('chalk');
var readline = require('readline');
var fixedWidthString = require('fixed-width-string');

var MAX_LINE_WIDTH = process.stdout.columns || 200;
var BAR_LENGTH = 30;
var BAR_CHAR = process.platform == 'win32' ? '\u25AC' : '\u25FC';
var lines = 0;

function repeatStr(str, len) {
    return new Array(parseInt(len) + 1).join(str);
}

function draw(x, y, str) {
    readline.moveCursor(process.stdout, x, -y);
    readline.clearLine(process.stdout, 1);

    process.stdout.write(str + '\n');

    readline.moveCursor(process.stdout, 0, y ? y - 1 : 0);
}

// prevent user input
require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

process.stdin.pause();
setInterval(function() {
    var chunk = process.stdin.read();

    if (chunk) {
        for (var i = 0; i < chunk.length; i++) {
            if (chunk[i] == 3) {
                // ^C
                process.exit();
            }
        }
    }
}, 50);

module.exports = function createProgress(title, message) {
    function safeStr(str) {
        return String(str).replace(/[\r\n\t]/g, ' ');
    }

    function drawBarLine(fill, str) {
        fill = Math.round((fill / 100) * BAR_LENGTH);
        
        return fixedWidthString(
            chalk.blue(repeatStr(chalk.enabled ? BAR_CHAR : '#', fill)) +
            chalk.white(repeatStr(chalk.enabled ? BAR_CHAR : '-', BAR_LENGTH - fill)) +
            ' ' + safeStr(str || ''),
            maxWidth
        );
    }

    var line = lines++;
    var x = title.length + 1;
    var maxWidth = MAX_LINE_WIDTH - x - 2;

    draw(0, 0, safeStr(title + ' ' + message));

    return {
        update: function(percent, message) {
            draw(x, lines - line, drawBarLine(percent, message));
        },
        done: function(message) {
            draw(x, lines - line, fixedWidthString(safeStr(message), maxWidth));
        }
    };
};
