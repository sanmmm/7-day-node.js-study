# 7-day-node.js-study

在《7天学会node.js》中，最后有一个大实例，实现需求为：
>我们要开发的是一个简单的静态文件合并服务器，该服务器需要支持类似以下格式的JS或CSS文件合并请求。
>
>>http://assets.example.com/foo/??bar.js,baz.js
>
>在以上URL中，??是一个分隔符，之前是需要合并的多个文件的URL的公共部分，之后是使用,分隔的差异部分。因此服务器处理这个URL时，返回的是以下两个文件按顺序合并后的内容。
>
>>/foo/bar.js
/foo/baz.js
>
>另外，服务器也需要能支持类似以下格式的普通的JS或CSS文件请求。
>
>>http://assets.example.com/foo/bar.js
>
>以上就是整个需求。

需求很简单，可以分为三个部分：main函数进行流程控制，对http请求的目标资源进行解析以及合并返回文件。

第一个版本的完整实现为：
1.  流程控制
``` javascript
function main(argv) {
    var config = JSON.parse(fs.readFileSync(argv[0], 'utf-8')),
        root = config.root || '.',
        port = config.port || 80;

    http.createServer(function (request, response) {
        var urlInfo = parseURL(root, request.url);

        combineFiles(urlInfo.pathnames, function (err, data) {
            if (err) {
                response.writeHead(404);
                response.end(err.message);
            } else {
                response.writeHead(200, {
                    'Content-Type': urlInfo.mime
                });
                response.end(data);
            }
        });
    }).listen(port);
}
```
2.  解析
``` javascript
function parseURL(root, url) {
    var base, pathnames, parts;

    if (url.indexOf('??') === -1) {
        url = url.replace('/', '/??');
    }

    parts = url.split('??');
    base = parts[0];
    pathnames = parts[1].split(',').map(function (value) {
        return path.join(root, base, value);
    });

    return {
        mime: MIME[path.extname(pathnames[0])] || 'text/plain',
        pathnames: pathnames
    };
}
```
3. 合并文件
```javascript
function combineFiles(pathnames, callback) {
    var output = [];

    (function next(i, len) {
        if (i < len) {
            fs.readFile(pathnames[i], function (err, data) {
                if (err) {
                    callback(err);
                } else {
                    output.push(data);
                    next(i + 1, len);
                }
            });
        } else {
            callback(null, Buffer.concat(output));
        }
    }(0, pathnames.length));
}
```
js语言在演变过程中为了避免陷入回调地狱做出了多个尝试，诸如promise、generator、async函数,因此上面的实例的实现我们还可以进行改进。

首先，我们可以先尝试用promise来改进.
例如合并文件部分的代码实现逻辑为函数的递归调用，我们可以尝试用promise来将代码形式转为迭代。如:
``` javascript
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
```
完整代码在：[promise改进版本](./index2.js)

promise在一定程度上解决了回调地狱的问题，但是同样存在局限性，诸如无法取消 Promise，一旦新建它就会立即执行，无法中途取消。其次，如果不设置回调函数，Promise 内部抛出的错误，不会反应到外部。第三，当处于 Pending 状态时，无法得知目前进展到哪一个阶段等。

因此，我们可以采用generator来改进。我们引入tk大神的经典库co，用来辅助generator来实现异步的流程控制。

则文件合并部分可以改进为:
``` javascript
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
```
我们可以看见，借助es6的generator特性和co库，我们的代码在形式上和逻辑上都更加容易理解，同时对异步代码在执行过程中的错误也可以进行控制。完整代码见: [generator实现](./index3.js)

es7在吸收了社区的思想后提出了async函数特性，从而从语言层次革新了js对异步执行的控制。我们可以更加轻松得控制异步逻辑，维护异步代码。同样，上述文件合并代码可以改进为：
``` javascript
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
    async function files () {
        for (let pathname of pathnames) {
            await getFile(pathname, writer);
        };
    }
    return files();
}
```
完整部分在：[async实现](./index4.js)

综上，我们可以借助一个小的实例，看到js在异步处理方面做出的尝试和改进。