import { isSuperAdminEmail } from '../utils/superadmin.js';

/**
 * Exige que o usuário autenticado seja um super-admin da plataforma
 * (e-mail presente em SUPERADMIN_EMAILS). Deve rodar após authMiddleware.
 */
export function requireSuperAdmin(req, res, next) {
  if (!isSuperAdminEmail(req.user?.email)) {
    return res.status(403).json({ message: 'Acesso restrito ao administrador da plataforma' });
  }
  next();
}
