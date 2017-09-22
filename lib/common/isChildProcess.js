exports.isChildProcess = typeof process.send == 'function'; // child process has send method

// that's important to setup handler on `uncaughtException` asap,
// since exception may happens in dependencies and error details
// will be lost (parent process will get `unexpected exit with code 1`)
if (exports.isChildProcess)
  process.on('uncaughtException', function(error){
    process.send({
      errorType: 'Exception',
      error: String(error)
    });
    process.exit(2);
  });
