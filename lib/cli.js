var clap = require.main.require('clap');
var utils = require('./common/utils');

function command(name) {
    return require('./' + name + '/command')
        .extend(require('basisjs-tools-config'))
        .version(utils.getToolsId(true));
}

function run(commandName, args) {
    if (!commands.hasOwnProperty(commandName)) {
        throw new Error('Unknown command: ' + commandName);
    }

    try {
        commands[commandName].run(args);
    } catch (e) {
        if (e instanceof clap.Error) {
            console.error(e.message || e);
        } else {
            throw e;
        }

        process.exit(2);
    }
}

var commands = {
    extract: command('extract'),
    find: command('find'),
    lint: command('lint'),
    build: command('build')
};

//
// registrate commands
//

//
// export
//

module.exports = {
    run: run,
    extract: commands.extract,
    find: commands.find,
    lint: commands.lint,
    build: commands.build
};
