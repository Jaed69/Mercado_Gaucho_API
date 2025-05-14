// server.js
require('dotenv').config(); // Carga las variables de entorno desde .env
const express = require('express');
const cors = require('cors');
const db = require('./db_config'); // Importa la configuración de la base de datos

// Importa los routers
const categoriasRouter = require('./routes/categorias');
const productosRouter = require('./routes/productos');
const usuariosRouter = require('./routes/usuarios');
const ubicacionUsuarioRouter = require('./routes/ubicacion_usuario');
const bannersRouter = require('./routes/banners');
const carritosRouter = require('./routes/carritos');
const carritoDetalleRouter = require('./routes/carrito_detalle');
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
// ... importa otros routers a medida que los crees ...

const app = express();
const PORT = process.env.API_PORT || 3001; // Usa el puerto de .env o 3001 por defecto

// === Middlewares ===
// Habilita CORS para permitir solicitudes de diferentes orígenes
app.use(cors());
// Middleware para parsear JSON en el cuerpo de las solicitudes
app.use(express.json());
// Middleware para parsear datos de formularios urlencoded (opcional, pero útil)
app.use(express.urlencoded({ extended: true }));

// === Rutas API ===

// Ruta de prueba básica
app.get('/', (req, res) => {
  res.send('API del Mercado Gaucho en funcionamiento!'); // Mensaje completo
});

// Ruta para verificar el estado de la conexión a la base de datos
app.get('/estado-db', async (req, res) => {
  try {
    // Intenta realizar una consulta simple para verificar la conexión.
    // El contenido de la consulta no importa tanto como el hecho de que se ejecute sin error.
    // Si tu db_config exporta un pool, esto debería funcionar.
    // Ajusta 'SELECT 1' o el método de prueba según tu configuración de db.
    await db.query('SELECT 1'); // Para MySQL/PostgreSQL con un pool que tiene método .query()

    // Si la consulta es exitosa, envía un HTML indicando éxito
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Estado de la Base de Datos</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f4; color: #333; }
          .container { background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .success { color: green; border-left: 5px solid green; padding-left: 10px; }
          .error { color: red; border-left: 5px solid red; padding-left: 10px; }
          pre { background-color: #eee; padding: 10px; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Estado de la Conexión a la Base de Datos</h1>
          <div class="success">
            <h2>Conexión Exitosa</h2>
            <p>La API pudo conectarse correctamente a la base de datos.</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    // Si hay un error, envía un HTML indicando el fallo
    console.error('Error al conectar con la base de datos:', error);
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Estado de la Base de Datos - Error</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f4; color: #333; }
          .container { background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .success { color: green; border-left: 5px solid green; padding-left: 10px; }
          .error { color: red; border-left: 5px solid red; padding-left: 10px; }
          pre { background-color: #eee; padding: 10px; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Estado de la Conexión a la Base de Datos</h1>
          <div class="error">
            <h2>Conexión Fallida</h2>
            <p>Hubo un error al intentar conectar con la base de datos.</p>
            <p><strong>Detalles del error:</strong></p>
            <pre>${error.message}</pre>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Monta los routers en sus respectivas rutas base
app.use('/api/categorias', categoriasRouter);
app.use('/api/productos', productosRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/ubicacion_usuario', ubicacionUsuarioRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/carritos', carritosRouter);
app.use('/api/carrito_detalle', carritoDetalleRouter);
app.use('/api/cuentas_empresa', cuentasEmpresaRouter);
app.use('/api/cuentas_personales', cuentasPersonalesRouter);
app.use('/api/detalle_orden', detalleOrdenRouter);
app.use('/api/direcciones', direccionesRouter);
app.use('/api/envios', enviosRouter);
app.use('/api/imagenes_producto', imagenesProductoRouter);
app.use('/api/inicios_sesion', iniciosSesionRouter);
app.use('/api/logs_actividad', logsActividadRouter);
app.use('/api/mensajes', mensajesRouter);
app.use('/api/ordenes', ordenesRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/productos_destacados', productosDestacadosRouter);
app.use('/api/productos_promocionados', productosPromocionadosRouter);
app.use('/api/promociones', promocionesRouter);
app.use('/api/tiendas_oficiales', tiendasOficialesRouter);
app.use('/api/tokens_autenticacion', tokensAutenticacionRouter);
// ... app.use('/api/otro-recurso', otroRecursoRouter); ...

// === Middleware para manejar rutas no encontradas (404) ===
app.use((req, res, next) => {
  res.status(404).json({ message: 'Ruta no encontrada.' });
});

// === Middleware para manejar errores generales ===
// Es importante que este middleware de errores tenga 4 argumentos (err, req, res, next)
app.use((err, req, res, next) => {
  console.error("Error en el servidor:", err.stack); // Muestra el stack trace completo del error en la consola del servidor
  res.status(500).json({ 
    message: 'Ocurrió un error en el servidor.',
    error: process.env.NODE_ENV === 'development' ? err.message : {} // Solo muestra detalles del error en desarrollo
  });
});


// === Iniciar el servidor ===
app.listen(PORT, () => {
  console.log(`Servidor API del Mercado Gaucho corriendo en http://localhost:${PORT}`);
  console.log(`Prueba la conexión a la BD en http://localhost:${PORT}/estado-db`);
});
