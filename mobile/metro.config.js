const http = require('node:http');
const {getDefaultConfig} = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const backendPort = Number(process.env.PORT || 4000);
const backendPaths = ['/api', '/health', '/ready', '/media', '/uploads'];

function isBackendRequest(url = '') {
  return backendPaths.some(path => url === path || url.startsWith(`${path}/`) || url.startsWith(`${path}?`));
}

config.server = {
  ...(config.server || {}),
  enhanceMiddleware(metroMiddleware) {
    return (request, response, next) => {
      if (!isBackendRequest(request.url)) return metroMiddleware(request, response, next);

      const proxy = http.request({
        hostname: '127.0.0.1',
        port: backendPort,
        path: request.url,
        method: request.method,
        headers: {...request.headers, host: `127.0.0.1:${backendPort}`},
      }, upstream => {
        response.writeHead(upstream.statusCode || 502, upstream.headers);
        upstream.pipe(response);
      });

      proxy.setTimeout(20_000, () => proxy.destroy(new Error('TekBooks API proxy timed out')));
      proxy.on('error', error => {
        if (response.headersSent) return response.end();
        response.writeHead(502, {'Content-Type': 'application/json'});
        response.end(JSON.stringify({message: `TekBooks API proxy failed: ${error.message}`}));
      });
      request.pipe(proxy);
    };
  },
};

module.exports = config;
