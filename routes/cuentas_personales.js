// routes/cuentas_personales.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/cuentas_personales - Obtener todos los perfiles personales
router.get('/', async (req, res) => {
  let queryText = `
      SELECT 
        cp.id_usuario, cp.dni, cp.fecha_nacimiento, cp.genero,
        u.email AS email_usuario, 
        u.nombre AS nombre_usuario,      -- CORREGIDO
        u.apellido AS apellido_usuario   -- AÑADIDO
      FROM cuentas_personales cp
      JOIN usuarios u ON cp.id_usuario = u.id_usuario
      ORDER BY u.nombre, u.apellido
    `;
  try {
    const result = await db.query(queryText);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener todos los perfiles personales:', error);
    console.error('CONSULTA EJECUTADA (cuentas_personales GET /):', queryText);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/cuentas_personales/:id_usuario - Obtener el perfil personal de un usuario específico
router.get('/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        cp.*, 
        u.email AS email_usuario, 
        u.nombre AS nombre_usuario,      -- CORREGIDO
        u.apellido AS apellido_usuario   -- AÑADIDO
      FROM cuentas_personales cp
      JOIN usuarios u ON cp.id_usuario = u.id_usuario
      WHERE cp.id_usuario = $1
    `;
  try {
    const result = await db.query(queryText, [id_usuario]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil personal no encontrado para este usuario.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener perfil personal para el usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (cuentas_personales GET /:id_usuario):', queryText, [id_usuario]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/cuentas_personales - Crear un perfil personal para un usuario
router.post('/', async (req, res) => {
  const {
    id_usuario,
    dni,
    fecha_nacimiento, // Se espera formato 'YYYY-MM-DD'
    genero // Se espera un valor válido del enum 'genero_enum'
  } = req.body;

  if (id_usuario === undefined) {
    return res.status(400).json({ error: 'El id_usuario es requerido.' });
  }
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El id_usuario debe ser un número entero válido.' });
  }
  if (fecha_nacimiento && isNaN(new Date(fecha_nacimiento).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_nacimiento inválido. Usar YYYY-MM-DD.' });
  }

  const insertQuery = `
      INSERT INTO cuentas_personales (id_usuario, dni, fecha_nacimiento, genero)
      VALUES ($1, $2, $3, $4)
      RETURNING *`;
  const values = [id_usuario, dni || null, fecha_nacimiento || null, genero || null];
  
  try {
    const result = await db.query(insertQuery, values);
    const newPersonalProfile = result.rows[0];
    
    const usuarioInfoQuery = `
        SELECT email, nombre, apellido 
        FROM usuarios 
        WHERE id_usuario = $1`;
    const usuarioInfo = await db.query(usuarioInfoQuery, [newPersonalProfile.id_usuario]);
    
    let responseProfile = { ...newPersonalProfile };
    if (usuarioInfo.rows.length > 0) {
        responseProfile.email_usuario = usuarioInfo.rows[0].email;
        responseProfile.nombre_usuario = usuarioInfo.rows[0].nombre;
        responseProfile.apellido_usuario = usuarioInfo.rows[0].apellido;
    }
    
    res.status(201).json(responseProfile);

  } catch (error) {
    console.error('Error al crear perfil personal:', error);
    console.error('CONSULTA EJECUTADA (cuentas_personales POST):', insertQuery, values);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El usuario especificado no existe.' });
    }
    if (error.code === '23505') { 
      return res.status(409).json({ error: 'Ya existe un perfil personal para este usuario.' });
    }
    if (error.message && error.message.includes('invalid input value for enum genero_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para género no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/cuentas_personales/:id_usuario - Actualizar el perfil personal de un usuario
router.put('/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }

  const {
    dni,
    fecha_nacimiento,
    genero
  } = req.body;

  if (dni === undefined && fecha_nacimiento === undefined && genero === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos un campo (dni, fecha_nacimiento, genero) para actualizar.' });
  }
  if (fecha_nacimiento && isNaN(new Date(fecha_nacimiento).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_nacimiento inválido. Usar YYYY-MM-DD.' });
  }

  let updateQuery = 'UPDATE cuentas_personales SET ';
  const updateValues = [];
  let paramCount = 1;

  if (dni !== undefined) {
    updateQuery += `dni = $${paramCount++}, `;
    updateValues.push(dni);
  }
  if (fecha_nacimiento !== undefined) {
    updateQuery += `fecha_nacimiento = $${paramCount++}, `;
    updateValues.push(fecha_nacimiento);
  }
  if (genero !== undefined) {
    updateQuery += `genero = $${paramCount++}, `;
    updateValues.push(genero);
  }

  updateQuery = updateQuery.slice(0, -2); // Quitar la última coma y espacio
  updateQuery += ` WHERE id_usuario = $${paramCount++} RETURNING *`;
  updateValues.push(id_usuario);

  try {
    const perfilActualQuery = await db.query('SELECT * FROM cuentas_personales WHERE id_usuario = $1', [id_usuario]);
    if (perfilActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil personal no encontrado para este usuario. Intente crear (POST).' });
    }
        
    const result = await db.query(updateQuery, updateValues);
     if (result.rows.length === 0) { // Doble check
      return res.status(404).json({ error: 'Perfil personal no encontrado para actualizar (inesperado).' });
    }

    const updatedPersonalProfile = result.rows[0];
    const usuarioInfoQuery = `
        SELECT email, nombre, apellido 
        FROM usuarios 
        WHERE id_usuario = $1`;
    const usuarioInfo = await db.query(usuarioInfoQuery, [updatedPersonalProfile.id_usuario]);
    
    let responseProfile = { ...updatedPersonalProfile };
    if (usuarioInfo.rows.length > 0) {
        responseProfile.email_usuario = usuarioInfo.rows[0].email;
        responseProfile.nombre_usuario = usuarioInfo.rows[0].nombre;
        responseProfile.apellido_usuario = usuarioInfo.rows[0].apellido;
    }
    
    res.status(200).json(responseProfile);

  } catch (error) {
    console.error(`Error al actualizar perfil personal para el usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (cuentas_personales PUT):', updateQuery, updateValues);
    if (error.message && error.message.includes('invalid input value for enum genero_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para género no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/cuentas_personales/:id_usuario - Eliminar el perfil personal de un usuario
router.delete('/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }

  const deleteQuery = 'DELETE FROM cuentas_personales WHERE id_usuario = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_usuario]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Perfil personal no encontrado para este usuario para borrar.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error(`Error al borrar perfil personal del usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (cuentas_personales DELETE):', deleteQuery, [id_usuario]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
