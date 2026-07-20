export function getDateLocale(locale: string) {
  return locale === "fr" ? "fr-FR" : "ar-MR"
}

export function getLocalizedSubjectName(
  subject: { nameAr: string; nameFr?: string | null },
  locale: string
) {
  return locale === "fr" ? subject.nameFr || subject.nameAr : subject.nameAr
}
