/**
 * Mappers: Convert between Supabase DB format and Fluxitron API format.
 *
 * Our store has 1 product = 1 variant (no multi-variant system).
 * The variant ID equals the product ID.
 */

// ── Product Mappers ──────────────────────────────────────────────────────────

export interface SupabaseProduct {
  id: string;
  brand: string;
  model: string;
  storage_capacity?: string;
  color?: string;
  imei?: string;
  warranty?: string;
  condition_description?: string;
  grade?: string;
  battery_health?: number;
  price: number;
  compare_at_price?: number;
  stock: number;
  images: string[];
  category: string;
  category_id?: string;
  is_active: boolean;
  sku?: string;
  handle?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface FluxitronProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  status: 'active' | 'draft' | 'archived';
  tags: string[];
  categoryId: string | null;
  images: FluxitronImage[];
  variants: FluxitronVariant[];
  metafields: FluxitronMetafield[];
  createdAt: string;
  updatedAt: string;
}

export interface FluxitronVariant {
  id: string;
  productId: string;
  title: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  inventoryQuantity: number;
  weight: number | null;
  weightUnit: string | null;
  options: Record<string, string>;
}

export interface FluxitronImage {
  id: string;
  src: string;
  position: number;
  alt: string;
}

export interface FluxitronMetafield {
  key: string;
  value: string;
  namespace: string;
  type: string;
}

/**
 * Convert a Supabase product row to Fluxitron Product format.
 */
export function toFluxitronProduct(p: SupabaseProduct): FluxitronProduct {
  const title = [p.brand, p.model, p.storage_capacity].filter(Boolean).join(' ');
  const handle = p.handle || generateHandle(title);

  // Build options from grade and color
  const options: Record<string, string> = {};
  if (p.grade) options['Grade'] = p.grade;
  if (p.color) options['Couleur'] = p.color;

  // Build variant title from options
  const variantTitle = Object.values(options).join(' / ') || 'Default';

  // Map images array (stored as string URLs in Supabase)
  const images: FluxitronImage[] = (p.images || []).map((src, idx) => ({
    id: `img_${p.id}_${idx}`,
    src,
    position: idx + 1,
    alt: `${title} - Image ${idx + 1}`,
  }));

  // Build metafields for phone-specific data
  const metafields: FluxitronMetafield[] = [];
  if (p.battery_health != null) {
    metafields.push({
      key: 'battery_health',
      value: p.battery_health.toString(),
      namespace: 'custom',
      type: 'number_integer',
    });
  }
  if (p.imei) {
    metafields.push({
      key: 'imei',
      value: p.imei,
      namespace: 'custom',
      type: 'single_line_text_field',
    });
  }
  if (p.warranty) {
    metafields.push({
      key: 'warranty',
      value: p.warranty,
      namespace: 'custom',
      type: 'single_line_text_field',
    });
  }

  return {
    id: p.id,
    title,
    handle,
    description: p.condition_description || '',
    vendor: p.vendor || p.brand,
    productType: p.product_type || mapCategoryToProductType(p.category),
    status: p.is_active ? 'active' : 'draft',
    tags: p.tags || [],
    categoryId: p.category_id || null,
    images,
    variants: [
      {
        id: p.id, // 1 product = 1 variant, same ID
        productId: p.id,
        title: variantTitle,
        sku: p.sku || generateSku(p),
        price: parseFloat(p.price.toString()),
        compareAtPrice: p.compare_at_price
          ? parseFloat(p.compare_at_price.toString())
          : null,
        inventoryQuantity: p.stock,
        weight: null,
        weightUnit: null,
        options,
      },
    ],
    metafields,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

/**
 * Convert Fluxitron create/update product request to Supabase insert data.
 */
export function fromFluxitronProductCreate(body: any): Record<string, any> {
  const data: Record<string, any> = {};

  // Mark as Fluxitron product
  data.source = 'fluxitron';

  if (body.title) {
    // Try to parse brand/model from title (e.g. "Apple iPhone 15 Pro 128 Go")
    const parts = body.title.split(' ');
    data.brand = parts[0] || '';
    data.model = parts.slice(1).join(' ') || '';
  }

  if (body.description !== undefined) data.condition_description = body.description;
  if (body.vendor !== undefined) data.vendor = body.vendor;
  if (body.productType !== undefined) {
    data.product_type = body.productType;
    // Auto-map productType to category field
    const pt = (body.productType || '').toLowerCase();
    if (pt.includes('accessoire') || pt.includes('accessory') || pt.includes('cable') || pt.includes('coque') || pt.includes('case')) {
      data.category = 'accessoires';
    } else {
      data.category = 'telephones';
    }
  }
  // Fluxitron products start as draft (is_active=false) so the merchant can review before publishing
  if (body.status !== undefined) {
    data.is_active = body.status === 'active';
  } else {
    data.is_active = false;
  }
  if (body.tags !== undefined) data.tags = body.tags;
  // Prefix handle with 'flx-' to avoid UNIQUE conflicts with manual products
  if (body.handle !== undefined) data.handle = `flx-${body.handle}`;

  // Handle categoryIds (array) — take first one
  if (body.categoryIds && body.categoryIds.length > 0) {
    data.category_id = body.categoryIds[0];
  } else if (body.categoryId) {
    data.category_id = body.categoryId;
  }

  // Handle images — extract URLs
  if (body.images && Array.isArray(body.images)) {
    data.images = body.images.map((img: any) =>
      typeof img === 'string' ? img : img.src
    );
  }

  // Handle variant data (first variant)
  const variant = body.variants?.[0];
  if (variant) {
    // Prefix SKU with 'FLX-' to avoid UNIQUE conflicts with manual products
    if (variant.sku) data.sku = `FLX-${variant.sku}`;
    if (variant.price !== undefined) data.price = variant.price;
    if (variant.compareAtPrice !== undefined) data.compare_at_price = variant.compareAtPrice;
    if (variant.inventoryQuantity !== undefined) data.stock = variant.inventoryQuantity;
    if (variant.options) {
      if (variant.options.Grade) data.grade = sanitizeGrade(variant.options.Grade);
      if (variant.options.Couleur || variant.options.Color || variant.options.Couleur) {
        data.color = variant.options.Couleur || variant.options.Color;
      }
      // Stockage / Storage option → storage_capacity
      if (variant.options.Stockage || variant.options.Storage || variant.options['Capacité']) {
        data.storage_capacity = variant.options.Stockage || variant.options.Storage || variant.options['Capacité'];
      }
    }
  }

  // Handle metafields
  if (body.metafields && Array.isArray(body.metafields)) {
    for (const mf of body.metafields) {
      if (mf.key === 'battery_health') data.battery_health = parseInt(mf.value);
      if (mf.key === 'imei') data.imei = mf.value;
      if (mf.key === 'warranty') data.warranty = mf.value;
    }
  }

  return data;
}

/**
 * Convert Fluxitron update product request to Supabase update data.
 */
export function fromFluxitronProductUpdate(body: any): Record<string, any> {
  const data: Record<string, any> = {};

  if (body.title !== undefined) {
    const parts = body.title.split(' ');
    data.brand = parts[0] || '';
    data.model = parts.slice(1).join(' ') || '';
  }
  if (body.description !== undefined) data.condition_description = body.description;
  if (body.status !== undefined) data.is_active = body.status === 'active';
  if (body.tags !== undefined) data.tags = body.tags;

  if (body.categoryIds && body.categoryIds.length > 0) {
    data.category_id = body.categoryIds[0];
  }

  if (body.metafields && Array.isArray(body.metafields)) {
    for (const mf of body.metafields) {
      if (mf.key === 'battery_health') data.battery_health = parseInt(mf.value);
      if (mf.key === 'imei') data.imei = mf.value;
      if (mf.key === 'warranty') data.warranty = mf.value;
    }
  }

  // Sanitize grade on updates too
  const updateVariant = body.variants?.[0];
  if (updateVariant?.options?.Grade) {
    data.grade = sanitizeGrade(updateVariant.options.Grade);
  }

  return data;
}

// ── Order Mappers ────────────────────────────────────────────────────────────

export interface SupabaseOrder {
  id: string;
  user_id: string;
  stripe_session_id?: string;
  stripe_payment_intent?: string;
  total_amount: number;
  status: string;
  fulfillment_status?: string;
  order_number?: string;
  shipping_method?: string;
  shipping_address?: any;
  tracking_number?: string;
  referral_code_used?: string;
  discount_amount?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  profile?: { email?: string; full_name?: string; phone?: string };
}

export interface SupabaseOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_purchase: number;
  product?: {
    brand?: string;
    model?: string;
    sku?: string;
    images?: string[];
  };
}

export interface FluxitronOrder {
  id: string;
  orderNumber: string;
  email: string | null;
  phone: string | null;
  financialStatus: string;
  fulfillmentStatus: string;
  currency: string;
  subtotalPrice: number;
  totalShippingPrice: number;
  totalPrice: number;
  lineItems: FluxitronLineItem[];
  shippingAddress: FluxitronAddress | null;
  billingAddress: FluxitronAddress | null;
  createdAt: string;
}

export interface FluxitronLineItem {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  quantity: number;
  price: number;
}

export interface FluxitronAddress {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  countryCode: string | null;
  zip: string | null;
  phone: string | null;
}

/**
 * Map Supabase order status to Fluxitron financialStatus.
 */
function mapFinancialStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'pending',
    awaiting_payment: 'pending',
    paid: 'paid',
    shipped: 'paid',
    delivered: 'paid',
    failed: 'voided',
    refunded: 'refunded',
    disputed: 'paid', // Financially still charged until resolved
    cancelled: 'voided',
  };
  return map[status] || 'pending';
}

/**
 * Convert a Supabase order + items to Fluxitron Order format.
 */
export function toFluxitronOrder(
  order: SupabaseOrder,
  items: SupabaseOrderItem[] = []
): FluxitronOrder {
  // Parse shipping address from JSONB
  const addr = order.shipping_address;
  let shippingAddress: FluxitronAddress | null = null;

  if (addr && typeof addr === 'object') {
    shippingAddress = {
      firstName: addr.firstName || addr.first_name || addr.full_name?.split(' ')[0] || null,
      lastName: addr.lastName || addr.last_name || addr.full_name?.split(' ').slice(1).join(' ') || null,
      company: addr.company || null,
      address1: addr.address1 || addr.street || null,
      address2: addr.address2 || null,
      city: addr.city || null,
      province: addr.province || addr.region || null,
      country: addr.country || 'France',
      countryCode: addr.countryCode || addr.country_code || 'FR',
      zip: addr.zip || addr.postal_code || null,
      phone: addr.phone || null,
    };
  }

  // Map line items
  const lineItems: FluxitronLineItem[] = items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    variantId: item.product_id, // 1 product = 1 variant
    sku: item.product?.sku || '',
    title: [item.product?.brand, item.product?.model].filter(Boolean).join(' ') || 'Produit',
    quantity: item.quantity,
    price: parseFloat(item.price_at_purchase.toString()),
  }));

  // Calculate subtotal from items
  const subtotalPrice = lineItems.reduce((sum, li) => sum + li.price * li.quantity, 0);
  const totalPrice = parseFloat(order.total_amount.toString());
  const totalShippingPrice = Math.max(0, totalPrice - subtotalPrice + (order.discount_amount || 0));

  return {
    id: order.id,
    orderNumber: order.order_number || `TC-${order.id.slice(0, 8).toUpperCase()}`,
    email: order.profile?.email || null,
    phone: order.profile?.phone || null,
    financialStatus: mapFinancialStatus(order.status),
    fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
    currency: 'EUR',
    subtotalPrice,
    totalShippingPrice,
    totalPrice,
    lineItems,
    shippingAddress,
    billingAddress: shippingAddress, // Same as shipping for now
    createdAt: order.created_at,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Map any grade label from Foxway/Fluxitron to the store grade set.
// Returns null if unrecognizable (nullable column — safe to store).
export function sanitizeGrade(raw: string): 'Parfait État' | 'Très Bon État' | 'État Correct' | null {
  if (!raw) return null;
  const g = raw.toUpperCase().trim();
  if (['A', 'A+', 'GRADE A', 'EXCELLENT', 'LIKE NEW', 'PARFAIT', 'PARFAIT ÉTAT', 'PARFAIT ETAT'].includes(g) || g.startsWith('A+') || g.startsWith('A ')) return 'Parfait État';
  if (['B', 'B+', 'GRADE B', 'TRÈS BON', 'TRES BON', 'VERY GOOD', 'GOOD', 'BON ÉTAT', 'BON ETAT', 'TRÈS BON ÉTAT', 'TRES BON ETAT'].includes(g) || g.startsWith('B')) return 'Très Bon État';
  if (['C', 'GRADE C', 'ACCEPTABLE', 'FAIR', 'CORRECT', 'ÉTAT CORRECT', 'ETAT CORRECT'].includes(g) || g.startsWith('C')) return 'État Correct';
  return null;
}

function generateHandle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function generateSku(p: SupabaseProduct): string {
  return [p.brand, p.model, p.storage_capacity, p.grade || 'STD']
    .filter(Boolean)
    .join('-')
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function mapCategoryToProductType(category: string): string {
  const map: Record<string, string> = {
    telephones: 'Smartphone',
    accessoires: 'Accessoire',
  };
  return map[category] || 'Other';
}
