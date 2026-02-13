// Lightweight shim for tests and environments where the full SQL client
// (which lives in the frontend package) isn't available. Tests typically
// mock this module, so keep the runtime footprint minimal.
export const db: any = {
  query: async () => ({ rows: [] }),
};

export const sql = (..._args: any[]) => '';

export type SqlClient = any;

export default db;
