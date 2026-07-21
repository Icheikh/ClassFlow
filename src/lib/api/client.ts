type ApiResult<T> = { data: T | null; error: string | null }

const BASE_URL = ""

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const isFormData = options?.body instanceof FormData
    const headers = new Headers(options?.headers || undefined)

    if (!isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers,
      ...options,
    })

    if (!res.ok) {
      if (res.status === 401) return { data: null, error: "Unauthorized" }
      if (res.status === 404) return { data: null, error: "Not found" }
      const body = await res.json().catch(() => ({}))
      return { data: null, error: body.error || "Something went wrong" }
    }

    const data = await res.json()
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Network error" }
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "POST", body: JSON.stringify(body) }),
  postForm: <T>(endpoint: string, body: FormData) =>
    request<T>(endpoint, { method: "POST", body }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
}
