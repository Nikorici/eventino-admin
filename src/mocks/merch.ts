import type {
  MerchFulfillmentStatus,
  MerchOrder,
  MerchProductDetail,
  MerchProductImage,
  MerchProductListItem,
  MerchProductVariant,
  MerchSettings,
} from '@/store/api/merchApi';

import { findMockEvent } from './core';
import { bodyOf, mock, mockError, type MockHandler } from './mock';

const PHOTO = {
  teeFront: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
  teeBack: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&q=80',
  teeFolded: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&q=80',
  hoodie: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80',
  cap: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&q=80',
  upload: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80',
};

const NOW = Date.now();
const HOUR = 3_600_000;

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * HOUR).toISOString();
}

let nextId = 9000;
function newId(): number {
  nextId += 1;
  return nextId;
}

function variant(
  id: number,
  product: number,
  name: string,
  sku: string,
  price: string | null,
  stock: number,
  basePrice: string,
  isActive = true,
): MerchProductVariant {
  return {
    id,
    product,
    name,
    sku,
    price,
    effective_price: price ?? basePrice,
    stock,
    attributes: {},
    is_active: isActive,
    display_order: id,
  };
}

function image(id: number, url: string, order: number, isMain: boolean): MerchProductImage {
  return { id, image: url, alt_text: '', display_order: order, is_main: isMain };
}

function product(
  id: number,
  name: string,
  slug: string,
  basePrice: string,
  description: string,
  variants: MerchProductVariant[],
  images: MerchProductImage[],
  isActive = true,
): MerchProductDetail {
  return {
    id,
    event: 4101,
    name,
    slug,
    description,
    base_price: basePrice,
    is_active: isActive,
    is_archived: false,
    display_order: id,
    variants,
    images,
    min_price: basePrice,
    max_price: basePrice,
    created_at: hoursAgo(24 * 30),
    updated_at: hoursAgo(24 * 2),
  };
}

const products: MerchProductDetail[] = [
  product(
    701,
    'Festival T-shirt',
    'festival-t-shirt',
    '290.00',
    'Soft organic cotton tee with the autumn edition grape-leaf print on the front and the festival dates on the back.',
    [
      variant(7011, 701, 'S', 'TSH-S', null, 24, '290.00'),
      variant(7012, 701, 'M', 'TSH-M', null, 31, '290.00'),
      variant(7013, 701, 'L', 'TSH-L', null, 18, '290.00'),
      variant(7014, 701, 'XL', 'TSH-XL', '310.00', 6, '290.00'),
      variant(7015, 701, 'XXL', 'TSH-XXL', '310.00', 0, '290.00', false),
    ],
    [image(7101, PHOTO.teeFront, 1, true), image(7102, PHOTO.teeBack, 2, false), image(7103, PHOTO.teeFolded, 3, false)],
  ),
  product(
    702,
    'Autumn Edition Hoodie',
    'autumn-edition-hoodie',
    '650.00',
    'Heavyweight burgundy hoodie with an embroidered festival logo and a kangaroo pocket.',
    [
      variant(7021, 702, 'S', 'HOD-S', null, 9, '650.00'),
      variant(7022, 702, 'M', 'HOD-M', null, 14, '650.00'),
      variant(7023, 702, 'L', 'HOD-L', null, 11, '650.00'),
      variant(7024, 702, 'XL', 'HOD-XL', '690.00', 4, '650.00'),
    ],
    [image(7104, PHOTO.hoodie, 1, true)],
  ),
  product(
    703,
    'Wine Lover Tote Bag',
    'wine-lover-tote-bag',
    '180.00',
    'Natural canvas tote with a reinforced bottom, big enough for two bottles and a festival glass.',
    [variant(7031, 703, 'One size', 'TOTE-01', null, 52, '180.00')],
    [],
  ),
  product(
    704,
    'Embroidered Cap',
    'embroidered-cap',
    '220.00',
    'Six-panel cotton cap with an adjustable strap and a grape-leaf embroidery.',
    [variant(7041, 704, 'One size', 'CAP-01', null, 0, '220.00')],
    [image(7106, PHOTO.cap, 1, true)],
  ),
  product(
    705,
    'Festival Poster 50×70',
    'festival-poster-50x70',
    '150.00',
    'Limited risograph print of the official poster, signed by the illustrator.',
    [variant(7051, 705, '50×70 cm', 'PST-5070', null, 40, '150.00')],
    [],
    false,
  ),
];

const settingsByEvent: Record<number, MerchSettings> = {
  4101: {
    is_store_enabled: true,
    shipping_fee: '40.00',
    currency: 'MDL',
    store_intro: 'Official merch of the autumn edition. Every order ships within 3 working days, anywhere in Moldova.',
  },
};

function settingsFor(eventId: number): MerchSettings {
  const existing = settingsByEvent[eventId];
  if (existing) return existing;
  const created: MerchSettings = {
    is_store_enabled: false,
    shipping_fee: '0.00',
    currency: findMockEvent(eventId)?.currency ?? 'MDL',
    store_intro: '',
  };
  settingsByEvent[eventId] = created;
  return created;
}

const CHISINAU_ADDRESSES = [
  { street: 'str. Ismail 88, ap. 14', city: 'Chișinău', postal_code: 'MD-2012' },
  { street: 'bd. Dacia 27, ap. 51', city: 'Chișinău', postal_code: 'MD-2060' },
  { street: 'str. Mihai Eminescu 3', city: 'Bălți', postal_code: 'MD-3100' },
  { street: 'str. Columna 112, ap. 8', city: 'Chișinău', postal_code: 'MD-2004' },
];

interface OrderSeed {
  id: number;
  name: string;
  phone: string;
  hours: number;
  payment: MerchOrder['payment_status'];
  fulfillment: MerchFulfillmentStatus;
  serial: string | null;
  lines: [number, number][];
}

const ORDER_SEEDS: OrderSeed[] = [
  { id: 1048, name: 'Ana Popescu', phone: '+373 69 412 873', hours: 2, payment: 'PAID', fulfillment: 'NEW', serial: 'SE-M-0034', lines: [[7022, 1], [7011, 1]] },
  { id: 1047, name: 'Ion Rusu', phone: '+373 78 220 145', hours: 5, payment: 'PENDING', fulfillment: 'NEW', serial: null, lines: [[7022, 1]] },
  { id: 1046, name: 'Maria Ciobanu', phone: '+373 60 115 902', hours: 7, payment: 'PAID', fulfillment: 'PROCESSING', serial: 'SE-M-0033', lines: [[7012, 2], [7031, 1]] },
  { id: 1045, name: 'Andrei Lungu', phone: '+373 69 874 310', hours: 19, payment: 'FAILED', fulfillment: 'NEW', serial: null, lines: [[7012, 1]] },
  { id: 1044, name: 'Elena Cojocaru', phone: '+373 79 553 018', hours: 22, payment: 'PAID', fulfillment: 'SHIPPED', serial: 'SE-M-0032', lines: [[7023, 1], [7041, 1]] },
  { id: 1043, name: 'Victor Munteanu', phone: '+373 68 301 774', hours: 27, payment: 'PAID', fulfillment: 'DELIVERED', serial: 'SE-M-0031', lines: [[7031, 1], [7013, 1]] },
  { id: 1042, name: 'Cristina Botnaru', phone: '+373 60 902 337', hours: 52, payment: 'REFUNDED', fulfillment: 'CANCELLED', serial: 'SE-M-0030', lines: [[7041, 1]] },
  { id: 1041, name: 'Mihai Ceban', phone: '+373 69 640 221', hours: 56, payment: 'PAID', fulfillment: 'DELIVERED', serial: 'SE-M-0029', lines: [[7024, 1], [7011, 1]] },
];

function findVariant(variantId: number): { product: MerchProductDetail; variant: MerchProductVariant } | null {
  for (const item of products) {
    const found = item.variants.find((entry) => entry.id === variantId);
    if (found) return { product: item, variant: found };
  }
  return null;
}

function money(value: number): string {
  return value.toFixed(2);
}

function buildOrder(seed: OrderSeed, index: number): MerchOrder {
  const items = seed.lines.map(([variantId, quantity], lineIndex) => {
    const found = findVariant(variantId);
    const unit = Number(found?.variant.effective_price ?? 0);
    return {
      id: seed.id * 10 + lineIndex,
      product_variant: variantId,
      product_name_snapshot: found?.product.name ?? '',
      variant_name_snapshot: found?.variant.name ?? '',
      unit_price_snapshot: money(unit),
      quantity,
      line_total: money(unit * quantity),
    };
  });
  const subtotal = items.reduce((sum, item) => sum + Number(item.line_total), 0);
  const shipping = 40;
  const address = CHISINAU_ADDRESSES[index % CHISINAU_ADDRESSES.length];
  const email = `${seed.name.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;
  const createdAt = hoursAgo(seed.hours);
  return {
    id: seed.id,
    order_number: `3f9c2a71-8b4e-4d2a-9c1e-${String(seed.id).padStart(12, '0')}`,
    event: 4101,
    customer_email: email,
    customer_phone: seed.phone,
    customer_name: seed.name,
    shipping_address: {
      recipient_name: seed.name,
      street: address.street,
      city: address.city,
      region: '',
      postal_code: address.postal_code,
      country: 'Moldova',
      phone: seed.phone,
    },
    subtotal: money(subtotal),
    shipping_fee: money(shipping),
    total: money(subtotal + shipping),
    currency: 'MDL',
    payment_status: seed.payment,
    fulfillment_status: seed.fulfillment,
    shipped_at: seed.fulfillment === 'SHIPPED' || seed.fulfillment === 'DELIVERED' ? hoursAgo(seed.hours - 6) : null,
    delivered_at: seed.fulfillment === 'DELIVERED' ? hoursAgo(seed.hours - 20) : null,
    payment_method: 'MAIB',
    created_at: createdAt,
    items,
    invoice_serial: seed.serial,
  };
}

const orders: MerchOrder[] = ORDER_SEEDS.map(buildOrder);

function withPriceRange(item: MerchProductDetail): MerchProductDetail {
  const prices = item.variants.filter((entry) => entry.is_active).map((entry) => Number(entry.effective_price));
  const base = Number(item.base_price);
  return {
    ...item,
    min_price: money(prices.length ? Math.min(...prices) : base),
    max_price: money(prices.length ? Math.max(...prices) : base),
  };
}

function toListItem(item: MerchProductDetail): MerchProductListItem {
  const detail = withPriceRange(item);
  return {
    id: detail.id,
    name: detail.name,
    slug: detail.slug,
    base_price: detail.base_price,
    is_active: detail.is_active,
    is_archived: detail.is_archived,
    display_order: detail.display_order,
    main_image: detail.images.find((entry) => entry.is_main) ?? null,
    min_price: detail.min_price,
    in_stock: detail.variants.some((entry) => entry.is_active && entry.stock > 0),
  };
}

function findProduct(productId: string): MerchProductDetail | undefined {
  return products.find((item) => item.id === Number(productId));
}

function findOrder(orderId: string): MerchOrder | undefined {
  return orders.find((order) => order.id === Number(orderId));
}

interface FormLike {
  get?: (key: string) => unknown;
  getParts?: () => { fieldName: string; string?: string }[];
}

function formField(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return '';
  const form: FormLike = body;
  if (typeof form.get === 'function') return String(form.get(key) ?? '');
  if (typeof form.getParts === 'function') return form.getParts().find((part) => part.fieldName === key)?.string ?? '';
  return '';
}

function refreshEffectivePrices(item: MerchProductDetail): void {
  item.variants.forEach((entry) => {
    entry.effective_price = entry.price ?? item.base_price;
  });
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/merch/events/:eventId/settings/', ({ params }) => settingsFor(Number(params.eventId))),
  mock('PATCH', '/api/v1/merch/events/:eventId/settings/', (request) => {
    const current = settingsFor(Number(request.params.eventId));
    Object.assign(current, bodyOf<MerchSettings>(request));
    return current;
  }),

  mock('GET', '/api/v1/merch/events/:eventId/products/', ({ params }) =>
    products
      .filter((item) => item.event === Number(params.eventId) && !item.is_archived)
      .map(toListItem),
  ),
  mock('POST', '/api/v1/merch/products/', (request) => {
    const body = bodyOf<MerchProductDetail>(request);
    if (products.some((item) => item.slug === body.slug)) {
      return mockError(400, { slug: ['Product with this slug already exists.'] });
    }
    const created: MerchProductDetail = {
      ...product(newId(), body.name ?? '', body.slug ?? '', body.base_price ?? '0.00', body.description ?? '', [], [], body.is_active ?? false),
      event: Number(body.event ?? 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    products.push(created);
    return withPriceRange(created);
  }),
  mock('GET', '/api/v1/merch/products/:id/', ({ params }) => {
    const found = findProduct(params.id);
    return found ? withPriceRange(found) : mockError(404, { detail: 'Not found.' });
  }),
  mock('PATCH', '/api/v1/merch/products/:id/', (request) => {
    const found = findProduct(request.params.id);
    if (!found) return mockError(404, { detail: 'Not found.' });
    Object.assign(found, bodyOf<MerchProductDetail>(request), { updated_at: new Date().toISOString() });
    refreshEffectivePrices(found);
    return withPriceRange(found);
  }),
  mock('DELETE', '/api/v1/merch/products/:id/', ({ params }) => {
    const found = findProduct(params.id);
    if (!found) return mockError(404, { detail: 'Not found.' });
    found.is_archived = true;
    found.is_active = false;
    return {};
  }),

  mock('POST', '/api/v1/merch/variants/', (request) => {
    const body = bodyOf<MerchProductVariant>(request);
    const owner = products.find((item) => item.id === Number(body.product));
    if (!owner) return mockError(400, { product: ['Invalid product.'] });
    const created = variant(
      newId(),
      owner.id,
      body.name ?? '',
      body.sku ?? '',
      body.price ?? null,
      Number(body.stock ?? 0),
      owner.base_price,
      body.is_active ?? true,
    );
    owner.variants.push(created);
    return created;
  }),
  mock('PATCH', '/api/v1/merch/variants/:id/', (request) => {
    const found = findVariant(Number(request.params.id));
    if (!found) return mockError(404, { detail: 'Not found.' });
    Object.assign(found.variant, bodyOf<MerchProductVariant>(request));
    found.variant.effective_price = found.variant.price ?? found.product.base_price;
    return found.variant;
  }),
  mock('DELETE', '/api/v1/merch/variants/:id/', ({ params }) => {
    const found = findVariant(Number(params.id));
    if (!found) return mockError(404, { detail: 'Not found.' });
    found.product.variants = found.product.variants.filter((entry) => entry.id !== found.variant.id);
    return {};
  }),

  mock('POST', '/api/v1/merch/images/', ({ body }) => {
    const owner = products.find((item) => item.id === Number(formField(body, 'product')));
    if (!owner) return mockError(400, { product: ['Invalid product.'] });
    const created = image(newId(), PHOTO.upload, owner.images.length + 1, owner.images.length === 0);
    owner.images.push(created);
    return created;
  }),
  mock('PATCH', '/api/v1/merch/images/:id/', (request) => {
    const imageId = Number(request.params.id);
    const owner = products.find((item) => item.images.some((entry) => entry.id === imageId));
    if (!owner) return mockError(404, { detail: 'Not found.' });
    const body = bodyOf<MerchProductImage>(request);
    if (body.is_main) owner.images.forEach((entry) => (entry.is_main = entry.id === imageId));
    return owner.images.find((entry) => entry.id === imageId);
  }),
  mock('DELETE', '/api/v1/merch/images/:id/', ({ params }) => {
    const imageId = Number(params.id);
    const owner = products.find((item) => item.images.some((entry) => entry.id === imageId));
    if (!owner) return mockError(404, { detail: 'Not found.' });
    owner.images = owner.images.filter((entry) => entry.id !== imageId);
    return {};
  }),

  mock('GET', '/api/v1/merch/events/:eventId/orders/', ({ params, query }) =>
    orders.filter(
      (order) => order.event === Number(params.eventId) && (!query.status || order.payment_status === query.status),
    ),
  ),
  mock('GET', '/api/v1/merch/orders/:id/', ({ params }) => findOrder(params.id) ?? mockError(404, { detail: 'Not found.' })),
  mock('PATCH', '/api/v1/merch/orders/:id/fulfillment/', (request) => {
    const found = findOrder(request.params.id);
    if (!found) return mockError(404, { detail: 'Not found.' });
    const next = bodyOf<MerchOrder>(request).fulfillment_status ?? found.fulfillment_status;
    found.fulfillment_status = next;
    if (next === 'SHIPPED' && !found.shipped_at) found.shipped_at = new Date().toISOString();
    if (next === 'DELIVERED') {
      found.shipped_at = found.shipped_at ?? new Date().toISOString();
      found.delivered_at = new Date().toISOString();
    }
    return found;
  }),
  mock('POST', '/api/v1/merch/orders/:id/refund/', ({ params }) => {
    const found = findOrder(params.id);
    if (!found) return mockError(404, { detail: 'Not found.' });
    if (found.payment_status !== 'PAID') return mockError(400, { detail: 'Only paid orders can be refunded.' });
    found.payment_status = 'REFUNDED';
    found.fulfillment_status = 'CANCELLED';
    return found;
  }),
];
