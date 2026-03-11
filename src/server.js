import app from './app.js'

const PORT = 3000

const server = app.listen(PORT, (err) => {
  if (err) {
    console.error("Failed to start server on port", PORT, ":", err.message);
    process.exit(1);
  }
  console.log(`Servidor rodando na porta ${PORT}`);
})
