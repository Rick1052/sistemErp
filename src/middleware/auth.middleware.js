import jwt from 'jsonwebtoken';

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token inválido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      email: decoded.email
    };

    // Pode ser null
    req.companyId = decoded.companyId || null;
    req.role = decoded.role || null;

    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Token expirado ou inválido'
    });
  }
}