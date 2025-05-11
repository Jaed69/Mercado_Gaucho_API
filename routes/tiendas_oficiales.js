// routes/tiendas_oficiales.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/tiendas-oficiales - Obtener todas las tiendas oficiales
// Filtros opcionales: estado, nombre_tienda (búsqueda parcial)
router.get('/', async (req, res) => {
  const { estado, nombre_tienda } = req.query;

  let queryText = `
    SELECT 
      t.id_tienda, t.id_usuario, t.nombre_tienda, t.logo_url, 
      t.descripcion, t.estado, t.fecha_creacion,
      u.nombre AS nombre_propietario,     -- CORREGIDO
      u.apellido AS apellido_propietario, -- AÑADIDO
      u.email AS email_propietario        -- AÑADIDO
    FROM tiendas_oficiales t
    JOIN usuarios u ON t.id_usuario = u.id_usuario 
  `;
  const queryParams = [];
  const conditions = [];
  let paramIndex = 1;

  if (estado) {
    conditions.push(`t.estado = $${paramIndex++}`);
    queryParams.push(estado);
  }
  if (nombre_tienda) {
    conditions.push(`t.nombre_tienda ILIKE $${paramIndex++}`);
    queryParams.push(`%${nombre_tienda}%`);
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND ');
  }
  queryText += ' ORDER BY t.nombre_tienda ASC';

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener tiendas oficiales:', error);
    console.error('CONSULTA EJECUTADA (tiendas_oficiales GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/tiendas-oficiales/:id_tienda - Obtener una tienda oficial por su ID
router.get('/:id_tienda', async (req, res) => {
  const { id_tienda } = req.params;
  if (isNaN(parseInt(id_tienda))) {
    return res.status(400).json({ error: 'El ID de la tienda debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        t.*, 
        u.nombre AS nombre_propietario,     -- CORREGIDO
        u.apellido AS apellido_propietario, -- AÑADIDO
        u.email AS email_propietario        -- AÑADIDO
      FROM tiendas_oficiales t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_tienda = $1
    `;
  try {
    const result = await db.query(queryText, [id_tienda]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tienda oficial no encontrada.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener tienda oficial ${id_tienda}:`, error);
    console.error('CONSULTA EJECUTADA (tiendas_oficiales GET /:id_tienda):', queryText, [id_tienda]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/tiendas-oficiales/usuario/:id_usuario - Obtener la tienda oficial de un usuario
router.get('/usuario/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        t.*, 
        u.nombre AS nombre_propietario,     -- CORREGIDO
        u.apellido AS apellido_propietario, -- AÑADIDO
        u.email AS email_propietario        -- AÑADIDO
      FROM tiendas_oficiales t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_usuario = $1
    `;
  try {
    const result = await db.query(queryText, [id_usuario]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Este usuario no tiene una tienda oficial registrada.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener tienda oficial para el usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (tiendas_oficiales GET /usuario/:id_usuario):', queryText, [id_usuario]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/tiendas-oficiales - Crear una nueva tienda oficial
router.post('/', async (req, res) => {
  const {
    id_usuario,
    nombre_tienda,
    logo_url,
    descripcion,
    estado 
  } = req.body;

  if (id_usuario === undefined || !nombre_tienda) {
    return res.status(400).json({ error: 'id_usuario y nombre_tienda son requeridos.' });
  }
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'id_usuario debe ser un número entero válido.' });
  }

  const insertQuery = `
      INSERT INTO tiendas_oficiales (id_usuario, nombre_tienda, logo_url, descripcion, estado)
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *`;
  const values = [
        id_usuario,
        nombre_tienda,
        logo_url || null,
        descripcion || null,
        estado || 'en_revision' 
      ];
  
  try {
    const result = await db.query(insertQuery, values);
    const nuevaTienda = result.rows[0];

    let responseTienda = { ...nuevaTienda };
    if (nuevaTienda.id_usuario) {
        const usuarioInfoQuery = `SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1`;
        const usuarioInfo = await db.query(usuarioInfoQuery, [nuevaTienda.id_usuario]);
        if (usuarioInfo.rows.length > 0) {
            responseTienda.nombre_propietario = usuarioInfo.rows[0].nombre;   // <<< CORREGIDO
            responseTienda.apellido_propietario = usuarioInfo.rows[0].apellido; // <<< AÑADIDO
            responseTienda.email_propietario = usuarioInfo.rows[0].email;   // <<< AÑADIDO
        }
    }
    res.status(201).json(responseTienda);

  } catch (error) {
    console.error('Error al crear tienda oficial:', error);
    console.error('CONSULTA EJECUTADA (tiendas_oficiales POST):', insertQuery, values);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El usuario especificado no existe.' });
    }
    if (error.code === '23505') { 
      if (error.constraint === 'tiendas_oficiales_id_usuario_key') {
        return res.status(409).json({ error: 'Este usuario ya tiene una tienda oficial registrada.' });
      }
      if (error.constraint === 'tiendas_oficiales_nombre_tienda_key') {
        return res.status(409).json({ error: 'El nombre de la tienda ya está en uso.' });
      }
    }
    if (error.message && error.message.includes('invalid input value for enum tienda_estado_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para estado no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/tiendas-oficiales/:id_tienda - Actualizar una tienda oficial existente
router.put('/:id_tienda', async (req, res) => {
  const { id_tienda } = req.params;
  const {
    nombre_tienda,
    logo_url,
    descripcion,
    estado
  } = req.body;

  if (isNaN(parseInt(id_tienda))) {
    return res.status(400).json({ error: 'El ID de la tienda debe ser un número entero válido.' });
  }
  if (nombre_tienda === undefined && logo_url === undefined && descripcion === undefined && estado === undefined) {
     return res.status(400).json({ error: 'Se requiere al menos un campo para actualizar.' });
  }
  
  // Construcción dinámica de la consulta UPDATE
  let updateFields = [];
  let queryParams = [];
  let paramIndex = 1;

  if (nombre_tienda !== undefined) {
    updateFields.push(`nombre_tienda = $${paramIndex++}`);
    queryParams.push(nombre_tienda);
  }
  if (logo_url !== undefined) {
    updateFields.push(`logo_url = $${paramIndex++}`);
    queryParams.push(logo_url);
  }
  if (descripcion !== undefined) {
    updateFields.push(`descripcion = $${paramIndex++}`);
    queryParams.push(descripcion);
  }
  if (estado !== undefined) {
    updateFields.push(`estado = $${paramIndex++}`);
    queryParams.push(estado);
  }

  if (updateFields.length === 0) {
     return res.status(400).json({ error: 'No hay campos válidos para actualizar.'});
  }
  
  queryParams.push(id_tienda);
  const updateQuery = `UPDATE tiendas_oficiales SET ${updateFields.join(', ')} WHERE id_tienda = $${paramIndex} RETURNING *`;

  try {
    const tiendaActualQuery = await db.query('SELECT * FROM tiendas_oficiales WHERE id_tienda = $1', [id_tienda]);
    if (tiendaActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Tienda oficial no encontrada para actualizar.' });
    }
        
    const result = await db.query(updateQuery, queryParams);
    let tiendaActualizada = result.rows[0];

    if (tiendaActualizada.id_usuario) {
        const usuarioInfoQuery = `SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1`;
        const usuarioInfo = await db.query(usuarioInfoQuery, [tiendaActualizada.id_usuario]);
        if (usuarioInfo.rows.length > 0) {
            tiendaActualizada.nombre_propietario = usuarioInfo.rows[0].nombre;   // <<< CORREGIDO
            tiendaActualizada.apellido_propietario = usuarioInfo.rows[0].apellido; // <<< AÑADIDO
            tiendaActualizada.email_propietario = usuarioInfo.rows[0].email;   // <<< AÑADIDO
        }
    }
    res.status(200).json(tiendaActualizada);

  } catch (error) {
    console.error(`Error al actualizar tienda oficial ${id_tienda}:`, error);
    console.error('CONSULTA EJECUTADA (tiendas_oficiales PUT):', updateQuery, queryParams);
    if (error.code === '23505' && error.constraint === 'tiendas_oficiales_nombre_tienda_key') {
      return res.status(409).json({ error: 'El nombre de la tienda ya está en uso por otra tienda.' });
    }
    if (error.message && error.message.includes('invalid input value for enum tienda_estado_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para estado no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/tiendas-oficiales/:id_tienda - Eliminar una tienda oficial
router.delete('/:id_tienda', async (req, res) => {
  const { id_tienda } = req.params;
   if (isNaN(parseInt(id_tienda))) {
    return res.status(400).json({ error: 'El ID de la tienda debe ser un número entero válido.' });
  }

  const deleteQuery = 'DELETE FROM tiendas_oficiales WHERE id_tienda = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_tienda]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tienda oficial no encontrada para borrar.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error(`Error al borrar tienda oficial ${id_tienda}:`, error);
    console.error('CONSULTA EJECUTADA (tiendas_oficiales DELETE):', deleteQuery, [id_tienda]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
