/**
 * Amount in words for receipts (Arabic + French), 0 – 999,999,999.
 * Pure + tested.
 */

const AR_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"]
const AR_TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"]
const AR_TEENS: Record<number, string> = {
  11: "أحد عشر", 12: "اثنا عشر", 13: "ثلاثة عشر", 14: "أربعة عشر", 15: "خمسة عشر",
  16: "ستة عشر", 17: "سبعة عشر", 18: "ثمانية عشر", 19: "تسعة عشر",
}

function arUnderHundred(n: number): string {
  if (n === 0) return ""
  if (n === 10) return AR_TENS[1]
  if (n < 10) return AR_ONES[n]
  if (n < 20) return AR_TEENS[n]
  const ten = Math.floor(n / 10)
  const one = n % 10
  return one === 0 ? AR_TENS[ten] : `${AR_ONES[one]} و${AR_TENS[ten]}`
}

function arUnderThousand(n: number): string {
  if (n === 0) return ""
  const hundred = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundred > 0) {
    if (hundred === 1) parts.push("مائة")
    else if (hundred === 2) parts.push("مائتان")
    else if (hundred === 5) parts.push("خمسمائة")
    else parts.push(`${AR_ONES[hundred]}مائة`)
  }
  if (rest > 0) parts.push(arUnderHundred(rest))
  return parts.join(" و")
}

function arScale(value: number, one: string, two: string, few: string, many: string): string {
  if (value === 1) return one
  if (value === 2) return two
  if (value <= 10) return `${arUnderThousand(value)} ${few}`
  return `${arUnderThousand(value)} ${many}`
}

export function amountInWordsAr(amount: number): string {
  const n = Math.floor(Math.abs(amount))
  if (n === 0) return "صفر أوقية"
  const parts: string[] = []
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  if (millions > 0) parts.push(arScale(millions, "مليون", "مليونان", "ملايين", "مليونًا"))
  if (thousands > 0) parts.push(thousands === 1 ? "ألف" : thousands === 2 ? "ألفان" : `${arUnderThousand(thousands)} آلاف`)
  if (rest > 0) parts.push(arUnderThousand(rest))
  return `${parts.join(" و")} أوقية`
}

const FR_ONES = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"]
const FR_TEENS = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"]

function frUnderHundred(n: number): string {
  if (n === 0) return ""
  if (n < 10) return FR_ONES[n]
  if (n < 20) return FR_TEENS[n - 10]
  if (n < 70) {
    const ten = Math.floor(n / 10)
    const one = n % 10
    const bases = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"]
    if (one === 0) return bases[ten]
    if (one === 1 && ten !== 8) return `${bases[ten]} et un`
    return `${bases[ten]}-${FR_ONES[one]}`
  }
  if (n < 80) return `soixante-${frUnderHundred(n - 60)}`
  if (n === 80) return "quatre-vingts"
  return `quatre-vingt-${FR_ONES[n - 80] || ""}`.replace(/-$/, "")
}

function frUnderThousand(n: number): string {
  if (n === 0) return ""
  const hundred = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundred > 0) {
    parts.push(hundred === 1 ? (rest === 0 ? "cent" : "cent") : rest === 0 ? `${FR_ONES[hundred]} cents` : `${FR_ONES[hundred]} cent`)
  }
  if (rest > 0) parts.push(frUnderHundred(rest))
  return parts.join(" ")
}

export function amountInWordsFr(amount: number): string {
  const n = Math.floor(Math.abs(amount))
  if (n === 0) return "zéro ouguiya"
  const parts: string[] = []
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  if (millions > 0) parts.push(millions === 1 ? "un million" : `${frUnderThousand(millions)} millions`)
  if (thousands > 0) parts.push(thousands === 1 ? "mille" : `${frUnderThousand(thousands)} mille`)
  if (rest > 0) parts.push(frUnderThousand(rest))
  return `${parts.join(" ")} ouguiyas`
}
