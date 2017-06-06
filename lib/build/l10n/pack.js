module.exports = function() {
    // solution for basis.js prior 1.0

    // var fconsole = flow.console;
    // var l10nIndex = flow.l10n.index;

    // if (!l10nIndex)
    // {
    //   flow.warn({
    //     fatal: true,
    //     message: 'l10n index must be built before compression'
    //   });
    //   return;
    // }

    // //
    // // pack definitions
    // //
    // fconsole.start('Pack createDictionary');
    // flow.l10n.defList.forEach(function(entry){
    //   fconsole.log(entry.name);

    //   var dict = {};
    //   dict[entry.name] = entry.keys;

    //   entry.args[2] = ['array', packDictionary(dict, l10nIndex.map).map(function(token){
    //     return [typeof token == 'number' ? 'num' : 'string', token];
    //   })];
    // });
    // fconsole.endl();

    // //
    // // pack getToken
    // //
    // fconsole.start('Pack getToken');
    // flow.l10n.getTokenList.forEach(function(entry){
    //   var packed = packKey(l10nIndex.keys, entry.key);

    //   if (packed)
    //   {
    //     fconsole.log(entry.key + ' -> ' + packed);
    //     entry.token[2] = [['string', packed]];
    //   }
    //   else
    //   {
    //     flow.warn({
    //       file: entry.file.relpath,
    //       message: 'l10n key ' + entry.key + ' not found (ignored)'
    //     });
    //   }
    // });
    // fconsole.endl();

    // //
    // // process templates & pack l10n paths
    // //
    // fconsole.start('Pack keys in templates');
    // flow.l10n.tmplRefs.forEach(function(entry){
    //   var packed = packKey(l10nIndex.keys, entry.key);

    //   if (packed)
    //   {
    //     packed = 'l10n:' + packed;
    //     entry.host[entry.idx] = packed;
    //     fconsole.log('l10n:' + entry.key + ' -> ' + packed);
    //   }
    //   else
    //   {
    //     flow.warn({
    //       file: entry.file.relpath,
    //       message: 'l10n key ' + entry.key + ' not found (ignored)'
    //     });
    //   }
    // });
    // fconsole.endl();

    // //
    // // pack packages
    // //
    // fconsole.start('Pack packages');
    // flow.l10n.packages.forEach(function(file){
    //   fconsole.log(file.jsRef);
    //   file.jsResourceContent = packDictionary(file.jsResourceContent, l10nIndex.map);
    // });
    // fconsole.endl();
};

module.exports.handlerName = '[l10n] Compress';
module.exports.skip = function(flow) {
    if (!flow.l10n) {
        return 'basis.l10n not found';
    }

    if (!flow.options.l10nPack) {
        return 'Use option --l10n-pack for compression';
    }

    if (flow.l10n.version != 1) {
        return 'Compression is not support for new version of basis.l10n';
    }
};

//
// utils
//

// function packKey(index, key){
//   if (key.charAt(0) == '#')
//     return false;

//   return index.hasOwnProperty(key)
//     ? '#' + index[key].toString(36)
//     : false;
// }

// function packDictionary(dict, map){
//   var result = [];
//   var flattenDict = {};

//   // linear
//   for (var dictName in dict){
//     for (var key in dict[dictName]){
//       flattenDict[dictName + '.' + key] = dict[dictName][key];
//     }
//   }

//   // pack
//   for (var i = 0, gap = -1; i < map.length; i++)
//   {
//     if (flattenDict[map[i]])
//     {
//       if (gap != -1)
//         result.push(gap);

//       result.push(flattenDict[map[i]]);

//       gap = -1;
//     }
//     else
//       gap++;
//   }

//   if (typeof result[result.length - 1] == 'number')
//     result.pop();

//   return result;
// }
