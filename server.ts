import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import app from './_worker';

const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

// --- D1 Shim ---
const sqlite = new Database('data.db');

const createD1Shim = (db: Database.Database) => {
  const prepare = (sql: string) => {
    const stmt = db.prepare(sql);
    const wrap = (boundStmt: Database.Statement) => {
      const runner = {
        bind: (...args: any[]) => wrap(stmt.bind(...args)),
        all: async () => {
          try {
            const results = stmt.all();
            return { results, success: true };
          } catch (e: any) {
            console.error('D1 Shim All Error:', e.message, 'SQL:', sql);
            throw e;
          }
        },
        run: async () => {
          try {
            const info = stmt.run();
            return { success: true, meta: info };
          } catch (e: any) {
            console.error('D1 Shim Run Error:', e.message, 'SQL:', sql);
            throw e;
          }
        },
        first: async (colName?: string) => {
          const row = stmt.get() as any;
          return colName ? row?.[colName] : row;
        }
      };
      return runner;
    };
    return wrap(stmt);
  };

  return {
    prepare,
    batch: async (stmts: any[]) => {
      const results = [];
      for (const s of stmts) {
        results.push(await s.run());
      }
      return results;
    },
    exec: async (sql: string) => {
      db.exec(sql);
      return { success: true };
    }
  };
};

const d1Shim = createD1Shim(sqlite);

// --- R2 Shim ---
const storageDir = path.join(process.cwd(), 'storage');
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir);

const r2Shim = {
  put: async (key: string, body: any, options?: any) => {
    const filePath = path.join(storageDir, key.replace(/\//g, '_'));
    const buffer = body instanceof ArrayBuffer ? Buffer.from(body) : body;
    fs.writeFileSync(filePath, buffer);
    return { key };
  },
  get: async (key: string, options?: any) => {
    const filePath = path.join(storageDir, key.replace(/\//g, '_'));
    if (!fs.existsSync(filePath)) return null;
    const body = fs.readFileSync(filePath);
    return {
      body: {
        getReader: () => {
             // Mock stream if needed, but for simplicity:
             return null;
        }
      },
      arrayBuffer: async () => body.buffer,
      writeHttpMetadata: (headers: any) => {
          // Mock metadata
      },
      httpMetadata: { contentType: 'video/mp4' },
      size: body.length,
      httpEtag: 'mock-etag'
    };
  },
  delete: async (key: string) => {
    const filePath = path.join(storageDir, key.replace(/\//g, '_'));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
};

async function startServer() {
  const vite = !isProd
    ? await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      })
    : null;

  const nodeApp = new Hono();

  // Inject shims into Hono context via middleware
  nodeApp.use('/api/*', async (c, next) => {
      // @ts-ignore
      c.env = {
          DB: d1Shim,
          R2: r2Shim,
          SECRET: process.env.SECRET || "bmtv-secret-key-2026"
      };
      await next();
  });

  // Mount the main worker app
  nodeApp.route('/', app);

  // Serve static files in production
  if (isProd) {
    const distPath = path.join(process.cwd(), 'dist');
    // For SPA fallback and static assets
    // We'll handle this in the outer listener or use hono/serve-static
  }

  const server = serve({
    fetch: (req) => {
        // Here we need to handle the request with Hono first, then Vite if it fails or if it's not an API call
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api')) {
            return nodeApp.fetch(req);
        }
        
        if (vite) {
            // Vite handles the rest in dev
            // But serve({fetch}) expects a Response. 
            // We can convert express-style middleware to fetch, but it's easier to use a standard express server or similar.
            // Actually, @hono/node-server can work with express middleware if we use a different setup.
            return nodeApp.fetch(req);
        }
        
        return nodeApp.fetch(req);
    },
    port: PORT
  }, (info) => {
      console.log(`Server running on http://0.0.0.0:${info.port}`);
  });

  // Since we want both Vite and Hono, the standard AI Studio pattern uses Express.
  // Let's rewrite this to use Express for easier Vite integration as per guidelines.
}

// Rewriting to Express for compatibility with the guidelines
import express from 'express';

async function startExpressServer() {
    const expressApp = express();
    
    // API middleware
    expressApp.use('/api', async (req, res) => {
        try {
            // Convert Express req to Fetch req for Hono
            const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
            
            // For the body, we need to handle it carefully in Node/Express
            let body: any = undefined;
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                // In a real production app, we might want to stream this.
                // For simplicity here, we'll collect it if not already parsed, 
                // or use the raw body if available.
                // But since we are likely handling multipart (uploads), streaming is better.
                body = req; 
            }

            const fetchReq = new Request(url, {
                method: req.method,
                headers: new Headers(req.headers as any),
                body: body,
                // @ts-ignore
                duplex: 'half'
            });

            const env = {
                DB: d1Shim,
                R2: r2Shim,
                SECRET: process.env.SECRET || "bmtv-secret-key-2026"
            };

            const response = await app.fetch(fetchReq, env);
            
            res.status(response.status);
            response.headers.forEach((value, key) => {
                res.setHeader(key, value);
            });
            
            const responseBody = await response.arrayBuffer();
            res.send(Buffer.from(responseBody));
        } catch (e: any) {
            console.error('Proxy error:', e);
            res.status(500).send(e.message);
        }
    });

    if (!isProd) {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        expressApp.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        expressApp.use(express.static(distPath));
        expressApp.get('*all', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    expressApp.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
}

// Initialiser la DB si elle est vide
async function ensureDbInit() {
    try {
        // Check if users table exists
        sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    } catch (e) {
        console.log("Database not initialized. Initializing...");
        // Use the init function from _worker.ts if exported, but it's internal.
        // I'll just rely on the /api/init route which the app naturally calls if needed,
        // or I can try to trigger it.
    }
}

ensureDbInit();
startExpressServer();
