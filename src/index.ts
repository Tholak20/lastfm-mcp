// src/index.ts — Streamable HTTP transport (MCP 2025-03-26)
// Compatible Claude.ai (Accept: text/event-stream) ET Perplexity (Accept: application/json)

export interface Env {
  LASTFM_API_KEY: string;
  MCP_TOKEN: string;
}

const DEFAULT_USER = "Tolak20";
const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

async function lfm(env: Env, params: Record<string, string>): Promise<any> {
  const url = new URL(BASE_URL);
  url.searchParams.set("api_key", env.LASTFM_API_KEY);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Last.fm HTTP error: ${res.status}`);
  return res.json();
}

function tool(name: string, description: string, inputSchema: object) {
  return { name, description, inputSchema };
}

const TOOLS = [
  tool("get_recent_tracks", "Get recent tracks scrobbled by the user", {
    type: "object",
    properties: {
      limit: { type: "number", description: "Number of tracks (default 20, max 200)" },
      page: { type: "number", description: "Page number" },
    },
  }),
  tool("get_loved_tracks", "Get tracks loved/liked by the user", {
    type: "object",
    properties: {
      limit: { type: "number", description: "Number of tracks (default 20)" },
    },
  }),
  tool("get_top_artists", "Get top artists for the user by time period", {
    type: "object",
    properties: {
      period: { type: "string", enum: ["7day", "1month", "3month", "6month", "12month", "overall"] },
      limit: { type: "number", description: "Number of results (default 20)" },
    },
  }),
  tool("get_top_tracks", "Get top tracks for the user by time period", {
    type: "object",
    properties: {
      period: { type: "string", enum: ["7day", "1month", "3month", "6month", "12month", "overall"] },
      limit: { type: "number", description: "Number of results (default 20)" },
    },
  }),
  tool("get_top_albums", "Get top albums for the user by time period", {
    type: "object",
    properties: {
      period: { type: "string", enum: ["7day", "1month", "3month", "6month", "12month", "overall"] },
      limit: { type: "number", description: "Number of results (default 20)" },
    },
  }),
  tool("get_weekly_chart", "Get weekly artist/track/album chart for the user", {
    type: "object",
    properties: {
      type: { type: "string", enum: ["artists", "tracks", "albums"] },
    },
    required: ["type"],
  }),
  tool("search_artist", "Search for an artist by name on Last.fm", {
    type: "object",
    properties: {
      artist: { type: "string" },
      limit: { type: "number" },
    },
    required: ["artist"],
  }),
  tool("search_track", "Search for a track by name, optionally filtered by artist", {
    type: "object",
    properties: {
      track: { type: "string" },
      artist: { type: "string", description: "Optional artist filter" },
      limit: { type: "number" },
    },
    required: ["track"],
  }),
  tool("search_album", "Search for an album by name on Last.fm", {
    type: "object",
    properties: {
      album: { type: "string" },
      limit: { type: "number" },
    },
    required: ["album"],
  }),
  tool("get_artist_info", "Get detailed info about an artist: bio, tags, similar artists, stats", {
    type: "object",
    properties: { artist: { type: "string" } },
    required: ["artist"],
  }),
  tool("get_track_info", "Get detailed info about a track: duration, tags, wiki, play count", {
    type: "object",
    properties: {
      track: { type: "string" },
      artist: { type: "string" },
    },
    required: ["track", "artist"],
  }),
  tool("get_album_info", "Get detailed info about an album: tracklist, tags, wiki", {
    type: "object",
    properties: {
      album: { type: "string" },
      artist: { type: "string" },
    },
    required: ["album", "artist"],
  }),
  tool("get_similar_artists", "Get artists similar to a given artist", {
    type: "object",
    properties: {
      artist: { type: "string" },
      limit: { type: "number" },
    },
    required: ["artist"],
  }),
  tool("get_user_info", "Get user profile stats: total scrobbles, country, member since", {
    type: "object",
    properties: {},
  }),
  tool("get_user_friends", "Get the user's Last.fm friends", {
    type: "object",
    properties: { limit: { type: "number" } },
  }),
];

async function callTool(name: string, args: any, env: Env): Promise<any> {
  const user = DEFAULT_USER;
  switch (name) {
    case "get_recent_tracks": {
      const data = await lfm(env, { method: "user.getrecenttracks", user, limit: String(args.limit ?? 20), page: String(args.page ?? 1) });
      return data.recenttracks;
    }
    case "get_loved_tracks": {
      const data = await lfm(env, { method: "user.getlovedtracks", user, limit: String(args.limit ?? 20) });
      return data.lovedtracks;
    }
    case "get_top_artists": {
      const data = await lfm(env, { method: "user.gettopartists", user, period: args.period ?? "overall", limit: String(args.limit ?? 20) });
      return data.topartists;
    }
    case "get_top_tracks": {
      const data = await lfm(env, { method: "user.gettoptracks", user, period: args.period ?? "overall", limit: String(args.limit ?? 20) });
      return data.toptracks;
    }
    case "get_top_albums": {
      const data = await lfm(env, { method: "user.gettopalbums", user, period: args.period ?? "overall", limit: String(args.limit ?? 20) });
      return data.topalbums;
    }
    case "get_weekly_chart": {
      const methodMap: Record<string, string> = {
        artists: "user.getweeklyartistchart",
        tracks: "user.getweeklytrackchart",
        albums: "user.getweeklyalbumchart",
      };
      return await lfm(env, { method: methodMap[args.type], user });
    }
    case "search_artist": {
      const data = await lfm(env, { method: "artist.search", artist: args.artist, limit: String(args.limit ?? 10) });
      return data.results;
    }
    case "search_track": {
      const params: Record<string, string> = { method: "track.search", track: args.track, limit: String(args.limit ?? 10) };
      if (args.artist) params.artist = args.artist;
      const data = await lfm(env, params);
      return data.results;
    }
    case "search_album": {
      const data = await lfm(env, { method: "album.search", album: args.album, limit: String(args.limit ?? 10) });
      return data.results;
    }
    case "get_artist_info": {
      const data = await lfm(env, { method: "artist.getinfo", artist: args.artist, username: user });
      return data.artist;
    }
    case "get_track_info": {
      const data = await lfm(env, { method: "track.getinfo", track: args.track, artist: args.artist, username: user });
      return data.track;
    }
    case "get_album_info": {
      const data = await lfm(env, { method: "album.getinfo", album: args.album, artist: args.artist, username: user });
      return data.album;
    }
    case "get_similar_artists": {
      const data = await lfm(env, { method: "artist.getsimilar", artist: args.artist, limit: String(args.limit ?? 10) });
      return data.similarartists;
    }
    case "get_user_info": {
      const data = await lfm(env, { method: "user.getinfo", user });
      return data.user;
    }
    case "get_user_friends": {
      const data = await lfm(env, { method: "user.getfriends", user, limit: String(args.limit ?? 10) });
      return data.friends;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function isAuthorized(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization");
  return !!auth && auth === `Bearer ${env.MCP_TOKEN}`;
}

// Construit la réponse JSON-RPC à partir de la méthode MCP
async function handleMcpRequest(body: any, env: Env): Promise<object> {
  const { method, params, id } = body;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "mcp-lastfm", version: "1.0.0" },
      },
    };
  }

  if (method === "notifications/initialized") {
    // Notification sans réponse attendue
    return { jsonrpc: "2.0", id: null, result: null };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;
    try {
      const result = await callTool(name, args ?? {}, env);
      return {
        jsonrpc: "2.0", id,
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
      };
    } catch (err: any) {
      return {
        jsonrpc: "2.0", id,
        error: { code: -32000, message: err.message },
      };
    }
  }

  return {
    jsonrpc: "2.0", id,
    error: { code: -32601, message: "Method not found" },
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({ name: "mcp-lastfm", version: "1.0.0", user: DEFAULT_USER });
    }

    // ── POST /mcp — Streamable HTTP (MCP 2025-03-26) ─────────────────────────
    // Accept: application/json       → réponse JSON simple  (Perplexity)
    // Accept: text/event-stream      → réponse SSE stream   (Claude)
    if (request.method === "POST" && url.pathname === "/mcp") {
      if (!isAuthorized(request, env)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      let body: any;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
      }

      const acceptsSSE = (request.headers.get("Accept") ?? "").includes("text/event-stream");

      const rpcResponse = await handleMcpRequest(body, env);

      // Notification sans contenu → 202 vide
      if ((body.method as string)?.startsWith("notifications/")) {
        return new Response(null, { status: 202 });
      }

      if (acceptsSSE) {
        // Claude : réponse encapsulée dans un SSE stream
        const payload = `event: message\ndata: ${JSON.stringify(rpcResponse)}\n\n`;
        return new Response(payload, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Perplexity / autres : JSON direct
      return new Response(JSON.stringify(rpcResponse), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};