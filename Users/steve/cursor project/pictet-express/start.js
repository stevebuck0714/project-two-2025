const { spawn } = require('child_process');
const path = require('path');

// Ensure we're in the correct directory by using __dirname
const appDir = __dirname;
process.chdir(appDir);

console.log('Starting server from directory:', process.cwd());

// Start the server
const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    shell: true,
    cwd: appDir  // Explicitly set the working directory
});

server.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
    server.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    server.kill('SIGTERM');
    process.exit(0);
}); 