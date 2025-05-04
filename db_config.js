// db_config.js
require('dotenv').config(); // Carga las variables del archivo .env
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'), // Asegura que el puerto sea número
  // Puedes añadir opciones de SSL aquí si configuras SSL en PostgreSQL
  // ssl: { rejectUnauthorized: false } // Ejemplo si usas SSL sin verificación estricta
});

// Prueba de conexión (opcional)
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error adquiriendo cliente para la DB:', err.stack);
  }
  console.log('Conectado exitosamente a la base de datos PostgreSQL!');
  client.release(); // Libera el cliente de vuelta al pool
});

// Exporta una función para hacer queries o el pool directamente
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool // O exportar el pool si prefieres manejar clientes manualmente
};
