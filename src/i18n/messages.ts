import ar from "../../messages/ar/common.json"
import fr from "../../messages/fr/common.json"
import type { AppLocale } from "./config"

const messagesByLocale = {
  ar,
  fr,
} as const

export function getMessages(locale: AppLocale) {
  return messagesByLocale[locale]
}
