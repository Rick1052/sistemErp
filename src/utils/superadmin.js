/**
 * Super-admins da plataforma são definidos pela env var SUPERADMIN_EMAILS
 * (lista separada por vírgula). Ex.: SUPERADMIN_EMAILS="dono@empresa.com,outro@x.com"
 */
export function getSuperAdminEmails() {
  return (process.env.SUPERADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email) {
  if (!email) return false;
  return getSuperAdminEmails().includes(String(email).trim().toLowerCase());
}
