// routes/inicios_sesion.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/inicios-sesion - Obtener todos los registros de inicio de sesión
// Filtros opcionales: id_usuario, exito (true/false), fecha_desde, fecha_hasta
router.get('/', async (req, res) => {
  // ¡¡¡ APLICAR AUTORIZACIÓN DE ADMINISTRADOR AQUÍ !!!
  // if (!req.user || !req.user.isAdmin) {
  //   return res.status(403).json({ error: 'Acceso no autorizado.' });
  // }

  const { id_usuario, exito, fecha_desde, fecha_hasta } = req.query;
  let queryText = `
    SELECT 
      isl.id_sesion, 
      isl.id_usuario, 
      isl.fecha_inicio, 
      isl.ip_origen, 
      isl.dispositivo, 
      isl.navegador, 
      isl.exito,
      u.nombre AS nombre_usuario,         -- CORREGIDO
      u.apellido AS apellido_usuario,     -- AÑADIDO
      u.email AS email_usuario           -- AÑADIDO (opcional, pero útil)
    FROM inicios_sesion isl
    LEFT JOIN usuarios u ON isl.id_usuario = u.id_usuario
  `;
  const queryParams = [];
  const conditions = [];
  let paramIndex = 1;

  if (id_usuario) {
    if (isNaN(parseInt(id_usuario))) return res.status(400).json({ error: 'id_usuario debe ser un número.' });
    conditions.push(`isl.id_usuario = $${paramIndex++}`);
    queryParams.push(id_usuario);
  }
  if (exito !== undefined) {
    if (exito !== 'true' && exito !== 'false') {
      return res.status(400).json({ error: 'El parámetro exito debe ser "true" o "false".' });
    }
    conditions.push(`isl.exito = $${paramIndex++}`);
    queryParams.push(exito === 'true');
  }
  if (fecha_desde) {
    if (isNaN(new Date(fecha_desde).getTime())) {
      return res.status(400).json({ error: 'Formato de fecha_desde inválido.' });
    }
    conditions.push(`isl.fecha_inicio >= $${paramIndex++}`);
    queryParams.push(fecha_desde);
  }
  if (fecha_hasta) {
    if (isNaN(new Date(fecha_hasta).getTime())) {
      return res.status(400).json({ error: 'Formato de fecha_hasta inválido.' });
    }
    conditions.push(`isl.fecha_inicio <= $${paramIndex++}`);
    queryParams.push(fecha_hasta);
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND ');
  }
  queryText += ' ORDER BY isl.fecha_inicio DESC';

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener registros de inicio de sesión:', error);
    console.error('CONSULTA EJECUTADA (inicios_sesion GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/inicios-sesion/:id_sesion - Obtener un registro de inicio de sesión específico
router.get('/:id_sesion', async (req, res) => {
  const { id_sesion } = req.params;
  if (isNaN(parseInt(id_sesion))) {
    return res.status(400).json({ error: 'El ID de la sesión debe ser un número entero válido.' });
  }

  // ¡¡¡ APLICAR AUTORIZACIÓN (Admin o usuario dueño si id_usuario coincide) !!!

  const queryText = `
      SELECT 
        isl.*, 
        u.nombre AS nombre_usuario,         -- CORREGIDO
        u.apellido AS apellido_usuario,     -- AÑADIDO
        u.email AS email_usuario           -- AÑADIDO
      FROM inicios_sesion isl
      LEFT JOIN usuarios u ON isl.id_usuario = u.id_usuario
      WHERE isl.id_sesion = $1
    `;
  try {
    const result = await db.query(queryText, [id_sesion]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de inicio de sesión no encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener registro de inicio de sesión ${id_sesion}:`, error);
    console.error('CONSULTA EJECUTADA (inicios_sesion GET /:id_sesion):', queryText, [id_sesion]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/inicios-sesion - Registrar un nuevo intento de inicio de sesión
router.post('/', async (req, res) => {
  const {
    id_usuario, 
    ip_origen,
    dispositivo,
    navegador,
    exito
  } = req.body;

  if (exito === undefined) {
    return res.status(400).json({ error: 'El campo exito (true/false) es requerido.' });
  }
  if (typeof exito !== 'boolean') {
    return res.status(400).json({ error: 'El campo exito debe ser un valor booleano (true o false).' });
  }
  if (id_usuario !== undefined && id_usuario !== null && isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'Si se proporciona, id_usuario debe ser un número entero válido o null.' });
  }

  const insertQuery = `
      INSERT INTO inicios_sesion (id_usuario, ip_origen, dispositivo, navegador, exito) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *`;
  const values = [id_usuario === undefined ? null : id_usuario, ip_origen || null, dispositivo || null, navegador || null, exito];
  
  try {
    const result = await db.query(insertQuery, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al registrar intento de inicio de sesión:', error);
    console.error('CONSULTA EJECUTADA (inicios_sesion POST):', insertQuery, values);
    if (error.code === '23503' && id_usuario !== null) { 
      return res.status(400).json({ error: 'El usuario especificado no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/inicios-sesion/:id_sesion - No implementado para registros de auditoría
router.put('/:id_sesion', (req, res) => {
  res.status(405).json({ error: 'Método PUT no permitido para registros de inicio de sesión. Los logs son inmutables.' });
});

// DELETE /api/inicios-sesion/:id_sesion - No implementado para registros de auditoría
router.delete('/:id_sesion', (req, res) => {
  res.status(405).json({ error: 'Método DELETE no permitido para registros de inicio de sesión. Contacte al administrador para políticas de retención.' });
});

module.exports = router;
