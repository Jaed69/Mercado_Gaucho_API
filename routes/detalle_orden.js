// routes/detalle_orden.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/detalle_orden - Obtener todos los detalles de órdenes
// Opcionalmente, filtrar por id_orden: /api/detalle_orden?id_orden=X
router.get('/', async (req, res) => {
  const { id_orden } = req.query;
  let queryText = `
    SELECT 
      dod.id_detalle, 
      dod.id_orden, 
      dod.id_producto, 
      dod.cantidad, 
      dod.precio_unitario,
      p.titulo AS nombre_producto,                -- <<< CORREGIDO AQUÍ
      p.descripcion AS descripcion_producto,
      o.id_usuario                              -- Opcional: para saber a qué usuario pertenece la orden
    FROM detalle_orden dod
    LEFT JOIN productos p ON dod.id_producto = p.id_producto 
    LEFT JOIN ordenes o ON dod.id_orden = o.id_orden     -- Opcional: Join con ordenes
  `;
  const queryParams = [];

  if (id_orden) {
    if (isNaN(parseInt(id_orden))) {
      return res.status(400).json({ error: 'El id_orden debe ser un número entero válido.' });
    }
    queryText += ' WHERE dod.id_orden = $1';
    queryParams.push(id_orden);
    queryText += ' ORDER BY dod.id_detalle ASC';
  } else {
    queryText += ' ORDER BY dod.id_orden ASC, dod.id_detalle ASC';
  }

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener detalles de orden:', error);
    console.error('CONSULTA EJECUTADA (detalle_orden GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/detalle_orden/:id_detalle - Obtener un detalle de orden específico por su ID
router.get('/:id_detalle', async (req, res) => {
  const { id_detalle } = req.params;
  if (isNaN(parseInt(id_detalle))) {
    return res.status(400).json({ error: 'El ID del detalle de orden debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        dod.id_detalle, 
        dod.id_orden, 
        dod.id_producto, 
        dod.cantidad, 
        dod.precio_unitario,
        p.titulo AS nombre_producto,               -- <<< CORREGIDO AQUÍ
        p.descripcion AS descripcion_producto,
        o.id_usuario                             -- Opcional
      FROM detalle_orden dod
      LEFT JOIN productos p ON dod.id_producto = p.id_producto
      LEFT JOIN ordenes o ON dod.id_orden = o.id_orden    -- Opcional
      WHERE dod.id_detalle = $1
    `;
  try {
    const result = await db.query(queryText, [id_detalle]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Detalle de orden no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener detalle de orden ${id_detalle}:`, error);
    console.error('CONSULTA EJECUTADA (detalle_orden GET /:id_detalle):', queryText, [id_detalle]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/detalle_orden - Crear un nuevo item en el detalle de una orden
router.post('/', async (req, res) => {
  const { id_orden, id_producto, cantidad, precio_unitario } = req.body;

  if (id_orden === undefined || id_producto === undefined || cantidad === undefined || precio_unitario === undefined) {
    return res.status(400).json({ error: 'id_orden, id_producto, cantidad y precio_unitario son requeridos.' });
  }
  if (isNaN(parseInt(id_orden)) || isNaN(parseInt(id_producto)) || isNaN(parseInt(cantidad)) || isNaN(parseFloat(precio_unitario))) {
    return res.status(400).json({ error: 'id_orden, id_producto, cantidad deben ser números. precio_unitario debe ser un número decimal.' });
  }
  if (parseInt(cantidad) <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser mayor que cero.' });
  }
  if (parseFloat(precio_unitario) < 0) {
    return res.status(400).json({ error: 'El precio_unitario no puede ser negativo.' });
  }

  const insertQuery = `
      INSERT INTO detalle_orden (id_orden, id_producto, cantidad, precio_unitario) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *`;
  const values = [id_orden, id_producto, cantidad, precio_unitario];

  try {
    const result = await db.query(insertQuery, values);
    const nuevoDetalle = result.rows[0];
    
    let responseDetalle = { ...nuevoDetalle };
    if (nuevoDetalle.id_producto) {
        const productoInfoQuery = `SELECT titulo, descripcion FROM productos WHERE id_producto = $1`; // Usando 'titulo'
        const productoInfo = await db.query(productoInfoQuery, [nuevoDetalle.id_producto]);
        if (productoInfo.rows.length > 0) {
            responseDetalle.nombre_producto = productoInfo.rows[0].titulo; // <<< CORREGIDO AQUÍ
            responseDetalle.descripcion_producto = productoInfo.rows[0].descripcion;
        }
    }

    res.status(201).json(responseDetalle);

  } catch (error) {
    console.error('Error al crear detalle de orden:', error);
    console.error('CONSULTA EJECUTADA (detalle_orden POST):', insertQuery, values);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'La orden o el producto especificado no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/detalle_orden/:id_detalle - Actualizar un item del detalle de una orden
router.put('/:id_detalle', async (req, res) => {
  const { id_detalle } = req.params;
  const { cantidad, precio_unitario } = req.body; // Solo permitir actualizar cantidad y precio_unitario

  if (isNaN(parseInt(id_detalle))) {
    return res.status(400).json({ error: 'El ID del detalle de orden debe ser un número entero válido.' });
  }

  if (cantidad === undefined && precio_unitario === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos cantidad o precio_unitario para actualizar.' });
  }
  if (cantidad !== undefined && (isNaN(parseInt(cantidad)) || parseInt(cantidad) <= 0)) {
    return res.status(400).json({ error: 'La cantidad debe ser un número entero mayor que cero.' });
  }
  if (precio_unitario !== undefined && (isNaN(parseFloat(precio_unitario)) || parseFloat(precio_unitario) < 0)) {
    return res.status(400).json({ error: 'El precio_unitario debe ser un número no negativo.' });
  }

  // Construir la consulta de actualización dinámicamente
  let updateFields = [];
  let queryParams = [];
  let paramIndex = 1;

  if (cantidad !== undefined) {
    updateFields.push(`cantidad = $${paramIndex++}`);
    queryParams.push(cantidad);
  }
  if (precio_unitario !== undefined) {
    updateFields.push(`precio_unitario = $${paramIndex++}`);
    queryParams.push(precio_unitario);
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar.' });
  }

  queryParams.push(id_detalle); // Para la cláusula WHERE
  const updateQuery = `UPDATE detalle_orden SET ${updateFields.join(', ')} WHERE id_detalle = $${paramIndex} RETURNING *`;

  try {
    const detalleActualQuery = await db.query('SELECT * FROM detalle_orden WHERE id_detalle = $1', [id_detalle]);
    if (detalleActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Detalle de orden no encontrado para actualizar.' });
    }
        
    const result = await db.query(updateQuery, queryParams);
    const detalleActualizado = result.rows[0];

    let responseDetalle = { ...detalleActualizado };
    if (detalleActualizado.id_producto) {
        const productoInfoQuery = `SELECT titulo, descripcion FROM productos WHERE id_producto = $1`; // Usando 'titulo'
        const productoInfo = await db.query(productoInfoQuery, [detalleActualizado.id_producto]);
        if (productoInfo.rows.length > 0) {
            responseDetalle.nombre_producto = productoInfo.rows[0].titulo; // <<< CORREGIDO AQUÍ
            responseDetalle.descripcion_producto = productoInfo.rows[0].descripcion;
        }
    }
    
    res.status(200).json(responseDetalle);

  } catch (error) {
    console.error(`Error al actualizar detalle de orden ${id_detalle}:`, error);
    console.error('CONSULTA EJECUTADA (detalle_orden PUT):', updateQuery, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/detalle_orden/:id_detalle - Eliminar un item del detalle de una orden
router.delete('/:id_detalle', async (req, res) => {
  const { id_detalle } = req.params;
   if (isNaN(parseInt(id_detalle))) {
    return res.status(400).json({ error: 'El ID del detalle de orden debe ser un número entero válido.' });
  }

  const deleteQuery = 'DELETE FROM detalle_orden WHERE id_detalle = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_detalle]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Detalle de orden no encontrado para borrar.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error(`Error al borrar detalle de orden ${id_detalle}:`, error);
    console.error('CONSULTA EJECUTADA (detalle_orden DELETE):', deleteQuery, [id_detalle]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
