export const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("agentos_token") : null;

export const setToken = (t: string) => localStorage.setItem("agentos_token", t);

export const clearToken = () => localStorage.removeItem("agentos_token");

export const authHeaders = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};
