import dotenv from 'dotenv'
dotenv.config()
import app from './app.js'

const PORT = 3000

const server = app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
})

server.on('error', (err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
