import prisma from '../../database/prisma.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

// ===== TOKEN HELPERS =====

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m'
  });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d'
  });
}

// ===== LOGIN =====

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) throw new Error('Usuário não encontrado');

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) throw new Error('Senha inválida');

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: user.id },
    include: { company: true }
  });

  // Usuário sem empresa
  if (userCompanies.length === 0) {
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      companyId: null,
      setupRequired: true
    });

    const refreshToken = generateRefreshToken({
      id: user.id
    });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id
      }
    });

    return {
      accessToken,
      refreshToken,
      requiresCompanySetup: true
    };
  }

  // Usuário com apenas uma empresa
  if (userCompanies.length === 1) {
    const relation = userCompanies[0];

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      companyId: relation.companyId,
      role: relation.role
    });

    const refreshToken = generateRefreshToken({
      id: user.id
    });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id
      }
    });

    return { accessToken, refreshToken };
  }

  // Usuário com múltiplas empresas
  return {
    selectCompany: true,
    companies: userCompanies.map(uc => ({
      id: uc.company.id,
      name: uc.company.name
    }))
  };
}

// ===== REGISTER =====

export async function register({ name, email, password }) {
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) throw new Error('Usuário já existe');

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword }
  });

  return user;
}

// ===== REFRESH TOKEN =====

export async function refreshUserToken(token) {
  const tokenInDb = await prisma.refreshToken.findUnique({
    where: { token }
  });

  if (!tokenInDb) throw new Error('Refresh token inválido');

  const decoded = jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET
  );

  const user = await prisma.user.findUnique({
    where: { id: decoded.id }
  });

  if (!user) throw new Error('Usuário não encontrado');

  // Busca primeira empresa ativa (ou pode adaptar para empresa selecionada)
  const relation = await prisma.userCompany.findFirst({
    where: { userId: user.id }
  });

  const newAccessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    companyId: relation?.companyId || null,
    role: relation?.role || null
  });

  return { accessToken: newAccessToken };
}