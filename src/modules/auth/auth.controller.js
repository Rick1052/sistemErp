import { register, login, refreshUserToken } from './auth.service.js'

export async function registerController(req, res) {
  try {
    const user = await register(req.body)
    return res.status(201).json({
      message: "Usuário criado com sucesso",
      user
    })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

export async function loginController(req, res) {
  try {
    const tokens = await login(req.body)
    return res.json(tokens)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
}

export async function refreshController(req, res) {
  try {
    const { refreshToken } = req.body
    const newToken = await refreshUserToken(refreshToken)
    return res.json(newToken)
  } catch (error) {
    return res.status(401).json({ message: error.message })
  }
}

