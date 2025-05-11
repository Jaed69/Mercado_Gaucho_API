// routes/pagos.js

const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Asegúrate que la ruta a tu db_config sea correcta

// GET /api/pagos - Obtener todos los registros de pago
// Filtros opcionales: id_orden, estado_pago, fecha_desde, fecha_hasta
// ¡IMPORTANTE: Proteger esta ruta adecuadamente (admin)!
router.get('/', async (req, res) => {
  const { id_orden, estado_pago, fecha_desde, fecha_hasta } = req.query;

  let queryText = `
    SELECT 
      p.id_pago, 
      p.id_orden, 
      p.metodo_pago, 
      p.monto_pagado, 
      p.fecha_pago, 
      p.estado_pago, 
      p.id_transaccion_externa,
      o.id_usuario, 
      u.nombre AS nombre_usuario,         -- Corregido
      u.apellido AS apellido_usuario,     -- Añadido
      u.email AS email_usuario           -- Añadido (opcional, pero útil)
    FROM pagos p
    JOIN ordenes o ON p.id_orden = o.id_orden
    LEFT JOIN usuarios u ON o.id_usuario = u.id_usuario 
  `; // Espacio importante al final de esta línea antes de añadir WHERE
  const queryParams = [];
  const conditions = [];
  let paramIndex = 1;

  if (id_orden) {
    if (isNaN(parseInt(id_orden))) return res.status(400).json({ error: 'id_orden debe ser un número.' });
    conditions.push(`p.id_orden = $${paramIndex++}`);
    queryParams.push(id_orden);
  }
  if (estado_pago) {
    // Aquí deberías validar contra los valores de tu pago_estado_enum si es posible
    conditions.push(`p.estado_pago = $${paramIndex++}`);
    queryParams.push(estado_pago);
  }
  if (fecha_desde) {
    if (isNaN(new Date(fecha_desde).getTime())) return res.status(400).json({ error: 'Formato de fecha_desde inválido.' });
    conditions.push(`p.fecha_pago >= $${paramIndex++}`);
    queryParams.push(fecha_desde);
  }
  if (fecha_hasta) {
    if (isNaN(new Date(fecha_hasta).getTime())) return res.status(400).json({ error: 'Formato de fecha_hasta inválido.' });
    conditions.push(`p.fecha_pago <= $${paramIndex++}`);
    queryParams.push(fecha_hasta);
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND '); // Espacio antes de WHERE es crucial
  }
  queryText += ' ORDER BY p.fecha_pago DESC, p.id_pago DESC';

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    console.error('CONSULTA SQL EJECUTADA:', queryText); // Para depurar
    console.error('PARAMETROS:', queryParams);        // Para depurar
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// ... (el resto de tus rutas para pagos.js: GET /:id_pago, POST /, PUT /:id_pago, DELETE /:id_pago) ...
// ... Asegúrate de que las correcciones para u.nombre_usuario también se apliquen en GET /:id_pago ...

// Ejemplo para GET /:id_pago (ASEGÚRATE DE INTEGRARLO CORRECTAMENTE CON TU CÓDIGO EXISTENTE)
router.get('/:id_pago', async (req, res) => {
  const { id_pago } = req.params;
  if (isNaN(parseInt(id_pago))) {
    return res.status(400).json({ error: 'El ID del pago debe ser un número entero válido.' });
  }

  try {
    const result = await db.query(`
      SELECT p.*, 
             o.id_usuario, 
             u.nombre AS nombre_usuario,      /* Corregido */
             u.apellido AS apellido_usuario,  /* Añadido */
             u.email AS email_usuario         /* Añadido */
      FROM pagos p
      JOIN ordenes o ON p.id_orden = o.id_orden
      LEFT JOIN usuarios u ON o.id_usuario = u.id_usuario
      WHERE p.id_pago = $1
    `, [id_pago]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de pago no encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener pago ${id_pago}:`, error);
    console.error('CONSULTA SQL EJECUTADA:', `SELECT p.*, o.id_usuario, u.nombre AS nombre_usuario, u.apellido AS apellido_usuario, u.email AS email_usuario FROM pagos p JOIN ordenes o ON p.id_orden = o.id_orden LEFT JOIN usuarios u ON o.id_usuario = u.id_usuario WHERE p.id_pago = $1`);
    console.error('PARAMETROS:', [id_pago]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});


// Aquí continuarían tus rutas POST, PUT, DELETE para pagos.js
// POST /api/pagos
router.post('/', async (req, res) => {
  const {
    id_orden,
    metodo_pago,
    monto_pagado,
    estado_pago,
    id_transaccion_externa,
    fecha_pago
  } = req.body;

  if (id_orden === undefined || !metodo_pago || monto_pagado === undefined) {
    return res.status(400).json({ error: 'id_orden, metodo_pago y monto_pagado son requeridos.' });
  }
  if (isNaN(parseInt(id_orden))) {
    return res.status(400).json({ error: 'id_orden debe ser un número entero válido.' });
  }
  if (isNaN(parseFloat(monto_pagado)) || parseFloat(monto_pagado) <= 0) {
    return res.status(400).json({ error: 'monto_pagado debe ser un número mayor que cero.' });
  }
  if (fecha_pago && isNaN(new Date(fecha_pago).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_pago inválido.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO pagos (id_orden, metodo_pago, monto_pagado, estado_pago, id_transaccion_externa, fecha_pago)
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        id_orden,
        metodo_pago,
        monto_pagado,
        estado_pago || 'pendiente',
        id_transaccion_externa || null,
        fecha_pago || new Date()
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al registrar pago:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'La orden especificada no existe.' });
    }
    if (error.message && error.message.includes('invalid input value for enum pago_estado_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para estado_pago no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/pagos/:id_pago
router.put('/:id_pago', async (req, res) => {
  const { id_pago } = req.params;
  const { estado_pago, id_transaccion_externa, monto_pagado, metodo_pago, fecha_pago } = req.body;

  if (isNaN(parseInt(id_pago))) {
    return res.status(400).json({ error: 'El ID del pago debe ser un número entero válido.' });
  }
  if (estado_pago === undefined && id_transaccion_externa === undefined && monto_pagado === undefined && metodo_pago === undefined && fecha_pago === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos un campo para actualizar.' });
  }
  // ... (más validaciones si es necesario) ...
  if (monto_pagado !== undefined && (isNaN(parseFloat(monto_pagado)) || parseFloat(monto_pagado) <= 0)) {
    return res.status(400).json({ error: 'Si se proporciona, monto_pagado debe ser un número mayor que cero.' });
  }
   if (fecha_pago && isNaN(new Date(fecha_pago).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_pago inválido.' });
  }


  try {
    const pagoActualQuery = await db.query('SELECT * FROM pagos WHERE id_pago = $1', [id_pago]);
    if (pagoActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de pago no encontrado para actualizar.' });
    }
    const pagoActual = pagoActualQuery.rows[0];

    const updatedEstado = estado_pago !== undefined ? estado_pago : pagoActual.estado_pago;
    const updatedTransaccion = id_transaccion_externa !== undefined ? id_transaccion_externa : pagoActual.id_transaccion_externa;
    const updatedMonto = monto_pagado !== undefined ? monto_pagado : pagoActual.monto_pagado;
    const updatedMetodo = metodo_pago !== undefined ? metodo_pago : pagoActual.metodo_pago;
    const updatedFecha = fecha_pago !== undefined ? fecha_pago : pagoActual.fecha_pago;

    const result = await db.query(
      `UPDATE pagos 
       SET estado_pago = $1, id_transaccion_externa = $2, monto_pagado = $3, metodo_pago = $4, fecha_pago = $5
       WHERE id_pago = $6 RETURNING *`,
      [updatedEstado, updatedTransaccion, updatedMonto, updatedMetodo, updatedFecha, id_pago]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al actualizar pago ${id_pago}:`, error);
    if (error.message && error.message.includes('invalid input value for enum pago_estado_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para estado_pago no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/pagos/:id_pago
router.delete('/:id_pago', async (req, res) => {
  const { id_pago } = req.params;
  if (isNaN(parseInt(id_pago))) {
    return res.status(400).json({ error: 'El ID del pago debe ser un número entero válido.' });
  }
  try {
    const result = await db.query('DELETE FROM pagos WHERE id_pago = $1 RETURNING *', [id_pago]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro de pago no encontrado para borrar.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(`Error al borrar pago ${id_pago}:`, error);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});


module.exports = router;
