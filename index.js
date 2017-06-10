let http = require('http');
let fs = require('fs');
let path = require('path');
let Buffer = require('buffer').Buffer;
let MIME = {
    '.js': 'application/js',
    '.css': 'text/css'
}
function combineFiles (pathnames) {
    let promise = null;
    let dataArr = [];
    function getFile (pathname, dataArr) {
        return new Promise((resolve, reject) => {
            fs.readFile(pathname, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    dataArr.push(data);
                    resolve(dataArr);
                }
            });
        });
    }
    for (let i = 0; i < pathnames.length; i++) {
        console.log(i,  pathnames.length);
        if(promise) {
            promise = promise.then(function () {
                return getFile(pathnames[i], dataArr);
            });
            continue;
        }
        promise = new Promise((resolve, reject) => {
            resolve(getFile(pathnames[i], dataArr));
        });
    }
    return promise;
}

function main (argv) {
    let config = argv[0] ? JSON.parse(fs.readFileSync(argv[0], 'utf-8')) : {};
    console.log(config.port);
    let root = config.root || '.';
    let port = config.port || 9000;
    http.createServer(function (req, res) {
        urlInfo = parserUrl(root, req.url);
        console.log(...urlInfo.pathnames);
        combineFiles(urlInfo.pathnames).then(dataArr => {
            res.writeHead(200, {
                'Content-Type': urlInfo.MIME
            });
            res.end(Buffer.concat(dataArr));
        }).catch(err => {
            console.log('error');
            res.writeHead(404);
            res.end(err.message);
        });
    }).listen(port);
    console.log(`http server start and linsten on ${port}`);
}

function parserUrl(root, url) {
    if (url.indexOf('??') === -1) {
        url = url.replace('/', '??');
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