import { auth } from "./firebase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://systematrix.pythonanywhere.com";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown> & T;
  if (!resp.ok) {
    throw new ApiError(resp.status, (data as { detail?: string }).detail ?? `Erro ${resp.status}`);
  }
  return data;
}

export const api = {
  get: <T = unknown>(path: string) => request<T>("GET", path),
  post: <T = unknown>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T = unknown>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T = unknown>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};

export interface Perfil {
  uid: string;
  nome: string | null;
  email: string | null;
  adminGlobal: boolean;
  plano: { tipo: string; status: string; sistemas: string[] };
  vinculos: Record<
    string,
    { cargo: string; status: string; instituicao?: string; sistemasVisiveis?: string[] }
  >;
}

export const getPerfil = () => api.get<Perfil & { sucesso: boolean }>("/me");
