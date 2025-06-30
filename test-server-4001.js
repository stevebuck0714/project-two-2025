const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Minimal test server is running on port 4001!\n');
});

server.listen(4001, '0.0.0.0', () => {
  console.log('Minimal test server running at http://localhost:4001/');
}); 