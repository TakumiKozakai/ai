// Display formats (common spec 5.2).
import type { PaymentMethod, ShippingAddress } from '../api/types'

export const NO_IMAGE = '/images/no-image.png'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CREDIT_CARD: 'クレジットカード',
  BANK_TRANSFER: '銀行振込',
  CASH_ON_DELIVERY: '代金引換',
}

export function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

const dateTimeFormat = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** yyyy/MM/dd HH:mm */
export function dateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso))
}

/** 〒123-4567 */
export function postalCode(code: string): string {
  return `〒${code.slice(0, 3)}-${code.slice(3)}`
}

/** {宛名} 〒{郵便番号} {都道府県}{市区町村}{町名・番地} {建物名} TEL {電話番号} */
export function addressLabel(a: ShippingAddress): string {
  return [
    a.recipientName,
    postalCode(a.postalCode),
    `${a.prefecture}${a.city}${a.addressLine}`,
    a.building ?? '',
    `TEL ${a.phoneNumber}`,
  ]
    .filter((part) => part !== '')
    .join(' ')
}
