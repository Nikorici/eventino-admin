import { baseApi } from './baseApi';

const merchEndpoints = {
  productsByEvent: (eventId: number) => `/api/v1/merch/events/${eventId}/products/`,
  productsBase: '/api/v1/merch/products/',
  product: (productId: number) => `/api/v1/merch/products/${productId}/`,
  variantsBase: '/api/v1/merch/variants/',
  variant: (variantId: number) => `/api/v1/merch/variants/${variantId}/`,
  settings: (eventId: number) => `/api/v1/merch/events/${eventId}/settings/`,
  ordersByEvent: (eventId: number) => `/api/v1/merch/events/${eventId}/orders/`,
  orderFulfillment: (orderId: number) => `/api/v1/merch/orders/${orderId}/fulfillment/`,
  orderRefund: (orderId: number) => `/api/v1/merch/orders/${orderId}/refund/`,
} as const;

export const MERCH_CURRENCIES = ['MDL', 'USD', 'EUR', 'RON'] as const;
export type MerchCurrency = (typeof MERCH_CURRENCIES)[number];

export const MERCH_PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type MerchPaymentStatus = (typeof MERCH_PAYMENT_STATUSES)[number];

export const MERCH_FULFILLMENT_STATUSES = ['NEW', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
export type MerchFulfillmentStatus = (typeof MERCH_FULFILLMENT_STATUSES)[number];

export interface MerchSettings {
  is_store_enabled: boolean;
  shipping_fee: string;
  currency: string;
  store_intro: string;
}

export interface MerchProductImage {
  id: number;
  image: string;
  alt_text: string;
  display_order: number;
  is_main: boolean;
}

export interface MerchProductListItem {
  id: number;
  name: string;
  slug: string;
  base_price: string;
  is_active: boolean;
  is_archived: boolean;
  display_order: number;
  main_image: MerchProductImage | null;
  min_price: string;
  in_stock: boolean;
}

export interface MerchProductVariant {
  id: number;
  product: number;
  name: string;
  sku: string;
  price: string | null;
  effective_price: string;
  stock: number;
  attributes: Record<string, unknown>;
  is_active: boolean;
  display_order: number;
}

export interface MerchProductDetail {
  id: number;
  event: number;
  name: string;
  slug: string;
  description: string;
  base_price: string;
  is_active: boolean;
  is_archived: boolean;
  display_order: number;
  variants: MerchProductVariant[];
  images: MerchProductImage[];
  min_price: string;
  max_price: string;
  created_at: string;
  updated_at: string;
}

export interface MerchOrderItem {
  id: number;
  product_variant: number | null;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  unit_price_snapshot: string;
  quantity: number;
  line_total: string;
}

export interface MerchShippingAddress {
  recipient_name: string;
  street: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  phone: string;
}

export interface MerchOrder {
  id: number;
  order_number: string;
  event: number;
  customer_email: string;
  customer_phone: string;
  customer_name: string;
  shipping_address: MerchShippingAddress | null;
  subtotal: string;
  shipping_fee: string;
  total: string;
  currency: string;
  payment_status: MerchPaymentStatus;
  fulfillment_status: MerchFulfillmentStatus;
  shipped_at: string | null;
  delivered_at: string | null;
  payment_method: string;
  created_at: string;
  items: MerchOrderItem[];
}

export type MerchSettingsPatch = Partial<MerchSettings>;

export interface UpdateMerchSettingsBody {
  eventId: number;
  patch: MerchSettingsPatch;
}

export interface CreateMerchProductBody {
  event: number;
  name: string;
  slug: string;
  base_price: string;
  description: string;
  is_active: boolean;
}

export type MerchProductPatch = Partial<Pick<MerchProductDetail, 'name' | 'slug' | 'description' | 'base_price' | 'is_active'>>;

export interface UpdateMerchProductBody {
  productId: number;
  patch: MerchProductPatch;
}

export interface CreateMerchVariantBody {
  product: number;
  name: string;
  sku: string;
  price: string | null;
  stock: number;
  is_active: boolean;
}

export type MerchVariantPatch = Partial<Pick<MerchProductVariant, 'name' | 'sku' | 'price' | 'stock' | 'is_active'>>;

export interface UpdateMerchVariantBody {
  variantId: number;
  patch: MerchVariantPatch;
}

export interface UpdateMerchFulfillmentBody {
  orderId: number;
  fulfillment_status: MerchFulfillmentStatus;
}

function toProductList(
  response: MerchProductListItem[] | { results?: MerchProductListItem[] },
): MerchProductListItem[] {
  return Array.isArray(response) ? response : (response?.results ?? []);
}

function toOrderList(response: MerchOrder[] | { results?: MerchOrder[] }): MerchOrder[] {
  return Array.isArray(response) ? response : (response?.results ?? []);
}

export const merchApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['MerchSettings', 'MerchProducts', 'MerchProduct', 'MerchOrders'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getMerchSettings: builder.query<MerchSettings, number>({
        query: (eventId) => merchEndpoints.settings(eventId),
        providesTags: (_result, _error, eventId) => [{ type: 'MerchSettings', id: eventId }],
      }),
      updateMerchSettings: builder.mutation<MerchSettings, UpdateMerchSettingsBody>({
        query: ({ eventId, patch }) => ({
          url: merchEndpoints.settings(eventId),
          method: 'PATCH',
          body: patch,
        }),
        invalidatesTags: (_result, _error, { eventId }) => [{ type: 'MerchSettings', id: eventId }],
      }),
      getMerchProducts: builder.query<MerchProductListItem[], number>({
        query: (eventId) => merchEndpoints.productsByEvent(eventId),
        transformResponse: toProductList,
        providesTags: ['MerchProducts'],
      }),
      getMerchProduct: builder.query<MerchProductDetail, number>({
        query: (productId) => merchEndpoints.product(productId),
        providesTags: (_result, _error, productId) => [{ type: 'MerchProduct', id: productId }],
      }),
      createMerchProduct: builder.mutation<MerchProductDetail, CreateMerchProductBody>({
        query: (body) => ({
          url: merchEndpoints.productsBase,
          method: 'POST',
          body,
        }),
        invalidatesTags: ['MerchProducts'],
      }),
      updateMerchProduct: builder.mutation<MerchProductDetail, UpdateMerchProductBody>({
        query: ({ productId, patch }) => ({
          url: merchEndpoints.product(productId),
          method: 'PATCH',
          body: patch,
        }),
        invalidatesTags: (_result, _error, { productId }) => ['MerchProducts', { type: 'MerchProduct', id: productId }],
      }),
      archiveMerchProduct: builder.mutation<void, number>({
        query: (productId) => ({
          url: merchEndpoints.product(productId),
          method: 'DELETE',
        }),
        invalidatesTags: ['MerchProducts'],
      }),
      createMerchVariant: builder.mutation<MerchProductVariant, CreateMerchVariantBody>({
        query: (body) => ({
          url: merchEndpoints.variantsBase,
          method: 'POST',
          body,
        }),
        invalidatesTags: (_result, _error, { product }) => ['MerchProducts', { type: 'MerchProduct', id: product }],
      }),
      updateMerchVariant: builder.mutation<MerchProductVariant, UpdateMerchVariantBody>({
        query: ({ variantId, patch }) => ({
          url: merchEndpoints.variant(variantId),
          method: 'PATCH',
          body: patch,
        }),
        invalidatesTags: (result) =>
          result ? ['MerchProducts', { type: 'MerchProduct', id: result.product }] : ['MerchProducts', 'MerchProduct'],
      }),
      deleteMerchVariant: builder.mutation<void, number>({
        query: (variantId) => ({
          url: merchEndpoints.variant(variantId),
          method: 'DELETE',
        }),
        invalidatesTags: ['MerchProducts', 'MerchProduct'],
      }),
      getMerchOrders: builder.query<MerchOrder[], number>({
        query: (eventId) => merchEndpoints.ordersByEvent(eventId),
        transformResponse: toOrderList,
        providesTags: ['MerchOrders'],
      }),
      updateMerchFulfillment: builder.mutation<MerchOrder, UpdateMerchFulfillmentBody>({
        query: ({ orderId, fulfillment_status }) => ({
          url: merchEndpoints.orderFulfillment(orderId),
          method: 'PATCH',
          body: { fulfillment_status },
        }),
        invalidatesTags: ['MerchOrders'],
      }),
      refundMerchOrder: builder.mutation<MerchOrder, number>({
        query: (orderId) => ({
          url: merchEndpoints.orderRefund(orderId),
          method: 'POST',
        }),
        invalidatesTags: ['MerchOrders'],
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetMerchSettingsQuery,
  useUpdateMerchSettingsMutation,
  useGetMerchProductsQuery,
  useGetMerchProductQuery,
  useCreateMerchProductMutation,
  useUpdateMerchProductMutation,
  useArchiveMerchProductMutation,
  useCreateMerchVariantMutation,
  useUpdateMerchVariantMutation,
  useDeleteMerchVariantMutation,
  useGetMerchOrdersQuery,
  useUpdateMerchFulfillmentMutation,
  useRefundMerchOrderMutation,
} = merchApi;
