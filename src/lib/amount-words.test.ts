import { describe, expect, it } from "vitest"
import { amountInWordsAr, amountInWordsFr } from "./amount-words"

describe("amountInWordsAr", () => {
  it("writes small amounts", () => {
    expect(amountInWordsAr(0)).toBe("صفر أوقية")
    expect(amountInWordsAr(1)).toContain("واحد")
    expect(amountInWordsAr(12)).toContain("اثنا عشر")
    expect(amountInWordsAr(25)).toBe("خمسة وعشرون أوقية")
  })

  it("writes thousands (receipt-scale amounts)", () => {
    expect(amountInWordsAr(1000)).toBe("ألف أوقية")
    expect(amountInWordsAr(2000)).toBe("ألفان أوقية")
    expect(amountInWordsAr(2500)).toBe("ألفان وخمسمائة أوقية")
    expect(amountInWordsAr(5000)).toContain("آلاف")
  })
})

describe("amountInWordsFr", () => {
  it("writes small amounts", () => {
    expect(amountInWordsFr(0)).toBe("zéro ouguiya")
    expect(amountInWordsFr(25)).toBe("vingt-cinq ouguiyas")
    expect(amountInWordsFr(80)).toBe("quatre-vingts ouguiyas")
  })

  it("writes thousands", () => {
    expect(amountInWordsFr(1000)).toBe("mille ouguiyas")
    expect(amountInWordsFr(2500)).toBe("deux mille cinq cents ouguiyas")
  })
})
