// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db_config'); // Descomenta o añade si /estado-db u otra lógica aquí lo necesita

// Importa los routers
const categoriasRouter = require('./routes/categorias');
const productosRouter = require('./routes/productos');
const usuariosRouter = require('./routes/usuarios');
// const ordenesRouter = require('./routes/ordenes'); // Descomenta si tienes este router

const app = express();
const PORT = process.env.API_PORT || 3001;

// === Middlewares ===
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Útil para datos de formularios

// === Rutas API ===

// Ruta de prueba básica
app.get('/', (req, res) => {
  res.send('API del Mercado Gaucho está funcionando!');
});

// Ruta para verificar el estado de la conexión a la base de datos
app.get('/estado-db', async (req, res) => {
  try {
    await db.query('SELECT 1'); // Ajusta según tu DB (ej. para PostgreSQL podría ser db.query('SELECT 1'))
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Estado DB</title></head>
      <body><h1>Conexión a la Base de Datos Exitosa</h1></body></html>
    `);
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(`
      <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Estado DB - Error</title></head>
      <body><h1>Error al Conectar a la Base de Datos</h1><pre>${error.message}</pre></body></html>
    `);
  }
});

// Usa los routers para las rutas específicas
app.use('/api/categorias', categoriasRouter);
app.use('/api/productos', productosRouter); // Corregida la comilla faltante
app.use('/api/usuarios', usuariosRouter);
// app.use('/api/ordenes', ordenesRouter); // Descomenta y asegúrate de que ordenesRouter esté importado

// === Middleware para manejar rutas no encontradas (404) ===
// Debe ir después de todas tus rutas específicas
app.use((req, res, next) => {
  res.status(404).json({ message: 'Ruta no encontrada en la API.' });
});

// === Middleware para manejar errores generales ===
// Debe tener 4 argumentos (err, req, res, next) para ser reconocido como manejador de errores
app.use((err, req, res, next) => {
  console.error("Error en el servidor:", err.stack);
  res.status(500).json({
    message: 'Ocurrió un error interno en el servidor.',
    // Solo muestra detalles del error en desarrollo por seguridad
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// === Iniciar Servidor ===
app.listen(PORT, () => {
  console.log(`Servidor API escuchando en http://localhost:${PORT}`);
  console.log(`Prueba la conexión a la BD en http://localhost:${PORT}/estado-db`);
});
