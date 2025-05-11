// routes/cuentas_empresa.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/cuentas_empresa - Obtener todas las cuentas de empresa
router.get('/', async (req, res) => {
  let queryText = `
      SELECT 
        ce.id_usuario, ce.ruc, ce.razon_social, ce.nombre_contacto, 
        ce.telefono_contacto, ce.direccion_fiscal,
        u.email AS email_usuario, 
        u.nombre AS nombre_usuario,      -- CORREGIDO
        u.apellido AS apellido_usuario   -- AÑADIDO
      FROM cuentas_empresa ce
      JOIN usuarios u ON ce.id_usuario = u.id_usuario
      ORDER BY u.nombre, u.apellido 
    `; // Asumiendo que 'usuarios' tiene 'email', 'nombre' y 'apellido'
  try {
    const result = await db.query(queryText);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener todas las cuentas de empresa:', error);
    console.error('CONSULTA EJECUTADA (cuentas_empresa GET /):', queryText);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/cuentas_empresa/:id_usuario - Obtener los datos de empresa de un usuario específico
router.get('/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        ce.*, 
        u.email AS email_usuario, 
        u.nombre AS nombre_usuario,      -- CORREGIDO
        u.apellido AS apellido_usuario   -- AÑADIDO
      FROM cuentas_empresa ce
      JOIN usuarios u ON ce.id_usuario = u.id_usuario
      WHERE ce.id_usuario = $1
    `;
  try {
    const result = await db.query(queryText, [id_usuario]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Datos de empresa no encontrados para este usuario.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener datos de empresa para el usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (cuentas_empresa GET /:id_usuario):', queryText, [id_usuario]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/cuentas_empresa - Crear un perfil de empresa para un usuario
router.post('/', async (req, res) => {
  const {
    id_usuario,
    ruc,
    razon_social,
    nombre_contacto,
    telefono_contacto,
    direccion_fiscal
  } = req.body;

  if (id_usuario === undefined || !ruc || !razon_social) {
    return res.status(400).json({ error: 'id_usuario, ruc y razón_social son requeridos.' });
  }
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El id_usuario debe ser un número entero válido.' });
  }

  const insertQuery = `
      INSERT INTO cuentas_empresa (id_usuario, ruc, razon_social, nombre_contacto, telefono_contacto, direccion_fiscal)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`;
  const values = [id_usuario, ruc, razon_social, nombre_contacto || null, telefono_contacto || null, direccion_fiscal || null];
  
  try {
    const result = await db.query(insertQuery, values);
    const newEmpresaProfile = result.rows[0];
    
    // Para enriquecer la respuesta, obtenemos también los datos del usuario
    const usuarioInfoQuery = `
        SELECT email, nombre, apellido 
        FROM usuarios 
        WHERE id_usuario = $1`;
    const usuarioInfo = await db.query(usuarioInfoQuery, [newEmpresaProfile.id_usuario]);
    
    let responseProfile = { ...newEmpresaProfile };
    if (usuarioInfo.rows.length > 0) {
        responseProfile.email_usuario = usuarioInfo.rows[0].email;
        responseProfile.nombre_usuario = usuarioInfo.rows[0].nombre;
        responseProfile.apellido_usuario = usuarioInfo.rows[0].apellido;
    }
    
    res.status(201).json(responseProfile);

  } catch (error) {
    console.error('Error al crear perfil de empresa:', error);
    console.error('CONSULTA EJECUTADA (cuentas_empresa POST):', insertQuery, values);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El usuario especificado no existe.' });
    }
    if (error.code === '23505') { 
      return res.status(409).json({ error: 'Ya existe un perfil de empresa para este usuario.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/cuentas_empresa/:id_usuario - Actualizar el perfil de empresa de un usuario
router.put('/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }

  const {
    ruc,
    razon_social,
    nombre_contacto,
    telefono_contacto,
    direccion_fiscal
  } = req.body;

  if (ruc === undefined && razon_social === undefined && nombre_contacto === undefined &&
      telefono_contacto === undefined && direccion_fiscal === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos un campo para actualizar.' });
  }

  let updateQuery = 'UPDATE cuentas_empresa SET ';
  const updateValues = [];
  let paramCount = 1;

  if (ruc !== undefined) {
    updateQuery += `ruc = $${paramCount++}, `;
    updateValues.push(ruc);
  }
  if (razon_social !== undefined) {
    updateQuery += `razon_social = $${paramCount++}, `;
    updateValues.push(razon_social);
  }
  if (nombre_contacto !== undefined) {
    updateQuery += `nombre_contacto = $${paramCount++}, `;
    updateValues.push(nombre_contacto);
  }
  if (telefono_contacto !== undefined) {
    updateQuery += `telefono_contacto = $${paramCount++}, `;
    updateValues.push(telefono_contacto);
  }
  if (direccion_fiscal !== undefined) {
    updateQuery += `direccion_fiscal = $${paramCount++}, `;
    updateValues.push(direccion_fiscal);
  }

  // Quitar la última coma y espacio
  updateQuery = updateQuery.slice(0, -2);
  updateQuery += ` WHERE id_usuario = $${paramCount++} RETURNING *`;
  updateValues.push(id_usuario);

  try {
    const perfilActualQuery = await db.query('SELECT * FROM cuentas_empresa WHERE id_usuario = $1', [id_usuario]);
    if (perfilActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil de empresa no encontrado para este usuario. Intente crear (POST).' });
    }
    
    const result = await db.query(updateQuery, updateValues);
    if (result.rows.length === 0) { // Doble check, aunque el SELECT previo ya lo hizo
      return res.status(404).json({ error: 'Perfil de empresa no encontrado para actualizar.' });
    }

    const updatedEmpresaProfile = result.rows[0];
    const usuarioInfoQuery = `
        SELECT email, nombre, apellido 
        FROM usuarios 
        WHERE id_usuario = $1`;
    const usuarioInfo = await db.query(usuarioInfoQuery, [updatedEmpresaProfile.id_usuario]);
    
    let responseProfile = { ...updatedEmpresaProfile };
    if (usuarioInfo.rows.length > 0) {
        responseProfile.email_usuario = usuarioInfo.rows[0].email;
        responseProfile.nombre_usuario = usuarioInfo.rows[0].nombre;
        responseProfile.apellido_usuario = usuarioInfo.rows[0].apellido;
    }

    res.status(200).json(responseProfile);

  } catch (error) {
    console.error(`Error al actualizar perfil de empresa para el usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (cuentas_empresa PUT):', updateQuery, updateValues);
    // No se espera FK violation aquí si id_usuario existe.
    // No se espera PK violation en UPDATE.
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/cuentas_empresa/:id_usuario - Eliminar el perfil de empresa de un usuario
router.delete('/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }

  const deleteQuery = 'DELETE FROM cuentas_empresa WHERE id_usuario = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_usuario]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Perfil de empresa no encontrado para este usuario para borrar.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(`Error al borrar perfil de empresa del usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (cuentas_empresa DELETE):', deleteQuery, [id_usuario]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
