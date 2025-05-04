// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
// Quita la referencia directa a db aquí si no la usas directamente en server.js
// const db = require('./db_config');

// Importa los routers
const categoriasRouter = require('./routes/categorias');
const productosRouter = require('./routes/productos');
const usuariosRouter = require('./routes/usuarios');
// ... importa otros routers a medida que los crees ...

const app = express();
const PORT = process.env.API_PORT || 3001;

// === Middlewares ===
app.use(cors());
app.use(express.json());

// === Rutas API ===
// Ruta de prueba básica
app.get('/', (req, res) => {
  res.send('API del Mercado Gaucho está funcionando!');
});

// Usa los routers para las rutas específicas
app.use('/api/categorias', categoriasRouter);
app.use('/api/productos', productosRouter);
app.use('/api/usuarios', usuariosRouter);
// ... app.use('/api/ordenes', ordenesRouter); ...


// === Iniciar Servidor ===
app.listen(PORT, () => {
  console.log(`Servidor API escuchando en http://localhost:${PORT}`);
  // Ya no necesitas el test de conexión aquí si lo tienes en db_config.js
});
