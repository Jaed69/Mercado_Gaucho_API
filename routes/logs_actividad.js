// routes/logs_actividad.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/logs-actividad - Obtener todos los registros de actividad
// Filtros opcionales: id_usuario, accion, fecha_desde, fecha_hasta
router.get('/', async (req, res) => {
  // ¡¡¡ APLICAR AUTORIZACIÓN DE ADMINISTRADOR AQUÍ !!!
  // if (!req.user || !req.user.isAdmin) {
  //   return res.status(403).json({ error: 'Acceso no autorizado.' });
  // }

  const { id_usuario, accion, fecha_desde, fecha_hasta } = req.query;
  let queryText = `
    SELECT 
      la.id_log, 
      la.id_usuario, 
      la.accion, 
      la.fecha, 
      la.descripcion,
      u.nombre AS nombre_usuario,         -- CORREGIDO
      u.apellido AS apellido_usuario,     -- AÑADIDO
      u.email AS email_usuario           -- AÑADIDO (opcional, pero útil)
    FROM logs_actividad la
    LEFT JOIN usuarios u ON la.id_usuario = u.id_usuario
  `;
  const queryParams = [];
  const conditions = [];
  let paramIndex = 1;

  if (id_usuario) {
    if (isNaN(parseInt(id_usuario))) return res.status(400).json({ error: 'id_usuario debe ser un número.' });
    conditions.push(`la.id_usuario = $${paramIndex++}`);
    queryParams.push(id_usuario);
  }
  if (accion) {
    conditions.push(`la.accion ILIKE $${paramIndex++}`);
    queryParams.push(`%${accion}%`);
  }
  if (fecha_desde) {
    if (isNaN(new Date(fecha_desde).getTime())) {
      return res.status(400).json({ error: 'Formato de fecha_desde inválido.' });
    }
    conditions.push(`la.fecha >= $${paramIndex++}`);
    queryParams.push(fecha_desde);
  }
  if (fecha_hasta) {
    if (isNaN(new Date(fecha_hasta).getTime())) {
      return res.status(400).json({ error: 'Formato de fecha_hasta inválido.' });
    }
    conditions.push(`la.fecha <= $${paramIndex++}`);
    queryParams.push(fecha_hasta);
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND ');
  }
  queryText += ' ORDER BY la.fecha DESC';

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener logs de actividad:', error);
    console.error('CONSULTA EJECUTADA (logs_actividad GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/logs-actividad/:id_log - Obtener un registro de actividad específico
router.get('/:id_log', async (req, res) => {
  const { id_log } = req.params;
  if (isNaN(parseInt(id_log))) {
    return res.status(400).json({ error: 'El ID del log debe ser un número entero válido.' });
  }
  // ¡¡¡ APLICAR AUTORIZACIÓN !!!

  const queryText = `
      SELECT 
        la.*, 
        u.nombre AS nombre_usuario,         -- CORREGIDO
        u.apellido AS apellido_usuario,     -- AÑADIDO
        u.email AS email_usuario           -- AÑADIDO
      FROM logs_actividad la
      LEFT JOIN usuarios u ON la.id_usuario = u.id_usuario
      WHERE la.id_log = $1
    `;
  try {
    const result = await db.query(queryText, [id_log]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de actividad no encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener log de actividad ${id_log}:`, error);
    console.error('CONSULTA EJECUTADA (logs_actividad GET /:id_log):', queryText, [id_log]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/logs-actividad - Registrar una nueva actividad
router.post('/', async (req, res) => {
  const {
    id_usuario, 
    accion,
    descripcion
  } = req.body;

  if (!accion) {
    return res.status(400).json({ error: 'El campo accion es requerido.' });
  }
  if (id_usuario !== undefined && id_usuario !== null && isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'Si se proporciona, id_usuario debe ser un número entero válido o null.' });
  }

  const insertQuery = `
      INSERT INTO logs_actividad (id_usuario, accion, descripcion) 
      VALUES ($1, $2, $3) 
      RETURNING *`;
  const values = [id_usuario === undefined ? null : id_usuario, accion, descripcion || null];
  
  try {
    const result = await db.query(insertQuery, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al registrar actividad:', error);
    console.error('CONSULTA EJECUTADA (logs_actividad POST):', insertQuery, values);
    if (error.code === '23503' && id_usuario !== null) { 
      return res.status(400).json({ error: 'El usuario especificado para el log no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/logs-actividad/:id_log - No implementado para registros de auditoría
router.put('/:id_log', (req, res) => {
  res.status(405).json({ error: 'Método PUT no permitido para logs de actividad. Los logs son inmutables.' });
});

// DELETE /api/logs-actividad/:id_log - No implementado para registros de auditoría
router.delete('/:id_log', (req, res) => {
  res.status(405).json({ error: 'Método DELETE no permitido para logs de actividad. Contacte al administrador para políticas de retención.' });
});

module.exports = router;
