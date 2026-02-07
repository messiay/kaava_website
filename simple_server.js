const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.glb': 'model/gltf-binary', // Critical for 3D
    '.gltf': 'model/gltf+json',
    '.htms': 'text/html'
};

const server = http.createServer((req, res) => {
    console.log(`REQ: ${req.url}`);

    // Check for root
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    // Decode URL (handle spaces in filenames)
    filePath = decodeURIComponent(filePath);

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('404: File Not Found');
                console.error(`404: ${filePath}`);
            } else {
                res.writeHead(500);
                res.end('500: Internal Error: ' + error.code);
                console.error(`500: ${filePath} - ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n✅ Server running at http://localhost:${PORT}/index.html`);
    console.log(`   (Keep this terminal window open)\n`);
});
