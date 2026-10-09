async function handler(req: Request): Promise<Response> {
  const incomingUrl = new URL(req.url);

  // 根路径：用于确认服务在跑
  if (incomingUrl.pathname === "/") {
    return new Response("此地址只用于为astrbot提供更快速的github访问服务", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const targetUrlString = decodeURIComponent(incomingUrl.pathname.slice(1));
  if (
    !targetUrlString ||
    (!targetUrlString.startsWith("http://") && !targetUrlString.startsWith("https://"))
  ) {
    return new Response("Invalid or missing target URL in path. Usage: /<target_url>", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, *",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 只转发必要的请求头，避免把 Host / content-length 等透传给上游
  const fwdHeaders = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) fwdHeaders.set("content-type", ct);
  const auth = req.headers.get("authorization");
  if (auth) fwdHeaders.set("authorization", auth);

  try {
    const response = await fetch(targetUrlString, {
      method: req.method,
      headers: fwdHeaders,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
      redirect: "manual",
    });

    const buf = await response.arrayBuffer();

    // 关键：不透传上游的 content-length / content-encoding / transfer-encoding
    const outHeaders = new Headers(corsHeaders);
    const upstreamType = response.headers.get("content-type");
    if (upstreamType) outHeaders.set("content-type", upstreamType);

    if (req.method === "HEAD") {
      return new Response(null, { status: response.status, headers: outHeaders });
    }
    return new Response(buf, { status: response.status, headers: outHeaders });
  } catch (error) {
    const msg = String((error as Error)?.message ?? error);
    console.error(`Error fetching ${targetUrlString}:`, msg);
    return new Response(`Failed to proxy request to ${targetUrlString}: ${msg}`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

console.log("此地址只用于帮助astrbot更快的连接github");
Deno.serve(handler);
