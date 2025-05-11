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
const bannersRouter = require('./routes/banners');
const carritoDetalleRouter = require('./routes/carrito_detalle');
const carritosRouter = require('./routes/carritos');
const cuentasEmpresaRouter = require('./routes/cuentas_empresa');
const cuentasPersonalesRouter = require('./routes/cuentas_personales');
const detalleOrdenRouter = require('./routes/detalle_orden');
const direccionesRouter = require('./routes/direcciones');
const enviosRouter = require('./routes/envios');
const imagenesProductoRouter = require('./routes/imagenes_producto');
const iniciosSesionRouter = require('./routes/inicios_sesion');
const logsActividadRouter = require('./routes/logs_actividad');
const mensajesRouter = require('./routes/mensajes');
const ordenesRouter = require('./routes/ordenes');
const pagosRouter = require('./routes/pagos');
const productosDestacadosRouter = require('./routes/productos_destacados');
const productosPromocionadosRouter = require('./routes/productos_promocionados');
const promocionesRouter = require('./routes/promociones');
const tiendasOficialesRouter = require('./routes/tiendas_oficiales');
const tokensAutenticacionRouter = require('./routes/tokens_autenticacion');
const ubicacionesUsuarioRouter = require('./routes/ubicacion_usuario');
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
app.use('/api/banners', bannersRouter);
app.use('/api/carrito-detalle', carritoDetalleRouter); // ej. /api/carrito_detalle
app.use('/api/carritos', carritosRouter);
app.use('/api/cuentas-empresa', cuentasEmpresaRouter); // ej. /api/cuentas_empresa
app.use('/api/cuentas-personales', cuentasPersonalesRouter); // ej. /api/cuentas_personales
app.use('/api/detalle-orden', detalleOrdenRouter); // ej. /api/detalle_orden
app.use('/api/direcciones', direccionesRouter);
app.use('/api/envios', enviosRouter);
app.use('/api/imagenes-producto', imagenesProductoRouter); // ej. /api/imagenes_producto
app.use('/api/inicios-sesion', iniciosSesionRouter); // ej. /api/inicios_sesion
app.use('/api/logs-actividad', logsActividadRouter); // ej. /api/logs_actividad
app.use('/api/mensajes', mensajesRouter);
app.use('/api/ordenes', ordenesRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/productos-destacados', productosDestacadosRouter); // ej. /api/productos_destacados
app.use('/api/productos-promocionados', productosPromocionadosRouter); // ej. /api/productos_promocionados
app.use('/api/promociones', promocionesRouter);
app.use('/api/tiendas-oficiales', tiendasOficialesRouter); // ej. /api/tiendas_oficiales
app.use('/api/tokens-autenticacion', tokensAutenticacionRouter); // ej. /api/tokens_autenticacion
app.use('/api/ubicaciones-usuario', ubicacionesUsuarioRouter);
// ... app.use('/api/ordenes', ordenesRouter); ...


// === Iniciar Servidor ===
app.listen(PORT, () => {
  console.log(`Servidor API escuchando en http://localhost:${PORT}`);
  // Ya no necesitas el test de conexión aquí si lo tienes en db_config.js
});
