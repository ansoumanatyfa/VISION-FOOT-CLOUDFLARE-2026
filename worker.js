import { DurableObject } from "cloudflare:workers";

const DEFAULT_STATE = {
  home: 'DJIBABOUYA', away: 'KANSIDI', sh: 0, sa: 0, status: 'DIRECT',
  extra: 0, message: '', running: false, elapsed: 0, startedAt: 0,
  extraMode: false, extraElapsed: 0, extraStartedAt: 0,
  homeColor: '#ffffff', homeOutline: '#000000', homeBg: '#0964e8',
  awayColor: '#ffffff', awayOutline: '#000000', awayBg: '#f4c400',
  scoreColor: '#111111', scoreBg: '#ffffff', clockColor: '#ffffff',
  extraColor: '#ffffff', scoreVisible: true, scoreScale: 100, scoreX: 0, scoreY: 108
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type,x-admin-token',
    'access-control-allow-methods': 'GET,PUT,POST,OPTIONS'
  };
}

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

function stateStub(env) {
  const id = env.MATCH_STATE.idFromName('main-match-state');
  return env.MATCH_STATE.get(id);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    if (url.pathname === '/api/state' || url.pathname === '/api/login' || url.pathname === '/api/ws') {
      const stub = stateStub(env);
      const response = await stub.fetch(new Request(new URL(url.pathname + url.search, request.url), request));
      return withCors(response);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('VISION FOOT', { status: 200 });
  }
};

export class MatchState extends DurableObject {
  sessions = new Map();

  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async getStored() {
    const stored = await this.ctx.storage.get('state');
    return stored && typeof stored === 'object' ? { ...DEFAULT_STATE, ...stored } : { ...DEFAULT_STATE };
  }

  async issueToken() {
    const token = crypto.randomUUID() + '-' + crypto.randomUUID();
    await this.ctx.storage.put('adminToken', token);
    return token;
  }

  async verifyToken(token) {
    const saved = await this.ctx.storage.get('adminToken');
    return Boolean(token && saved && token === saved);
  }

  async updateState(incoming) {
    const current = await this.getStored();
    const clean = { ...current };
    for (const [key, value] of Object.entries(incoming || {})) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_STATE, key)) clean[key] = value;
    }
    await this.ctx.storage.put('state', clean);
    this.broadcast(clean);
    return clean;
  }

  broadcast(state) {
    const text = JSON.stringify(state);
    for (const [ws] of this.sessions) {
      try { ws.send(text); }
      catch (_) { this.sessions.delete(ws); }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/state' && request.method === 'GET') {
      return json(await this.getStored());
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        const password = String(body.password || '');
        if (!this.env.ADMIN_PASSWORD || password !== this.env.ADMIN_PASSWORD) {
          return json({ error: 'unauthorized' }, 401);
        }
        return json({ token: await this.issueToken() });
      } catch (_) {
        return json({ error: 'bad request' }, 400);
      }
    }

    if (url.pathname === '/api/state' && request.method === 'PUT') {
      const token = request.headers.get('x-admin-token') || '';
      if (!(await this.verifyToken(token))) return json({ error: 'unauthorized' }, 401);
      try {
        const incoming = await request.json();
        return json(await this.updateState(incoming));
      } catch (_) {
        return json({ error: 'bad request' }, 400);
      }
    }

    if (url.pathname === '/api/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('WebSocket required', { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.sessions.set(server, true);
      server.addEventListener('close', () => this.sessions.delete(server));
      server.addEventListener('error', () => this.sessions.delete(server));
      server.addEventListener('message', () => {});
      server.send(JSON.stringify(await this.getStored()));
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }
}
