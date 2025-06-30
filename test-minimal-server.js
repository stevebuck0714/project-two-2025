const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Minimal server is running!\n');
});

server.listen(4000, '0.0.0.0', () => {
  console.log('Minimal server running at http://localhost:4000/');
}); 