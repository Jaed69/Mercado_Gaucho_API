// routes/envios.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/envios - Obtener todos los registros de envío
// Podría ser útil para administración, o con filtros más avanzados.
router.get('/', async (req, res) => {
  try {
    // Ejemplo: Unir con ordenes para obtener id_usuario y fecha_orden para contexto
    const result = await db.query(`
      SELECT e.*, o.id_usuario, o.fecha_orden 
      FROM envios e
      JOIN ordenes o ON e.id_orden = o.id_orden
      ORDER BY o.fecha_orden DESC, e.id_envio DESC
    `); // Asumiendo que 'ordenes' tiene 'id_usuario' y 'fecha_orden'
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener todos los envíos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/envios/:id_envio - Obtener un registro de envío por su ID
router.get('/:id_envio', async (req, res) => {
  const { id_envio } = req.params;
  if (isNaN(parseInt(id_envio))) {
    return res.status(400).json({ error: 'El ID del envío debe ser un número entero válido.' });
  }

  try {
    const result = await db.query(`
      SELECT e.*, o.id_usuario, o.fecha_orden
      FROM envios e
      JOIN ordenes o ON e.id_orden = o.id_orden
      WHERE e.id_envio = $1
    `, [id_envio]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de envío no encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener envío ${id_envio}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/envios/orden/:id_orden - Obtener el registro de envío de una orden específica
router.get('/orden/:id_orden', async (req, res) => {
  const { id_orden } = req.params;
  if (isNaN(parseInt(id_orden))) {
    return res.status(400).json({ error: 'El ID de la orden debe ser un número entero válido.' });
  }

  try {
    const result = await db.query('SELECT * FROM envios WHERE id_orden = $1', [id_orden]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de envío no encontrado para esta orden.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener envío para la orden ${id_orden}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/envios - Crear un nuevo registro de envío para una orden
router.post('/', async (req, res) => {
  const {
    id_orden,
    direccion_entrega,
    metodo_envio,
    estado_envio, // Opcional, default 'preparando'
    fecha_envio,  // Opcional
    costo_envio,  // Opcional, default 0.00
    numero_seguimiento // Opcional
  } = req.body;

  if (id_orden === undefined || !direccion_entrega || !metodo_envio) {
    return res.status(400).json({ error: 'id_orden, direccion_entrega y metodo_envio son requeridos.' });
  }
  if (isNaN(parseInt(id_orden))) {
    return res.status(400).json({ error: 'El id_orden debe ser un número entero válido.' });
  }
  if (costo_envio !== undefined && isNaN(parseFloat(costo_envio))) {
    return res.status(400).json({ error: 'El costo_envio debe ser un número.' });
  }
  if (fecha_envio && isNaN(new Date(fecha_envio).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_envio inválido.' });
  }
  // Validación para estado_envio (enum) la hará la BD.
  // Podrías agregar una lista de valores válidos aquí si el frontend no la maneja.

  try {
    const result = await db.query(
      `INSERT INTO envios (id_orden, direccion_entrega, metodo_envio, estado_envio, fecha_envio, costo_envio, numero_seguimiento)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id_orden,
        direccion_entrega,
        metodo_envio,
        estado_envio || 'preparando', // Usa el default si no se provee
        fecha_envio || null,
        costo_envio !== undefined ? costo_envio : 0.00, // Usa el default si no se provee
        numero_seguimiento || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear registro de envío:', error);
    if (error.code === '23503') { // Violación de Foreign Key (id_orden no existe)
      return res.status(400).json({ error: 'La orden especificada no existe.' });
    }
    if (error.code === '23505') { // Violación de UNIQUE constraint (envio para id_orden ya existe)
      return res.status(409).json({ error: 'Ya existe un registro de envío para esta orden.' });
    }
    if (error.message && error.message.includes('invalid input value for enum envio_estado_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para estado_envio no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/envios/:id_envio - Actualizar un registro de envío
router.put('/:id_envio', async (req, res) => {
  const { id_envio } = req.params;
  if (isNaN(parseInt(id_envio))) {
    return res.status(400).json({ error: 'El ID del envío debe ser un número entero válido.' });
  }

  const {
    direccion_entrega,
    metodo_envio,
    estado_envio,
    fecha_envio,
    fecha_entrega,
    costo_envio,
    numero_seguimiento
    // id_orden no se debería cambiar para un envío existente.
  } = req.body;

  if (Object.keys(req.body).length === 0) {
     return res.status(400).json({ error: 'Se requiere al menos un campo para actualizar.' });
  }
  if (costo_envio !== undefined && isNaN(parseFloat(costo_envio))) {
    return res.status(400).json({ error: 'Si se proporciona, el costo_envio debe ser un número.' });
  }
  if (fecha_envio && isNaN(new Date(fecha_envio).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_envio inválido.' });
  }
  if (fecha_entrega && isNaN(new Date(fecha_entrega).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_entrega inválido.' });
  }
  // Validación para estado_envio (enum) la hará la BD.

  try {
    const envioActualQuery = await db.query('SELECT * FROM envios WHERE id_envio = $1', [id_envio]);
    if (envioActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de envío no encontrado para actualizar.' });
    }
    const envioActual = envioActualQuery.rows[0];

    const updatedDireccion = direccion_entrega !== undefined ? direccion_entrega : envioActual.direccion_entrega;
    const updatedMetodo = metodo_envio !== undefined ? metodo_envio : envioActual.metodo_envio;
    const updatedEstado = estado_envio !== undefined ? estado_envio : envioActual.estado_envio;
    const updatedFechaEnvio = fecha_envio !== undefined ? fecha_envio : envioActual.fecha_envio;
    const updatedFechaEntrega = fecha_entrega !== undefined ? fecha_entrega : envioActual.fecha_entrega;
    const updatedCosto = costo_envio !== undefined ? costo_envio : envioActual.costo_envio;
    const updatedSeguimiento = numero_seguimiento !== undefined ? numero_seguimiento : envioActual.numero_seguimiento;

    const result = await db.query(
      `UPDATE envios 
       SET direccion_entrega = $1, metodo_envio = $2, estado_envio = $3, fecha_envio = $4, 
           fecha_entrega = $5, costo_envio = $6, numero_seguimiento = $7
       WHERE id_envio = $8 RETURNING *`,
      [updatedDireccion, updatedMetodo, updatedEstado, updatedFechaEnvio, updatedFechaEntrega, updatedCosto, updatedSeguimiento, id_envio]
    );
    
    res.status(200).json(result.rows[0]);

  } catch (error) {
    console.error(`Error al actualizar envío ${id_envio}:`, error);
    if (error.message && error.message.includes('invalid input value for enum envio_estado_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para estado_envio no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/envios/:id_envio - Eliminar un registro de envío
router.delete('/:id_envio', async (req, res) => {
  const { id_envio } = req.params;
   if (isNaN(parseInt(id_envio))) {
    return res.status(400).json({ error: 'El ID del envío debe ser un número entero válido.' });
  }

  try {
    // La FK en envios con ON DELETE CASCADE desde ordenes se encarga si la orden se borra.
    // Esto es para borrar explícitamente el registro de envío.
    const result = await db.query('DELETE FROM envios WHERE id_envio = $1 RETURNING *', [id_envio]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro de envío no encontrado para borrar.' });
    }
    res.status(204).send(); // No Content
  } catch (error) {
    console.error(`Error al borrar envío ${id_envio}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
