// routes/direcciones.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/direcciones - Obtener todas las direcciones
// Opcionalmente, filtrar por id_usuario: /api/direcciones?id_usuario=X
router.get('/', async (req, res) => {
  const { id_usuario } = req.query;
  let queryText = `
    SELECT 
      d.id_direccion, d.id_usuario, d.direccion, d.ciudad, 
      d.departamento, d.codigo_postal, d.pais,
      u.nombre AS nombre_usuario,         -- CORREGIDO
      u.apellido AS apellido_usuario,     -- AÑADIDO
      u.email AS email_usuario           -- AÑADIDO (opcional)
    FROM direcciones d
    LEFT JOIN usuarios u ON d.id_usuario = u.id_usuario
  `;
  const queryParams = [];

  if (id_usuario) {
    if (isNaN(parseInt(id_usuario))) {
      return res.status(400).json({ error: 'El id_usuario debe ser un número entero válido.' });
    }
    queryText += ' WHERE d.id_usuario = $1';
    queryParams.push(id_usuario);
    queryText += ' ORDER BY d.id_direccion ASC';
  } else {
    queryText += ' ORDER BY d.id_usuario ASC, d.id_direccion ASC';
  }

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener direcciones:', error);
    console.error('CONSULTA EJECUTADA (direcciones GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/direcciones/:id_direccion - Obtener una dirección específica por su ID
router.get('/:id_direccion', async (req, res) => {
  const { id_direccion } = req.params;
  if (isNaN(parseInt(id_direccion))) {
    return res.status(400).json({ error: 'El ID de la dirección debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        d.id_direccion, d.id_usuario, d.direccion, d.ciudad, 
        d.departamento, d.codigo_postal, d.pais,
        u.nombre AS nombre_usuario,         -- CORREGIDO
        u.apellido AS apellido_usuario,     -- AÑADIDO
        u.email AS email_usuario           -- AÑADIDO (opcional)
      FROM direcciones d
      LEFT JOIN usuarios u ON d.id_usuario = u.id_usuario
      WHERE d.id_direccion = $1
    `;
  try {
    const result = await db.query(queryText, [id_direccion]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener dirección ${id_direccion}:`, error);
    console.error('CONSULTA EJECUTADA (direcciones GET /:id_direccion):', queryText, [id_direccion]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/direcciones - Crear una nueva dirección para un usuario
router.post('/', async (req, res) => {
  const { id_usuario, direccion, ciudad, departamento, codigo_postal, pais } = req.body;

  if (id_usuario === undefined || !direccion || !ciudad || !pais) {
    return res.status(400).json({ error: 'id_usuario, direccion, ciudad y país son requeridos.' });
  }
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El id_usuario debe ser un número entero válido.' });
  }

  const insertQuery = `
      INSERT INTO direcciones (id_usuario, direccion, ciudad, departamento, codigo_postal, pais) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`;
  const values = [id_usuario, direccion, ciudad, departamento || null, codigo_postal || null, pais];
  
  try {
    const result = await db.query(insertQuery, values);
    const nuevaDireccion = result.rows[0];

    // Enriquecer la respuesta con datos del usuario
    let responseDireccion = { ...nuevaDireccion };
    if (nuevaDireccion.id_usuario) {
        const usuarioInfoQuery = `SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1`;
        const usuarioInfo = await db.query(usuarioInfoQuery, [nuevaDireccion.id_usuario]);
        if (usuarioInfo.rows.length > 0) {
            responseDireccion.nombre_usuario = usuarioInfo.rows[0].nombre;
            responseDireccion.apellido_usuario = usuarioInfo.rows[0].apellido;
            responseDireccion.email_usuario = usuarioInfo.rows[0].email;
        }
    }
    res.status(201).json(responseDireccion);

  } catch (error) {
    console.error('Error al crear dirección:', error);
    console.error('CONSULTA EJECUTADA (direcciones POST):', insertQuery, values);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El usuario especificado no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/direcciones/:id_direccion - Actualizar una dirección existente
router.put('/:id_direccion', async (req, res) => {
  const { id_direccion } = req.params;
  const { id_usuario, direccion, ciudad, departamento, codigo_postal, pais } = req.body;

  if (isNaN(parseInt(id_direccion))) {
    return res.status(400).json({ error: 'El ID de la dirección debe ser un número entero válido.' });
  }

  if (id_usuario === undefined && direccion === undefined && ciudad === undefined && departamento === undefined && 
      codigo_postal === undefined && pais === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos un campo para actualizar.' });
  }
  if (id_usuario !== undefined && isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'Si se proporciona, el id_usuario debe ser un número entero válido.' });
  }

  // Construcción dinámica de la consulta UPDATE
  let updateFields = [];
  let queryParams = [];
  let paramIndex = 1;

  if (id_usuario !== undefined) {
    updateFields.push(`id_usuario = $${paramIndex++}`);
    queryParams.push(id_usuario);
  }
  if (direccion !== undefined) {
    updateFields.push(`direccion = $${paramIndex++}`);
    queryParams.push(direccion);
  }
  if (ciudad !== undefined) {
    updateFields.push(`ciudad = $${paramIndex++}`);
    queryParams.push(ciudad);
  }
  if (departamento !== undefined) {
    updateFields.push(`departamento = $${paramIndex++}`);
    queryParams.push(departamento);
  }
  if (codigo_postal !== undefined) {
    updateFields.push(`codigo_postal = $${paramIndex++}`);
    queryParams.push(codigo_postal);
  }
  if (pais !== undefined) {
    updateFields.push(`pais = $${paramIndex++}`);
    queryParams.push(pais);
  }

  if (updateFields.length === 0) { // Aunque ya se validó arriba, es una doble seguridad
    return res.status(400).json({ error: 'No hay campos válidos para actualizar.' });
  }

  queryParams.push(id_direccion); // Para la cláusula WHERE
  const updateQuery = `UPDATE direcciones SET ${updateFields.join(', ')} WHERE id_direccion = $${paramIndex} RETURNING *`;

  try {
    const direccionActualQuery = await db.query('SELECT * FROM direcciones WHERE id_direccion = $1', [id_direccion]);
    if (direccionActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Dirección no encontrada para actualizar.' });
    }
    
    const result = await db.query(updateQuery, queryParams);
    const direccionActualizada = result.rows[0];

    // Enriquecer la respuesta con datos del usuario
    let responseDireccion = { ...direccionActualizada };
    if (direccionActualizada.id_usuario) {
        const usuarioInfoQuery = `SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1`;
        const usuarioInfo = await db.query(usuarioInfoQuery, [direccionActualizada.id_usuario]);
        if (usuarioInfo.rows.length > 0) {
            responseDireccion.nombre_usuario = usuarioInfo.rows[0].nombre;
            responseDireccion.apellido_usuario = usuarioInfo.rows[0].apellido;
            responseDireccion.email_usuario = usuarioInfo.rows[0].email;
        }
    }
    res.status(200).json(responseDireccion);

  } catch (error) {
    console.error(`Error al actualizar dirección ${id_direccion}:`, error);
    console.error('CONSULTA EJECUTADA (direcciones PUT):', updateQuery, queryParams);
    if (error.code === '23503' && id_usuario !== undefined) { 
      return res.status(400).json({ error: 'El nuevo usuario especificado para la dirección no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/direcciones/:id_direccion - Eliminar una dirección
router.delete('/:id_direccion', async (req, res) => {
  const { id_direccion } = req.params;
  if (isNaN(parseInt(id_direccion))) {
    return res.status(400).json({ error: 'El ID de la dirección debe ser un número entero válido.' });
  }

  const deleteQuery = 'DELETE FROM direcciones WHERE id_direccion = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_direccion]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Dirección no encontrada para borrar.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error(`Error al borrar dirección ${id_direccion}:`, error);
    console.error('CONSULTA EJECUTADA (direcciones DELETE):', deleteQuery, [id_direccion]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
