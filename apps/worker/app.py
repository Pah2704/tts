import os, time
import redis
from http.server import HTTPServer, BaseHTTPRequestHandler

REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))

print('[worker] starting... connecting to redis at', REDIS_HOST, REDIS_PORT)
for i in range(60):
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        r.ping()
        print('[worker] connected to redis ✓')
        r.publish('progress:demo', '{"rowId":"demo","state":"running","tElapsedMs":0}')
        break
    except Exception as e:
        print('[worker] waiting for redis...', str(e))
        time.sleep(1)
else:
    print('[worker] could not connect to redis after retries')

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.end_headers()
        self.wfile.write(b'{"ok": true, "service": "worker", "msg": "Hello from Python Worker"}')

PORT = int(os.getenv('PORT','5001'))
print(f'[worker] http server on :{PORT}')
HTTPServer(('', PORT), Handler).serve_forever()
