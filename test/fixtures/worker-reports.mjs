process.send({ kind: 'crash', message: 'from worker ' + process.argv[2] });
