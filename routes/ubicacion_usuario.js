// routes/ubicacion_usuario.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/ubicaciones-usuario - Obtener todas las ubicaciones de usuario
// Filtro opcional: id_usuario
router.get('/', async (req, res) => {
  const { id_usuario } = req.query;
  let queryText = `
    SELECT 
      uu.id_ubicacion, uu.id_usuario, uu.ciudad, uu.departamento, 
      uu.pais, uu.latitud, uu.longitud, uu.fecha_seleccion,
      u.nombre AS nombre_usuario,         -- CORREGIDO
      u.apellido AS apellido_usuario,     -- AÑADIDO
      u.email AS email_usuario           -- AÑADIDO
    FROM ubicaciones_usuario uu
    LEFT JOIN usuarios u ON uu.id_usuario = u.id_usuario
  `;
  const queryParams = [];

  if (id_usuario) {
    if (isNaN(parseInt(id_usuario))) {
      return res.status(400).json({ error: 'El id_usuario debe ser un número entero válido.' });
    }
    queryText += ' WHERE uu.id_usuario = $1';
    queryParams.push(id_usuario);
    queryText += ' ORDER BY uu.fecha_seleccion DESC, uu.id_ubicacion DESC';
  } else {
    queryText += ' ORDER BY uu.id_usuario ASC, uu.fecha_seleccion DESC, uu.id_ubicacion DESC';
  }

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener ubicaciones de usuario:', error);
    console.error('CONSULTA EJECUTADA (ubicaciones_usuario GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/ubicaciones-usuario/:id_ubicacion - Obtener una ubicación específica por su ID
router.get('/:id_ubicacion', async (req, res) => {
  const { id_ubicacion } = req.params;
  if (isNaN(parseInt(id_ubicacion))) {
    return res.status(400).json({ error: 'El ID de la ubicación debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        uu.*, 
        u.nombre AS nombre_usuario,         -- CORREGIDO
        u.apellido AS apellido_usuario,     -- AÑADIDO
        u.email AS email_usuario           -- AÑADIDO
      FROM ubicaciones_usuario uu
      LEFT JOIN usuarios u ON uu.id_usuario = u.id_usuario
      WHERE uu.id_ubicacion = $1
    `;
  try {
    const result = await db.query(queryText, [id_ubicacion]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ubicación de usuario no encontrada.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener ubicación de usuario ${id_ubicacion}:`, error);
    console.error('CONSULTA EJECUTADA (ubicaciones_usuario GET /:id_ubicacion):', queryText, [id_ubicacion]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/ubicaciones-usuario - Crear una nueva ubicación para un usuario
router.post('/', async (req, res) => {
  const {
    id_usuario,
    ciudad,
    departamento,
    pais,
    latitud,
    longitud,
    fecha_seleccion 
  } = req.body;

  if (id_usuario === undefined) {
    return res.status(400).json({ error: 'id_usuario es requerido.' });
  }
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'id_usuario debe ser un número entero válido.' });
  }
  if (!ciudad && (latitud === undefined || longitud === undefined)) {
    return res.status(400).json({ error: 'Se requiere al menos ciudad, o latitud y longitud.' });
  }
  if ((latitud !== undefined && isNaN(parseFloat(latitud))) || (longitud !== undefined && isNaN(parseFloat(longitud)))) {
    return res.status(400).json({ error: 'Latitud y longitud deben ser números válidos.' });
  }
  if (fecha_seleccion && isNaN(new Date(fecha_seleccion).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_seleccion inválido.' });
  }

  const insertQuery = `
      INSERT INTO ubicaciones_usuario 
        (id_usuario, ciudad, departamento, pais, latitud, longitud, fecha_seleccion) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`;
  const values = [
        id_usuario,
        ciudad || null,
        departamento || null,
        pais || null,
        latitud === undefined ? null : parseFloat(latitud),
        longitud === undefined ? null : parseFloat(longitud),
        fecha_seleccion || new Date() 
    ];
  
  try {
    const result = await db.query(insertQuery, values);
    const nuevaUbicacion = result.rows[0];

    let responseUbicacion = { ...nuevaUbicacion };
    if (nuevaUbicacion.id_usuario) {
        const usuarioInfoQuery = `SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1`;
        const usuarioInfo = await db.query(usuarioInfoQuery, [nuevaUbicacion.id_usuario]);
        if (usuarioInfo.rows.length > 0) {
            responseUbicacion.nombre_usuario = usuarioInfo.rows[0].nombre;
            responseUbicacion.apellido_usuario = usuarioInfo.rows[0].apellido;
            responseUbicacion.email_usuario = usuarioInfo.rows[0].email;
        }
    }
    res.status(201).json(responseUbicacion);

  } catch (error) {
    console.error('Error al crear ubicación de usuario:', error);
    console.error('CONSULTA EJECUTADA (ubicaciones_usuario POST):', insertQuery, values);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El usuario especificado no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/ubicaciones-usuario/:id_ubicacion - Actualizar una ubicación de usuario existente
router.put('/:id_ubicacion', async (req, res) => {
  const { id_ubicacion } = req.params;
  const {
    id_usuario, 
    ciudad,
    departamento,
    pais,
    latitud,
    longitud,
    fecha_seleccion 
  } = req.body;

  if (isNaN(parseInt(id_ubicacion))) {
    return res.status(400).json({ error: 'El ID de la ubicación debe ser un número entero válido.' });
  }
  if (Object.keys(req.body).length === 0) {
     return res.status(400).json({ error: 'Se requiere al menos un campo para actualizar.' });
  }
  // ... (Validaciones adicionales como en POST si es necesario) ...
  if (id_usuario !== undefined && isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'Si se proporciona, id_usuario debe ser un número.' });
  }
  if ((latitud !== undefined && isNaN(parseFloat(latitud))) || (longitud !== undefined && isNaN(parseFloat(longitud)))) {
    return res.status(400).json({ error: 'Latitud y longitud deben ser números válidos.' });
  }
   if (fecha_seleccion && isNaN(new Date(fecha_seleccion).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_seleccion inválido.' });
  }

  // Construcción dinámica de la consulta UPDATE
  let updateFields = [];
  let queryParams = [];
  let paramIndex = 1;

  if (id_usuario !== undefined) {
    updateFields.push(`id_usuario = $${paramIndex++}`);
    queryParams.push(id_usuario);
  }
  if (ciudad !== undefined) {
    updateFields.push(`ciudad = $${paramIndex++}`);
    queryParams.push(ciudad);
  }
  if (departamento !== undefined) {
    updateFields.push(`departamento = $${paramIndex++}`);
    queryParams.push(departamento);
  }
  if (pais !== undefined) {
    updateFields.push(`pais = $${paramIndex++}`);
    queryParams.push(pais);
  }
  if (latitud !== undefined) {
    updateFields.push(`latitud = $${paramIndex++}`);
    queryParams.push(parseFloat(latitud));
  }
  if (longitud !== undefined) {
    updateFields.push(`longitud = $${paramIndex++}`);
    queryParams.push(parseFloat(longitud));
  }
  if (fecha_seleccion !== undefined) {
    updateFields.push(`fecha_seleccion = $${paramIndex++}`);
    queryParams.push(fecha_seleccion);
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar.'});
  }

  queryParams.push(id_ubicacion);
  const updateQuery = `UPDATE ubicaciones_usuario SET ${updateFields.join(', ')} WHERE id_ubicacion = $${paramIndex} RETURNING *`;
  
  try {
    const ubicacionActualQuery = await db.query('SELECT * FROM ubicaciones_usuario WHERE id_ubicacion = $1', [id_ubicacion]);
    if (ubicacionActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Ubicación de usuario no encontrada para actualizar.' });
    }
        
    const result = await db.query(updateQuery, queryParams);
    const ubicacionActualizada = result.rows[0];

    let responseUbicacion = { ...ubicacionActualizada };
    if (ubicacionActualizada.id_usuario) {
        const usuarioInfoQuery = `SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1`;
        const usuarioInfo = await db.query(usuarioInfoQuery, [ubicacionActualizada.id_usuario]);
        if (usuarioInfo.rows.length > 0) {
            responseUbicacion.nombre_usuario = usuarioInfo.rows[0].nombre;
            responseUbicacion.apellido_usuario = usuarioInfo.rows[0].apellido;
            responseUbicacion.email_usuario = usuarioInfo.rows[0].email;
        }
    }
    res.status(200).json(responseUbicacion);

  } catch (error) {
    console.error(`Error al actualizar ubicación de usuario ${id_ubicacion}:`, error);
    console.error('CONSULTA EJECUTADA (ubicaciones_usuario PUT):', updateQuery, queryParams);
    if (error.code === '23503' && id_usuario !== undefined) {
      return res.status(400).json({ error: 'El nuevo usuario especificado para la ubicación no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/ubicaciones-usuario/:id_ubicacion - Eliminar una ubicación de usuario
router.delete('/:id_ubicacion', async (req, res) => {
  const { id_ubicacion } = req.params;
   if (isNaN(parseInt(id_ubicacion))) {
    return res.status(400).json({ error: 'El ID de la ubicación debe ser un número entero válido.' });
  }

  const deleteQuery = 'DELETE FROM ubicaciones_usuario WHERE id_ubicacion = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_ubicacion]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Ubicación de usuario no encontrada para borrar.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error(`Error al borrar ubicación de usuario ${id_ubicacion}:`, error);
    console.error('CONSULTA EJECUTADA (ubicaciones_usuario DELETE):', deleteQuery, [id_ubicacion]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
