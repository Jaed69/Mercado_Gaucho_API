// routes/carrito_detalle.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/carrito_detalle - Obtener todos los detalles de carritos
// Opcionalmente, filtrar por id_carrito: /api/carrito_detalle?id_carrito=X
router.get('/', async (req, res) => {
  const { id_carrito } = req.query;
  let queryText = `
    SELECT 
      cd.id_detalle, 
      cd.id_carrito, 
      cd.id_producto, 
      cd.cantidad, 
      p.titulo AS nombre_producto,  -- <<< CORREGIDO AQUÍ
      p.precio AS precio_unitario_actual_producto
    FROM carrito_detalle cd
    LEFT JOIN productos p ON cd.id_producto = p.id_producto 
  `;
  const queryParams = [];

  if (id_carrito) {
    if (isNaN(parseInt(id_carrito))) {
      return res.status(400).json({ error: 'El id_carrito debe ser un número.' });
    }
    queryText += ' WHERE cd.id_carrito = $1';
    queryParams.push(id_carrito);
    queryText += ' ORDER BY cd.id_detalle ASC';
  } else {
    queryText += ' ORDER BY cd.id_carrito ASC, cd.id_detalle ASC';
  }

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener detalles de carrito:', error);
    console.error('CONSULTA EJECUTADA (carrito_detalle GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/carrito_detalle/:id_detalle - Obtener un item específico del detalle del carrito por su ID
router.get('/:id_detalle', async (req, res) => {
  const { id_detalle } = req.params;
  if (isNaN(parseInt(id_detalle))) {
      return res.status(400).json({ error: 'El ID del detalle debe ser un número entero válido.' });
  }

  const queryText = `
    SELECT 
      cd.id_detalle, 
      cd.id_carrito, 
      cd.id_producto, 
      cd.cantidad,
      p.titulo AS nombre_producto, -- <<< CORREGIDO AQUÍ
      p.precio AS precio_unitario_actual_producto
    FROM carrito_detalle cd
    LEFT JOIN productos p ON cd.id_producto = p.id_producto
    WHERE cd.id_detalle = $1
  `;
  try {
    const result = await db.query(queryText, [id_detalle]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item de detalle de carrito no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener item de detalle de carrito ${id_detalle}:`, error);
    console.error('CONSULTA EJECUTADA (carrito_detalle GET /:id_detalle):', queryText, [id_detalle]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/carrito_detalle - Agregar un producto a un carrito o actualizar su cantidad si ya existe
router.post('/', async (req, res) => {
  const { id_carrito, id_producto, cantidad } = req.body;

  if (!id_carrito || !id_producto || cantidad === undefined) {
    return res.status(400).json({ error: 'id_carrito, id_producto y cantidad son requeridos.' });
  }
  if (isNaN(parseInt(id_carrito)) || isNaN(parseInt(id_producto)) || isNaN(parseInt(cantidad))) {
    return res.status(400).json({ error: 'id_carrito, id_producto y cantidad deben ser números.' });
  }
  if (parseInt(cantidad) <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser mayor que cero.' });
  }

  const upsertQuery = `
      INSERT INTO carrito_detalle (id_carrito, id_producto, cantidad)
      VALUES ($1, $2, $3)
      ON CONFLICT (id_carrito, id_producto)
      DO UPDATE SET cantidad = carrito_detalle.cantidad + EXCLUDED.cantidad 
      RETURNING *; 
    `;
  try {
    const result = await db.query(upsertQuery, [id_carrito, id_producto, cantidad]);
    
    const detalleCreadoActualizado = result.rows[0];
    const finalResultQuery = await db.query(`
        SELECT 
          cd.id_detalle, cd.id_carrito, cd.id_producto, cd.cantidad,
          p.titulo AS nombre_producto, -- <<< CORREGIDO AQUÍ
          p.precio AS precio_unitario_actual_producto
        FROM carrito_detalle cd
        LEFT JOIN productos p ON cd.id_producto = p.id_producto
        WHERE cd.id_detalle = $1
    `, [detalleCreadoActualizado.id_detalle]);

    res.status(200).json(finalResultQuery.rows[0]);

  } catch (error) {
    console.error('Error al agregar/actualizar item en carrito:', error);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El carrito o producto especificado no existe.' });
    }
    console.error('CONSULTA EJECUTADA (carrito_detalle POST):', upsertQuery, [id_carrito, id_producto, cantidad]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/carrito_detalle/:id_detalle - Actualizar la cantidad de un item específico
router.put('/:id_detalle', async (req, res) => {
  const { id_detalle } = req.params;
  const { cantidad } = req.body;

  if (isNaN(parseInt(id_detalle))) {
      return res.status(400).json({ error: 'El ID del detalle debe ser un número entero válido.' });
  }
  if (cantidad === undefined) {
    return res.status(400).json({ error: 'La cantidad es requerida.' });
  }
  if (isNaN(parseInt(cantidad)) || parseInt(cantidad) <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un número entero mayor que cero.' });
  }

  const updateQuery = 'UPDATE carrito_detalle SET cantidad = $1 WHERE id_detalle = $2 RETURNING *';
  try {
    const result = await db.query(updateQuery, [cantidad, id_detalle]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item de detalle de carrito no encontrado para actualizar.' });
    }

    const detalleActualizado = result.rows[0];
    const finalResultQuery = await db.query(`
        SELECT 
          cd.id_detalle, cd.id_carrito, cd.id_producto, cd.cantidad,
          p.titulo AS nombre_producto, -- <<< CORREGIDO AQUÍ
          p.precio AS precio_unitario_actual_producto
        FROM carrito_detalle cd
        LEFT JOIN productos p ON cd.id_producto = p.id_producto
        WHERE cd.id_detalle = $1
    `, [detalleActualizado.id_detalle]);
    
    res.status(200).json(finalResultQuery.rows[0]);
  } catch (error) {
    console.error(`Error al actualizar item de detalle ${id_detalle}:`, error);
    console.error('CONSULTA EJECUTADA (carrito_detalle PUT):', updateQuery, [cantidad, id_detalle]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/carrito_detalle/:id_detalle - Eliminar un item del detalle del carrito
router.delete('/:id_detalle', async (req, res) => {
  const { id_detalle } = req.params;
  if (isNaN(parseInt(id_detalle))) {
      return res.status(400).json({ error: 'El ID del detalle debe ser un número entero válido.' });
  }

  const deleteQuery = 'DELETE FROM carrito_detalle WHERE id_detalle = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_detalle]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item de detalle de carrito no encontrado para borrar.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error(`Error al borrar item de detalle ${id_detalle}:`, error);
    console.error('CONSULTA EJECUTADA (carrito_detalle DELETE):', deleteQuery, [id_detalle]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
