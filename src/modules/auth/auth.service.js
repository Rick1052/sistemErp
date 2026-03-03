import prisma from '../../database/prisma.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { AppError } from '../../utils/AppError.js'; // Importando nossa nova classe

// ===== TOKEN HELPERS =====
function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15h' });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '15h' });
}

// ===== LOGIN =====
export async function login({ email, password, companyId }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // 401: Não dizemos se o erro é no e-mail ou na senha por segurança
  if (!user) {
    throw new AppError('E-mail ou senha inválidos', 401);
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new AppError('E-mail ou senha inválidos', 401);
  }

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: user.id },
    include: { company: true }
  });

  const createTokens = async (companyId = null, role = null, setupRequired = false) => {
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      companyId,
      role,
      setupRequired
    });

    const refreshToken = generateRefreshToken({ id: user.id });

    // 1. LIMPEZA: Remove qualquer token anterior deste usuário.
    // O deleteMany não falha se não encontrar nada.
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id }
    });

    // 2. CRIAÇÃO: Agora o campo 'token' nunca será duplicado para o mesmo usuário.
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id
      }
    });

    // 3. RETORNO: Note que adicionei o objeto 'user' para o Frontend salvar
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyId: companyId
      }
    };
  };

  // Se a requisição já solicitou uma company específica (login secundário de múltiplas empresas)
  if (companyId) {
    const relation = userCompanies.find(uc => uc.companyId === companyId);
    if (!relation) {
      throw new AppError('Empresa inválida ou acesso não autorizado', 403);
    }
    return await createTokens(relation.companyId, relation.role);
  }

  // Caso 1: Usuário sem empresa
  if (userCompanies.length === 0) {
    const tokens = await createTokens(null, null, true);
    return { ...tokens, requiresCompanySetup: true };
  }

  // Caso 2: Usuário com apenas uma empresa (Login Direto)
  if (userCompanies.length === 1) {
    const relation = userCompanies[0];
    return await createTokens(relation.companyId, relation.role);
  }

  // Caso 3: Múltiplas empresas (Frontend deve pedir para selecionar)
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
  const existingUser = await prisma.user.findUnique({ where: { email } });

  // 400: Bad Request (O dado enviado está em conflito/inválido)
  if (existingUser) {
    throw new AppError('Este e-mail já está sendo utilizado', 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: { name, email, password: hashedPassword },
    select: { id: true, name: true, email: true } // Não retorna a senha no objeto criado!
  });
}

// ===== REFRESH TOKEN =====
export async function refreshUserToken(token) {
  const tokenInDb = await prisma.refreshToken.findUnique({ where: { token } });

  // 401: Se o refresh token sumiu ou é inválido, a sessão caiu de vez
  if (!tokenInDb) {
    throw new AppError('Sessão expirada. Por favor, faça login novamente', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) throw new AppError('Usuário não encontrado', 404);

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

  } catch (err) {
    // Se o JWT falhar na verificação (expirou os 7 dias ou é falso)
    throw new AppError('Token inválido ou expirado', 401);
  }
}