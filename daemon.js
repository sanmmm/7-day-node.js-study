let childProcess = require('child_process');



function spawn(server, config) {
    console.log('start child server');
    worker = childProcess.spawn('node', [server, config]);
    worker.on('exit', function (code) {
        if (code !== 0) {
            console.log('restart child server');
            spawn(server, config);
        }
    });
    worker.stdout.on('data', function (data) {
        console.log(data.toString());
    });
    return worker;
}

function main (args) {
    console.log('start daemon server');
    let worker = spawn(...args);
    process.on('SIGTERM', function () {
        console.log('stop daemon server');
        worker.kill();
        setTimeout(_ => {
            process.exit(0);
        }, 1000);
    });
}

main(process.argv.slice(2));