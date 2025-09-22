const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting development server with auto-restart...');

let serverProcess = null;

function startServer() {
    if (serverProcess) {
        serverProcess.kill();
    }
    
    console.log('\n🚀 Starting Express server on port 4001...');
    
    serverProcess = spawn('node', ['server.js'], {
        stdio: 'inherit',
        cwd: __dirname
    });
    
    serverProcess.on('close', (code) => {
        if (code !== 0) {
            console.log('\n⚠️  Server crashed, restarting in 2 seconds...');
            setTimeout(startServer, 2000);
        }
    });
    
    serverProcess.on('error', (err) => {
        console.error('Server error:', err);
        setTimeout(startServer, 2000);
    });
}

// Watch for file changes
function watchFiles() {
    const watchDirs = ['./', './views', './public'];
    
    watchDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.watch(dir, { recursive: true }, (eventType, filename) => {
                if (filename && (filename.endsWith('.js') || filename.endsWith('.ejs') || filename.endsWith('.css'))) {
                    console.log(`\n📝 File changed: ${filename}`);
                    console.log('🔄 Restarting server...');
                    setTimeout(startServer, 500);
                }
            });
        }
    });
}

// Start the server
startServer();
watchFiles();

console.log('\n✅ Development server is running with file watching enabled');
console.log('📂 Watching: .js, .ejs, .css files');
console.log('🌐 Server will be available at: http://localhost:4001');
console.log('🔄 Server will auto-restart on file changes');

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down development server...');
    if (serverProcess) {
        serverProcess.kill();
    }
    process.exit(0);
});



