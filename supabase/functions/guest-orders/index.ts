const PROJECT_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ALLOWED_ORIGINS = new Set([
  'https://havelle-fine-jewellery.pages.dev',
  'https://havelle-ng.pages.dev',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);

const headersFor = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://havelle-fine-jewellery.pages.dev',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

const respond = (data: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...headersFor(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const isText = (value: unknown, min: number, max: number): value is string =>
  typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response('ok', { headers: headersFor(origin) });
  if (request.method !== 'POST') return respond({ error: 'Use POST for this endpoint.' }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return respond({ error: 'This site is not allowed.' }, 403, origin);
  if (!PROJECT_URL || !SERVICE_KEY) return respond({ error: 'Shop service is not configured.' }, 503, origin);

  const length = Number(request.headers.get('content-length') || 0);
  if (length > 6_000_000) return respond({ error: 'Request is too large.' }, 413, origin);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond({ error: 'Send valid JSON.' }, 400, origin);
  }
  const bodyBytes = new TextEncoder().encode(JSON.stringify(body)).length;
  const bodyLimit = body.action === 'upload_receipt' ? 6_000_000 : 20_000;
  if (bodyBytes > bodyLimit) return respond({ error: 'Request is too large.' }, 413, origin);
  if (typeof body.website === 'string' && body.website.trim()) return respond({ error: 'Request rejected.' }, 400, origin);

  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  if (body.action === 'create') {
    if (!isText(body.customer_name, 2, 120) || !isText(body.customer_phone, 7, 30) ||
        !isText(body.delivery_address, 5, 500) || !isText(body.delivery_city, 2, 100) ||
        (body.customer_email != null && (typeof body.customer_email !== 'string' || body.customer_email.length > 254)) ||
        !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
      return respond({ error: 'Check the customer, delivery, and cart details.' }, 400, origin);
    }
    const items = body.items as Array<Record<string, unknown>>;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (items.some((item) => !item || typeof item !== 'object' || typeof item.product_id !== 'string' ||
      !uuid.test(item.product_id) || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 25)) {
      return respond({ error: 'One or more cart items are invalid.' }, 400, origin);
    }

    const response = await fetch(`${PROJECT_URL}/rest/v1/rpc/create_havelle_order`, {
      method: 'POST', headers,
      body: JSON.stringify({
        p_customer_name: body.customer_name,
        p_customer_phone: body.customer_phone,
        p_customer_email: body.customer_email ?? null,
        p_delivery_address: body.delivery_address,
        p_delivery_city: body.delivery_city,
        p_items: items,
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof result?.message === 'string' ? result.message : 'Could not place the order. Please check stock and try again.';
      return respond({ error: message }, 409, origin);
    }
    return respond({ order: result }, 201, origin);
  }

  if (body.action === 'upload_receipt') {
    const tracking = typeof body.tracking_code === 'string' ? body.tracking_code.trim().toUpperCase() : '';
    const mime = body.mime_type;
    const base64 = body.receipt_base64;
    if (!/^HV-[A-F0-9]{20}$/.test(tracking)) return respond({ error: 'Enter your valid order tracking number.' }, 400, origin);
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(String(mime)) || typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      return respond({ error: 'Upload a JPG, PNG, or PDF receipt.' }, 400, origin);
    }
    const estimatedBytes = Math.floor(base64.length * 3 / 4);
    if (estimatedBytes < 1 || estimatedBytes > 4 * 1024 * 1024) return respond({ error: 'Receipt files must be 4 MB or smaller.' }, 413, origin);
    const code = encodeURIComponent(tracking);
    const orderResponse = await fetch(`${PROJECT_URL}/rest/v1/orders?select=id,tracking_code&tracking_code=eq.${code}&limit=1`, { headers });
    const found = await orderResponse.json().catch(() => null);
    if (!orderResponse.ok) return respond({ error: 'Order lookup is temporarily unavailable.' }, 502, origin);
    if (!Array.isArray(found) || !found.length) return respond({ error: 'We could not find an order with that tracking number.' }, 404, origin);
    const extension = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
    const objectPath = `${tracking}/${crypto.randomUUID()}.${extension}`;
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const uploaded = await fetch(`${PROJECT_URL}/storage/v1/object/havelle-payment-receipts/${objectPath}`, {
      method: 'POST', headers: { ...headers, 'Content-Type': String(mime), 'x-upsert': 'false' }, body: bytes,
    });
    if (!uploaded.ok) return respond({ error: 'Receipt upload failed. Please try again.' }, 502, origin);
    const update = await fetch(`${PROJECT_URL}/rest/v1/orders?id=eq.${encodeURIComponent(found[0].id)}`, {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ payment_receipt_path: objectPath }),
    });
    if (!update.ok) return respond({ error: 'Receipt uploaded, but we could not attach it to the order. Please contact Havelle.' }, 502, origin);
    return respond({ success: true, message: 'Receipt uploaded for admin review.' }, 200, origin);
  }

  if (body.action === 'track') {
    if (typeof body.tracking_code !== 'string' || !/^HV-[A-F0-9]{20}$/i.test(body.tracking_code.trim())) {
      return respond({ error: 'Enter a valid order tracking number.' }, 400, origin);
    }
    const code = encodeURIComponent(body.tracking_code.trim().toUpperCase());
    const response = await fetch(`${PROJECT_URL}/rest/v1/orders?select=tracking_code,status,created_at,delivery_city,items_subtotal_ngn,delivery_fee_ngn,total_ngn,payment_receipt_path,order_items(product_name,quantity)&tracking_code=eq.${code}&limit=1`, { headers });
    const result = await response.json().catch(() => null);
    if (!response.ok) return respond({ error: 'Order lookup is temporarily unavailable.' }, 502, origin);
    if (!Array.isArray(result) || !result.length) return respond({ error: 'We could not find an order with that number.' }, 404, origin);
    const order = result[0];
    return respond({ order: {
      tracking_code: order.tracking_code,
      status: order.status,
      created_at: order.created_at,
      delivery_city: order.delivery_city,
      items_subtotal_ngn: order.items_subtotal_ngn,
      delivery_fee_ngn: order.delivery_fee_ngn,
      total_ngn: order.total_ngn,
      has_receipt: Boolean(order.payment_receipt_path),
      items: order.order_items,
    } }, 200, origin);
  }

  return respond({ error: 'Unknown action.' }, 400, origin);
});
