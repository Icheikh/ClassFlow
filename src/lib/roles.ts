export const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "مدير المنصة",
  SCHOOL_ADMIN: "مدير المدرسة",
  ACCOUNTANT: "محاسب",
  SUPERVISOR: "مشرف",
  TEACHER: "أستاذ",
  PARENT: "ولي أمر",
}

export const roleTranslations: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SCHOOL_ADMIN: "Directeur",
  ACCOUNTANT: "Comptable",
  SUPERVISOR: "Superviseur",
  TEACHER: "Professeur",
  PARENT: "Parent",
}

export const roleRoutes: Record<string, string> = {
  SUPER_ADMIN: "/admin",
  SCHOOL_ADMIN: "/dashboard",
  ACCOUNTANT: "/finance",
  SUPERVISOR: "/supervision",
  TEACHER: "/teacher",
  PARENT: "/parent",
}