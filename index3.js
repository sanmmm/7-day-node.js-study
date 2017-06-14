let http = require('http');
let fs = require('fs');
let path = require('path');
let Buffer = require('buffer').Buffer;
let co = require('co');
let MIME = {
    '.js': 'application/js',
    '.css': 'text/css'
}

function combineFiles (pathnames, writer) {
    function getFile (pathname, writer) { // 创建包裹文件读写到response对象操作的promise
        return new Promise((resolve, reject) => {
            let reader = fs.createReadStream(pathname);
            reader.pipe(writer, {end: false});
            reader.on('error', err => { // 错误处理
                reject(err);
            });
            reader.on('end', _ => { // 结束后处理
                resolve();
            });
        });
    }
    return co(function* ge() {
        for (let pathname of pathnames) {
            yield getFile(pathname, writer);
        };
    });
}

function validate (pathnames) {
    function getExitStatus(pathname) {
        return new Promise(function (resolve, reject) {
            fs.stat(pathname, (err, stats) => {
                if (err) {
                    reject(err);
                } else if (!stats.isFile()) {
                    reject(new Error(`${pathname} is not a file name`));
                } else {
                    resolve();
                }
            });
        });
    }
    return co(function* () {
        for (let pathname of pathnames) {
            yield getExitStatus(pathname);
        }
    });
}

function main (argv) {
    console.log('start http server');
    let config = argv[0] ? JSON.parse(fs.readFileSync(argv[0], 'utf-8')) : {},
        root = config.root || '.',
        port = config.port || 9000,
        server;
    server = http.createServer(function (req, res) {
        urlInfo = parserUrl(root, req.url);
        console.log(...urlInfo.pathnames);
        co(function* () {
            try {
                yield validate(urlInfo.pathnames);
                res.writeHead(200, {
                    'Content-Type': urlInfo.MIME
                });
                yield combineFiles(urlInfo.pathnames, res);
                res.end();
            } catch (err) {
                console.log('outer err', err);
                res.writeHead(404);
                res.end(err.message);
            }
        });
    }).listen(port);
    process.on('SIGTERM', _ => {
        console.log('stop http server');
        server.close(_ => {
            process.exit(0);
        });
    });
    console.log(`http server start and linsten on ${port}`);
}

function parserUrl(root, url) {
    if (url.indexOf('??') === -1) {
        url = url.replace('/', '/??');
    }
    let parts = url.split('??');
    let basePath = parts[0];
    let pathnames = [];
    parts[1].split(',').forEach(function (item) {
        pathnames.push(path.join(root, basePath, item));
    });
    return {
        MIME: MIME[path.extname(pathnames[0])] || 'text/plain',
        pathnames: pathnames
    };
}
// console.log(parserUrl('/fff', '/sss/test.js'));
main(process.argv.splice(2));