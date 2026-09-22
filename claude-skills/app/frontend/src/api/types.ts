// Response types of the API (doc/詳細設計/ecsite-API設計書.md).

export interface Me {
  id: number
  name: string
  email: string
  cartQuantity: number
}

export interface Category {
  id: number
  name: string
}

export interface ProductSummary {
  id: number
  name: string
  price: number
  imageUrl: string | null
  inStock: boolean
}

export interface ProductPage {
  items: ProductSummary[]
  totalCount: number
  page: number
  totalPages: number
}

export interface ProductDetail {
  id: number
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  categoryName: string
  inStock: boolean
  maxQuantity: number
}

export type CartProblem = 'UNPUBLISHED' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK'

export interface CartItem {
  cartItemId: number
  productId: number
  productName: string
  imageUrl: string | null
  unitPrice: number
  quantity: number
  subtotal: number
  published: boolean
  problem: CartProblem | null
  stockQuantity: number | null
}

export interface Cart {
  items: CartItem[]
  totalQuantity: number
  subtotalAmount: number
  purchasable: boolean
}

export interface LineItem {
  productName: string
  unitPrice: number
  quantity: number
  subtotal: number
}

export interface ShippingAddress {
  recipientName: string
  postalCode: string
  prefecture: string
  city: string
  addressLine: string
  building: string | null
  phoneNumber: string
}

export interface Address extends ShippingAddress {
  id: number
  isDefault: boolean
}

export interface Checkout {
  items: LineItem[]
  subtotalAmount: number
  shippingFee: number
  totalAmount: number
  addresses: Address[]
  prefectures: string[]
}

export type PaymentMethod = 'CREDIT_CARD' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY'

export interface Order {
  orderNumber: string
  orderedAt: string
  paymentMethod: PaymentMethod
  shipping: ShippingAddress
  items: LineItem[]
  subtotalAmount: number
  shippingFee: number
  totalAmount: number
}
