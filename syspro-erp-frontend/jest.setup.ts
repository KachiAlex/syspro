import '@testing-library/jest-dom';

// Basic global fetch mock so components that call fetch in useEffect won't throw in jsdom
if (!(globalThis as any).fetch) {
  (globalThis as any).fetch = async () => ({ ok: true, json: async () => ({}) });
}
