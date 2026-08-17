import prisma from '../../database/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '../../utils/AppError.js';
import { isSuperAdminEmail } from '../../utils/superadmin.js';

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

async function createTokensForUser(user, companyId = null, role = null, setupRequired = false) {
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    companyId,
    role,
    setupRequired,
  });

  // O tenant faz parte também do refresh token. A renovação nunca escolhe
  // silenciosamente outra empresa do mesmo usuário.
  const refreshToken = generateRefreshToken({ id: user.id, companyId });

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    await tx.refreshToken.create({ data: { token: refreshToken, userId: user.id } });
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      companyId,
      role,
      isSuperAdmin: isSuperAdminEmail(user.email),
    },
  };
}

async function requireMembership(userId, companyId) {
  const relation = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!relation) throw new AppError('Empresa inválida ou acesso não autorizado', 403);
  return relation;
}

export async function login({ email, password, companyId }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('E-mail ou senha inválidos', 401);
  }

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: user.id },
    include: { company: true },
  });

  if (companyId) {
    const relation = userCompanies.find((uc) => uc.companyId === companyId);
    if (!relation) throw new AppError('Empresa inválida ou acesso não autorizado', 403);
    return createTokensForUser(user, relation.companyId, relation.role);
  }

  if (userCompanies.length === 0) {
    const tokens = await createTokensForUser(user, null, null, true);
    return { ...tokens, requiresCompanySetup: true };
  }

  if (userCompanies.length === 1) {
    const relation = userCompanies[0];
    return createTokensForUser(user, relation.companyId, relation.role);
  }

  return {
    selectCompany: true,
    companies: userCompanies.map((uc) => ({ id: uc.company.id, name: uc.company.name })),
  };
}

export async function register({ name, email, password }) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new AppError('Este e-mail já está sendo utilizado', 400);

  const hashedPassword = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { name, email, password: hashedPassword },
    select: { id: true, name: true, email: true },
  });
}

export async function refreshUserToken(token, requestedCompanyId = null) {
  const tokenInDb = await prisma.refreshToken.findUnique({ where: { token } });
  if (!tokenInDb) {
    throw new AppError('Sessão expirada. Por favor, faça login novamente', 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Token inválido ou expirado', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user) throw new AppError('Usuário não encontrado', 404);

  let companyId = decoded.companyId || requestedCompanyId || null;
  let role = null;

  if (!companyId) {
    // Compatibilidade para tokens antigos: só inferimos quando não há ambiguidade.
    const memberships = await prisma.userCompany.findMany({ where: { userId: user.id } });
    if (memberships.length > 1) {
      throw new AppError('Selecione novamente a empresa para renovar a sessão', 409);
    }
    if (memberships.length === 1) companyId = memberships[0].companyId;
  }

  if (companyId) {
    const relation = await requireMembership(user.id, companyId);
    role = relation.role;
  }

  const session = await createTokensForUser(user, companyId, role, !companyId);
  return { accessToken: session.accessToken, refreshToken: session.refreshToken };
}

export async function switchCompany(userId, companyId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuário não encontrado', 404);

  const relation = await requireMembership(user.id, companyId);
  return createTokensForUser(user, companyId, relation.role);
}
