var assert = require('assert');
var path = require('path');
var fs = require('fs');
var cli = require('../../lib/cli.js');
var testDir = path.join(__dirname, '/env/app');

function sortByPath(a, b) {
    return a.path > b.path ? 1 : a.path < b.path ? -1 : 0;
}

function checkResult(flow, expectedPath, preprocessContent) {
    var expectedFiles = fs.readdirSync(expectedPath).map(function(file){
        return {
            path: file,
            content: preprocessContent(file, fs.readFileSync(path.join(expectedPath, file), 'utf8'))
        };
    }).sort(sortByPath);

    var actualFiles = flow.result.map(function(file){
        var filePath = path.relative(flow.options.output, file.path);
        return {
            path: filePath,
            content: preprocessContent(filePath, file.content)
        };
    }).sort(sortByPath);

    assert.deepEqual(actualFiles, expectedFiles);
}

describe('build', function(){
  it('default', function(){
    return cli.build.run([
        '--silent',
        '--target', 'none',
        '--base', testDir,
        '--file', path.join(testDir, 'index.html')
      ])
      .then(function(flow){
        checkResult(flow, path.join(__dirname, '/expected/default'), function(file, content){
            switch (file) {
                case 'index.html':
                    content = content
                        .replace(/ content=".+"/, '')
                        .replace(/script\.js\?[^"]+/, 'script.js');
                    break;
                case 'script.js':
                    // it's funny but JS parser can change the order of regexp flags
                    content = content.replace(/\/ig;/, '\/gi;');
                    break;
            }
            return content;
        });
      });
  });

  it('pack', function(){
    return cli.build.run([
        '--silent',
        '--target', 'none',
        '--base', testDir,
        '--file', path.join(testDir, 'index.html'),
        '--pack'
      ])
      .then(function(flow){
        checkResult(flow, path.join(__dirname, '/expected/packed'), function(file, content){
            switch (file) {
                case 'index.html':
                    content = content
                        .replace(/ content=".+"/, '')
                        .replace(/script\.js\?[^"]+/, 'script.js');
                    break;
                case 'script.js':
                    // content may vary with deps update
                    content = content.replace(/function\(\){.+}/, 'function(){}');
                    break;
            }
            return content;
        });
      });
  }).timeout(5000);
});
