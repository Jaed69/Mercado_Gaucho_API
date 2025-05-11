// routes/productos_destacados.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/productos-destacados - Obtener todos los productos destacados
// Filtros opcionales: tipo_destacado o si están activos actualmente
router.get('/', async (req, res) => {
  const { tipo_destacado, activos_ahora } = req.query;
  let queryText = `
    SELECT 
      pd.id_destacado, 
      pd.id_producto, 
      pd.tipo_destacado, 
      pd.fecha_inicio, 
      pd.fecha_fin,
      p.titulo AS nombre_producto,                -- <<< CORREGIDO AQUÍ
      p.descripcion AS descripcion_producto,
      p.precio AS precio_producto
    FROM productos_destacados pd
    JOIN productos p ON pd.id_producto = p.id_producto
  `;
  const queryParams = [];
  const conditions = [];
  let paramIndex = 1;

  if (tipo_destacado) {
    conditions.push(`pd.tipo_destacado = $${paramIndex++}`);
    queryParams.push(tipo_destacado);
  }
  if (activos_ahora === 'true') {
    const hoy = new Date().toISOString().slice(0, 10);
    conditions.push(`(pd.fecha_inicio <= $${paramIndex++} OR pd.fecha_inicio IS NULL)`);
    queryParams.push(hoy);
    conditions.push(`(pd.fecha_fin >= $${paramIndex++} OR pd.fecha_fin IS NULL)`);
    queryParams.push(hoy);
    // Adicionalmente, podrías querer filtrar por pd.activo si tuvieras esa columna, 
    // o implícitamente las promociones destacadas solo se muestran si están activas
    // y dentro del rango de fechas.
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND ');
  }
  queryText += ' ORDER BY pd.fecha_inicio DESC, p.titulo ASC'; // Usando p.titulo para ordenar

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos destacados:', error);
    console.error('CONSULTA EJECUTADA (productos_destacados GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/productos-destacados/:id_destacado - Obtener un registro de producto destacado
router.get('/:id_destacado', async (req, res) => {
  const { id_destacado } = req.params;
  if (isNaN(parseInt(id_destacado))) {
    return res.status(400).json({ error: 'El ID de destacado debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        pd.*, 
        p.titulo AS nombre_producto,               -- <<< CORREGIDO AQUÍ
        p.descripcion AS descripcion_producto, 
        p.precio AS precio_producto
      FROM productos_destacados pd
      JOIN productos p ON pd.id_producto = p.id_producto
      WHERE pd.id_destacado = $1
    `;
  try {
    const result = await db.query(queryText, [id_destacado]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de producto destacado no encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener producto destacado ${id_destacado}:`, error);
    console.error('CONSULTA EJECUTADA (productos_destacados GET /:id_destacado):', queryText, [id_destacado]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/productos-destacados/producto/:id_producto - Obtener el estado de destacado de un producto
router.get('/producto/:id_producto', async (req, res) => {
  const { id_producto } = req.params;
  if (isNaN(parseInt(id_producto))) {
    return res.status(400).json({ error: 'El ID del producto debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        pd.*, 
        p.titulo AS nombre_producto  -- <<< CORREGIDO AQUÍ
      FROM productos_destacados pd
      JOIN productos p ON pd.id_producto = p.id_producto
      WHERE pd.id_producto = $1
    `;
  try {
    const result = await db.query(queryText, [id_producto]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Este producto no está marcado como destacado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener estado de destacado para el producto ${id_producto}:`, error);
    console.error('CONSULTA EJECUTADA (productos_destacados GET /producto/:id_producto):', queryText, [id_producto]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/productos-destacados - Destacar un producto o actualizar su estado (UPSERT)
router.post('/', async (req, res) => {
  const { id_producto, tipo_destacado, fecha_inicio, fecha_fin } = req.body;

  if (id_producto === undefined) {
    return res.status(400).json({ error: 'id_producto es requerido.' });
  }
  if (isNaN(parseInt(id_producto))) {
    return res.status(400).json({ error: 'id_producto debe ser un número entero válido.' });
  }
  if (fecha_inicio && isNaN(new Date(fecha_inicio).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_inicio inválido. Usar YYYY-MM-DD.' });
  }
  if (fecha_fin && isNaN(new Date(fecha_fin).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_fin inválido. Usar YYYY-MM-DD.' });
  }
  if (fecha_inicio && fecha_fin && new Date(fecha_fin) < new Date(fecha_inicio)) {
    return res.status(400).json({ error: 'fecha_fin no puede ser anterior a fecha_inicio.' });
  }

  const upsertQuery = `
      INSERT INTO productos_destacados (id_producto, tipo_destacado, fecha_inicio, fecha_fin)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id_producto) 
      DO UPDATE SET 
        tipo_destacado = EXCLUDED.tipo_destacado,
        fecha_inicio = EXCLUDED.fecha_inicio,
        fecha_fin = EXCLUDED.fecha_fin
      RETURNING *;
    `;
  const values = [id_producto, tipo_destacado || null, fecha_inicio || null, fecha_fin || null];
  
  try {
    const result = await db.query(upsertQuery, values);
    let featuredProduct = result.rows[0];

    if (featuredProduct.id_producto) {
        const productInfoQuery = `SELECT titulo, descripcion, precio FROM productos WHERE id_producto = $1`; // Usando 'titulo'
        const productInfo = await db.query(productInfoQuery, [featuredProduct.id_producto]);
        if (productInfo.rows.length > 0) {
            featuredProduct.nombre_producto = productInfo.rows[0].titulo; // <<< CORREGIDO AQUÍ
            featuredProduct.descripcion_producto = productInfo.rows[0].descripcion;
            featuredProduct.precio_producto = productInfo.rows[0].precio;
        }
    }
    res.status(200).json(featuredProduct); 
  } catch (error) {
    console.error('Error al destacar producto:', error);
    console.error('CONSULTA EJECUTADA (productos_destacados POST):', upsertQuery, values);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El producto especificado no existe.' });
    }
    if (error.message && error.message.includes('invalid input value for enum destacado_tipo_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para tipo_destacado no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/productos-destacados/:id_destacado - Actualizar un registro de producto destacado
router.put('/:id_destacado', async (req, res) => {
  const { id_destacado } = req.params;
  const { tipo_destacado, fecha_inicio, fecha_fin } = req.body;
  // id_producto no se actualiza aquí para mantener la lógica del UPSERT por id_producto en POST.

  if (isNaN(parseInt(id_destacado))) {
    return res.status(400).json({ error: 'El ID de destacado debe ser un número entero válido.' });
  }
  if (tipo_destacado === undefined && fecha_inicio === undefined && fecha_fin === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos un campo (tipo_destacado, fecha_inicio, fecha_fin) para actualizar.' });
  }
  // ... (Validaciones de fecha como en POST) ...
  if (fecha_inicio && isNaN(new Date(fecha_inicio).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_inicio inválido. Usar YYYY-MM-DD.' });
  }
  if (fecha_fin && isNaN(new Date(fecha_fin).getTime())) {
    return res.status(400).json({ error: 'Formato de fecha_fin inválido. Usar YYYY-MM-DD.' });
  }
   if (fecha_inicio && fecha_fin && new Date(fecha_fin) < new Date(fecha_inicio)) {
    // Necesitaríamos las fechas originales para validar completamente si solo una se actualiza
    // Por simplicidad, esta validación se aplica si ambas son provistas.
  }


  // Construcción dinámica de la consulta UPDATE
  let updateFields = [];
  let queryParams = [];
  let paramIndex = 1;

  if (tipo_destacado !== undefined) {
    updateFields.push(`tipo_destacado = $${paramIndex++}`);
    queryParams.push(tipo_destacado);
  }
  if (fecha_inicio !== undefined) {
    updateFields.push(`fecha_inicio = $${paramIndex++}`);
    queryParams.push(fecha_inicio);
  }
  if (fecha_fin !== undefined) {
    updateFields.push(`fecha_fin = $${paramIndex++}`);
    queryParams.push(fecha_fin);
  }

  if (updateFields.length === 0) {
     return res.status(400).json({ error: 'No hay campos válidos para actualizar.'});
  }

  queryParams.push(id_destacado);
  const updateQuery = `UPDATE productos_destacados SET ${updateFields.join(', ')} WHERE id_destacado = $${paramIndex} RETURNING *`;
  
  try {
    const actualQuery = await db.query('SELECT * FROM productos_destacados WHERE id_destacado = $1', [id_destacado]);
    if (actualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de producto destacado no encontrado para actualizar.' });
    }
        
    const result = await db.query(updateQuery, queryParams);
    let featuredProduct = result.rows[0];

    if (featuredProduct.id_producto) {
        const productInfoQuery = `SELECT titulo, descripcion, precio FROM productos WHERE id_producto = $1`;
        const productInfo = await db.query(productInfoQuery, [featuredProduct.id_producto]);
        if (productInfo.rows.length > 0) {
            featuredProduct.nombre_producto = productInfo.rows[0].titulo; // <<< CORREGIDO AQUÍ
            featuredProduct.descripcion_producto = productInfo.rows[0].descripcion;
            featuredProduct.precio_producto = productInfo.rows[0].precio;
        }
    }
    res.status(200).json(featuredProduct);

  } catch (error) {
    console.error(`Error al actualizar producto destacado ${id_destacado}:`, error);
    console.error('CONSULTA EJECUTADA (productos_destacados PUT):', updateQuery, queryParams);
    if (error.message && error.message.includes('invalid input value for enum destacado_tipo_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para tipo_destacado no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/productos-destacados/:id_destacado - Eliminar un registro de producto destacado
router.delete('/:id_destacado', async (req, res) => {
  const { id_destacado } = req.params;
  if (isNaN(parseInt(id_destacado))) {
    return res.status(400).json({ error: 'El ID de destacado debe ser un número entero válido.' });
  }
  const deleteQuery = 'DELETE FROM productos_destacados WHERE id_destacado = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_destacado]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro de producto destacado no encontrado para borrar.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(`Error al borrar producto destacado ${id_destacado}:`, error);
    console.error('CONSULTA EJECUTADA (productos_destacados DELETE /:id_destacado):', deleteQuery, [id_destacado]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/productos-destacados/producto/:id_producto - Quitar un producto de destacados
router.delete('/producto/:id_producto', async (req, res) => {
  const { id_producto } = req.params;
   if (isNaN(parseInt(id_producto))) {
    return res.status(400).json({ error: 'El ID del producto debe ser un número entero válido.' });
  }
  const deleteQuery = 'DELETE FROM productos_destacados WHERE id_producto = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_producto]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Producto no estaba marcado como destacado o no encontrado.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(`Error al quitar producto ${id_producto} de destacados:`, error);
    console.error('CONSULTA EJECUTADA (productos_destacados DELETE /producto/:id_producto):', deleteQuery, [id_producto]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
