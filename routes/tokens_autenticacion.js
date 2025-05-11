// routes/tokens_autenticacion.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario
// const crypto = require('crypto'); // Para generar tokens si lo hicieras aquí

// GET /api/tokens-autenticacion - Obtener todos los tokens (¡MUY RESTRINGIDO - SOLO ADMIN!)
// Filtros opcionales: id_usuario, expirado (true/false)
router.get('/', async (req, res) => {
  // ¡¡¡ APLICAR AUTORIZACIÓN DE ADMINISTRADOR AQUÍ !!!
  const { id_usuario, expirado } = req.query;
  let queryText = `
    SELECT ta.id_token, ta.id_usuario, ta.token, ta.creado_en, ta.expiracion, ta.ip_origen,
           u.nombre AS nombre_usuario, u.apellido AS apellido_usuario, u.email AS email_usuario  /* CORREGIDO AQUÍ */
    FROM tokens_autenticacion ta
    LEFT JOIN usuarios u ON ta.id_usuario = u.id_usuario
  `;
  const queryParams = [];
  const conditions = [];
  let paramIndex = 1;

  if (id_usuario) {
    if (isNaN(parseInt(id_usuario))) return res.status(400).json({ error: 'id_usuario debe ser un número.' });
    conditions.push(`ta.id_usuario = $${paramIndex++}`);
    queryParams.push(id_usuario);
  }
  if (expirado !== undefined) {
    if (expirado !== 'true' && expirado !== 'false') return res.status(400).json({ error: 'expirado debe ser "true" o "false".' }); // Corregido el final de la línea aquí también
    conditions.push(expirado === 'true' ? `ta.expiracion <= NOW()` : `ta.expiracion > NOW()`);
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND ');
  }
  queryText += ' ORDER BY ta.expiracion DESC';

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener tokens de autenticación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/tokens-autenticacion/:id_token - Obtener un token por su ID de BD (¡RESTRINGIDO!)
router.get('/:id_token', async (req, res) => {
  // ¡¡¡ APLICAR AUTORIZACIÓN DE ADMINISTRADOR O PROPIETARIO DEL TOKEN AQUÍ !!!
  const { id_token } = req.params;
  if (isNaN(parseInt(id_token))) {
    return res.status(400).json({ error: 'El ID del token debe ser un número entero válido.' });
  }

  try {
    const result = await db.query(`
      SELECT ta.*, 
             u.nombre AS nombre_usuario, u.apellido AS apellido_usuario, u.email AS email_usuario /* CORREGIDO AQUÍ */
      FROM tokens_autenticacion ta
      LEFT JOIN usuarios u ON ta.id_usuario = u.id_usuario   
      WHERE ta.id_token = $1
    `, [id_token]); // Movido el WHERE a la misma línea o asegurarse que no haya saltos extraños
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token no encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener token ${id_token}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/tokens-autenticacion/validar/:token_string - Validar un token y obtener sus detalles
router.get('/validar/:token_string', async (req, res) => {
  const { token_string } = req.params;
  if (!token_string || token_string.length !== 64) {
      return res.status(400).json({ error: 'Formato de token inválido.' });
  }

  try {
    const result = await db.query(`
      SELECT ta.id_token, ta.id_usuario, ta.creado_en, ta.expiracion, ta.ip_origen,
             u.nombre AS nombre_usuario, u.apellido AS apellido_usuario, u.email AS email_usuario, u.rol /* CORREGIDO AQUÍ y asumiendo que usuarios tiene 'rol' */
      FROM tokens_autenticacion ta
      JOIN usuarios u ON ta.id_usuario = u.id_usuario 
      WHERE ta.token = $1 AND ta.expiracion > NOW()
    `, [token_string]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Token inválido o expirado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al validar token ${token_string}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/tokens-autenticacion - Crear/Emitir un nuevo token de autenticación
router.post('/', async (req, res) => {
  const { id_usuario, token, expiracion, ip_origen } = req.body;
  if (id_usuario === undefined || !token || !expiracion) {
    return res.status(400).json({ error: 'id_usuario, token y expiracion son requeridos.' });
  }
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'id_usuario debe ser un número entero válido.' });
  }
  if (typeof token !== 'string' || token.trim().length !== 64) {
    return res.status(400).json({ error: 'El token debe ser un string de 64 caracteres.' });
  }
  if (isNaN(new Date(expiracion).getTime()) || new Date(expiracion) <= new Date()) {
    return res.status(400).json({ error: 'La fecha de expiracion debe ser una fecha válida y futura.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO tokens_autenticacion (id_usuario, token, expiracion, ip_origen) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id_token, id_usuario, token, creado_en, expiracion, ip_origen`,
      [id_usuario, token.trim(), expiracion, ip_origen || req.ip]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear token de autenticación:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'El usuario especificado no existe.' });
    }
    if (error.code === '23505' && error.constraint === 'tokens_autenticacion_token_key') {
      return res.status(409).json({ error: 'El token proporcionado ya existe (colisión improbable si se genera bien).' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/tokens-autenticacion/:id_token - Actualizar un token
router.put('/:id_token', async (req, res) => {
  const { id_token } = req.params;
  const { expiracion, ip_origen } = req.body;

  if (isNaN(parseInt(id_token))) {
    return res.status(400).json({ error: 'El ID del token debe ser un número entero válido.' });
  }
  if (expiracion === undefined && ip_origen === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos expiracion o ip_origen para actualizar.'});
  }
  if (expiracion && (isNaN(new Date(expiracion).getTime()) || new Date(expiracion) <= new Date())) {
    return res.status(400).json({ error: 'La fecha de expiracion debe ser una fecha válida y futura.' });
  }

  try {
    const tokenActualQuery = await db.query('SELECT * FROM tokens_autenticacion WHERE id_token = $1', [id_token]);
    if (tokenActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Token no encontrado para actualizar.' });
    }
    const tokenActual = tokenActualQuery.rows[0];

    const updatedExpiracion = expiracion !== undefined ? expiracion : tokenActual.expiracion;
    const updatedIpOrigen = ip_origen !== undefined ? ip_origen : tokenActual.ip_origen;

    const result = await db.query(
      `UPDATE tokens_autenticacion 
       SET expiracion = $1, ip_origen = $2
       WHERE id_token = $3 RETURNING id_token, id_usuario, creado_en, expiracion, ip_origen`,
      [updatedExpiracion, updatedIpOrigen, id_token]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al actualizar token ${id_token}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/tokens-autenticacion/:id_token - Revocar/Eliminar un token por su ID de BD
router.delete('/:id_token', async (req, res) => {
  const { id_token } = req.params;
  if (isNaN(parseInt(id_token))) {
    return res.status(400).json({ error: 'El ID del token debe ser un número entero válido.' });
  }
  try {
    const result = await db.query('DELETE FROM tokens_autenticacion WHERE id_token = $1 RETURNING id_token, id_usuario', [id_token]); // Corregido el final de la línea que estaba cortado
    if (result.rowCount === 0) {   
      return res.status(404).json({ error: 'Token no encontrado para borrar.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(`Error al borrar token ${id_token}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/tokens-autenticacion/valor/:token_string - Revocar un token por su valor string
router.delete('/valor/:token_string', async (req, res) => {
    const { token_string } = req.params;
    if (!token_string || token_string.length !== 64) {
        return res.status(400).json({ error: 'Formato de token inválido.' });
    }
    try {
        const result = await db.query('DELETE FROM tokens_autenticacion WHERE token = $1 RETURNING id_token, id_usuario', [token_string]); // Corregido el final de la línea que estaba cortado
        if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Token no encontrado para borrar.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error(`Error al borrar token por valor ${token_string}:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE /api/tokens-autenticacion/usuario/:id_usuario/all - Revocar todos los tokens de un usuario
router.delete('/usuario/:id_usuario/all', async (req, res) => {
  const { id_usuario } = req.params;
   if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }
  try {
    const result = await db.query('DELETE FROM tokens_autenticacion WHERE id_usuario = $1 RETURNING id_token', [id_usuario]);
    res.status(200).json({ message: `${result.rowCount} token(s) eliminados para el usuario ${id_usuario}.`});
  } catch (error) {
    console.error(`Error al borrar todos los tokens para el usuario ${id_usuario}:`, error);   
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
