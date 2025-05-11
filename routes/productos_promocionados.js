// routes/productos_promocionados.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/productos-promocionados - Obtener todas las relaciones producto-promoción
// Filtros opcionales: id_producto, id_promocion
router.get('/', async (req, res) => {
  const { id_producto, id_promocion } = req.query;

  let queryText = `
    SELECT 
      pp.id_producto, 
      pp.id_promocion,
      p.titulo AS nombre_producto,  -- <<< CORREGIDO (de productos)
      p.precio AS precio_original_producto,
      pr.titulo AS nombre_promocion, -- <<< CORREGIDO (de promociones)
      pr.descripcion AS descripcion_promocion,
      pr.descuento_porcentaje,
      pr.fecha_inicio AS promocion_fecha_inicio,
      pr.fecha_fin AS promocion_fecha_fin,
      pr.activo AS promocion_activa,
      pr.codigo_promocion
    FROM productos_promocionados pp
    JOIN productos p ON pp.id_producto = p.id_producto
    JOIN promociones pr ON pp.id_promocion = pr.id_promocion
  `;
  const queryParams = [];
  const conditions = [];
  let paramIndex = 1;

  if (id_producto) {
    if (isNaN(parseInt(id_producto))) return res.status(400).json({ error: 'id_producto debe ser un número.' });
    conditions.push(`pp.id_producto = $${paramIndex++}`);
    queryParams.push(id_producto);
  }
  if (id_promocion) {
    if (isNaN(parseInt(id_promocion))) return res.status(400).json({ error: 'id_promocion debe ser un número.' });
    conditions.push(`pp.id_promocion = $${paramIndex++}`);
    queryParams.push(id_promocion);
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND ');
  }
  queryText += ' ORDER BY pp.id_producto ASC, pp.id_promocion ASC';

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos promocionados:', error);
    console.error('CONSULTA EJECUTADA (productos_promocionados GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/productos-promocionados/producto/:id_producto - Obtener todas las promociones de un producto
router.get('/producto/:id_producto', async (req, res) => {
  const { id_producto } = req.params;
  if (isNaN(parseInt(id_producto))) {
    return res.status(400).json({ error: 'El ID del producto debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        pp.id_promocion,
        pr.titulo AS nombre_promocion, -- <<< CORREGIDO (de promociones)
        pr.descripcion AS descripcion_promocion,
        pr.descuento_porcentaje,
        pr.fecha_inicio AS promocion_fecha_inicio,
        pr.fecha_fin AS promocion_fecha_fin,
        pr.activo AS promocion_activa,
        pr.codigo_promocion
      FROM productos_promocionados pp
      JOIN promociones pr ON pp.id_promocion = pr.id_promocion
      WHERE pp.id_producto = $1
      ORDER BY pr.titulo ASC
    `;
  try {
    const result = await db.query(queryText, [id_producto]);
    res.status(200).json(result.rows); 
  } catch (error) {
    console.error(`Error al obtener promociones para el producto ${id_producto}:`, error);
    console.error('CONSULTA EJECUTADA (productos_promocionados GET /producto/:id_producto):', queryText, [id_producto]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/productos-promocionados/promocion/:id_promocion - Obtener todos los productos de una promoción
router.get('/promocion/:id_promocion', async (req, res) => {
  const { id_promocion } = req.params;
  if (isNaN(parseInt(id_promocion))) {
    return res.status(400).json({ error: 'El ID de la promoción debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        pp.id_producto,
        p.titulo AS nombre_producto, -- <<< CORREGIDO (de productos)
        p.descripcion AS descripcion_producto,
        p.precio AS precio_original_producto
      FROM productos_promocionados pp
      JOIN productos p ON pp.id_producto = p.id_producto
      WHERE pp.id_promocion = $1
      ORDER BY p.titulo ASC
    `;
  try {
    const result = await db.query(queryText, [id_promocion]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(`Error al obtener productos para la promoción ${id_promocion}:`, error);
    console.error('CONSULTA EJECUTADA (productos_promocionados GET /promocion/:id_promocion):', queryText, [id_promocion]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/productos-promocionados - Asociar un producto a una promoción
router.post('/', async (req, res) => {
  const { id_producto, id_promocion } = req.body;

  if (id_producto === undefined || id_promocion === undefined) {
    return res.status(400).json({ error: 'id_producto y id_promocion son requeridos.' });
  }
  if (isNaN(parseInt(id_producto)) || isNaN(parseInt(id_promocion))) {
    return res.status(400).json({ error: 'id_producto y id_promocion deben ser números enteros válidos.' });
  }

  const insertQuery = `
      INSERT INTO productos_promocionados (id_producto, id_promocion) 
      VALUES ($1, $2) 
      RETURNING *`;
  const values = [id_producto, id_promocion];
  
  try {
    const result = await db.query(insertQuery, values);
    // Para enriquecer la respuesta, podrías hacer JOINs o consultas adicionales aquí,
    // pero para una tabla de unión simple, devolver la asociación creada es suficiente.
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al asociar producto con promoción:', error);
    console.error('CONSULTA EJECUTADA (productos_promocionados POST):', insertQuery, values);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El producto o la promoción especificada no existe.' });
    }
    if (error.code === '23505') { 
      return res.status(409).json({ error: 'Este producto ya está asociado a esta promoción.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/productos-promocionados - Desasociar un producto de una promoción
// Se esperan id_producto e id_promocion en el cuerpo de la solicitud
router.delete('/', async (req, res) => {
  const { id_producto, id_promocion } = req.body; 

  if (id_producto === undefined || id_promocion === undefined) {
    return res.status(400).json({ error: 'id_producto y id_promocion son requeridos en el cuerpo de la solicitud para eliminar la asociación.' });
  }
  if (isNaN(parseInt(id_producto)) || isNaN(parseInt(id_promocion))) {
    return res.status(400).json({ error: 'id_producto y id_promocion deben ser números enteros válidos.' });
  }

  const deleteQuery = 'DELETE FROM productos_promocionados WHERE id_producto = $1 AND id_promocion = $2 RETURNING *';
  const values = [id_producto, id_promocion];
  try {
    const result = await db.query(deleteQuery, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Asociación producto-promoción no encontrada para borrar.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error('Error al desasociar producto de promoción:', error);
    console.error('CONSULTA EJECUTADA (productos_promocionados DELETE):', deleteQuery, values);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
