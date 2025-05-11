// routes/imagenes_producto.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/imagenes-producto - Obtener todas las imágenes de productos
// Opcionalmente, filtrar por id_producto: /api/imagenes-producto?id_producto=X
router.get('/', async (req, res) => {
  const { id_producto } = req.query;
  let queryText = `
    SELECT 
      ip.id_imagen, 
      ip.id_producto, 
      ip.url_imagen, 
      ip.orden,
      p.titulo AS nombre_producto  -- <<< CORREGIDO AQUÍ
    FROM imagenes_producto ip
    JOIN productos p ON ip.id_producto = p.id_producto 
  `;
  const queryParams = [];

  if (id_producto) {
    if (isNaN(parseInt(id_producto))) {
      return res.status(400).json({ error: 'El id_producto debe ser un número entero válido.' });
    }
    queryText += ' WHERE ip.id_producto = $1';
    queryParams.push(id_producto);
    queryText += ' ORDER BY ip.orden ASC, ip.id_imagen ASC';
  } else {
    queryText += ' ORDER BY ip.id_producto ASC, ip.orden ASC, ip.id_imagen ASC';
  }

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener imágenes de producto:', error);
    console.error('CONSULTA EJECUTADA (imagenes_producto GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/imagenes-producto/:id_imagen - Obtener una imagen de producto específica por su ID
router.get('/:id_imagen', async (req, res) => {
  const { id_imagen } = req.params;
  if (isNaN(parseInt(id_imagen))) {
    return res.status(400).json({ error: 'El ID de la imagen debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        ip.id_imagen, 
        ip.id_producto, 
        ip.url_imagen, 
        ip.orden,
        p.titulo AS nombre_producto -- <<< CORREGIDO AQUÍ
      FROM imagenes_producto ip
      JOIN productos p ON ip.id_producto = p.id_producto
      WHERE ip.id_imagen = $1
    `;
  try {
    const result = await db.query(queryText, [id_imagen]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Imagen de producto no encontrada' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener imagen de producto ${id_imagen}:`, error);
    console.error('CONSULTA EJECUTADA (imagenes_producto GET /:id_imagen):', queryText, [id_imagen]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/imagenes-producto - Crear una nueva imagen para un producto
router.post('/', async (req, res) => {
  const { id_producto, url_imagen, orden } = req.body;

  if (id_producto === undefined || !url_imagen) {
    return res.status(400).json({ error: 'id_producto y url_imagen son requeridos.' });
  }
  if (isNaN(parseInt(id_producto))) {
    return res.status(400).json({ error: 'El id_producto debe ser un número entero válido.' });
  }
  if (orden !== undefined && orden !== null && isNaN(parseInt(orden))) {
    return res.status(400).json({ error: 'Si se proporciona, el campo orden debe ser un número entero.' });
  }

  const insertQuery = `
      INSERT INTO imagenes_producto (id_producto, url_imagen, orden) 
      VALUES ($1, $2, $3) 
      RETURNING *`;
  const values = [id_producto, url_imagen, orden === undefined || orden === null ? null : parseInt(orden)];
  
  try {
    const result = await db.query(insertQuery, values);
    const nuevaImagen = result.rows[0];

    let responseImagen = { ...nuevaImagen };
    if (nuevaImagen.id_producto) {
        const productoInfoQuery = `SELECT titulo FROM productos WHERE id_producto = $1`;
        const productoInfo = await db.query(productoInfoQuery, [nuevaImagen.id_producto]);
        if (productoInfo.rows.length > 0) {
            responseImagen.nombre_producto = productoInfo.rows[0].titulo; // <<< CORREGIDO AQUÍ
        }
    }
    res.status(201).json(responseImagen);

  } catch (error) {
    console.error('Error al crear imagen de producto:', error);
    console.error('CONSULTA EJECUTADA (imagenes_producto POST):', insertQuery, values);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El producto especificado no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/imagenes-producto/:id_imagen - Actualizar una imagen de producto existente
router.put('/:id_imagen', async (req, res) => {
  const { id_imagen } = req.params;
  const { id_producto, url_imagen, orden } = req.body; // Permitir cambiar id_producto (reasignar)

  if (isNaN(parseInt(id_imagen))) {
    return res.status(400).json({ error: 'El ID de la imagen debe ser un número entero válido.' });
  }

  if (id_producto === undefined && url_imagen === undefined && orden === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos un campo (id_producto, url_imagen, orden) para actualizar.' });
  }
  if (id_producto !== undefined && isNaN(parseInt(id_producto))) {
    return res.status(400).json({ error: 'Si se proporciona, el id_producto debe ser un número entero válido.' });
  }
  if (orden !== undefined && orden !== null && isNaN(parseInt(orden))) {
    return res.status(400).json({ error: 'Si se proporciona, el campo orden debe ser un número entero o null.' });
  }
  
  // Construcción dinámica de la consulta UPDATE
  let updateFields = [];
  let queryParams = [];
  let paramIndex = 1;

  if (id_producto !== undefined) {
    updateFields.push(`id_producto = $${paramIndex++}`);
    queryParams.push(id_producto);
  }
  if (url_imagen !== undefined) {
    updateFields.push(`url_imagen = $${paramIndex++}`);
    queryParams.push(url_imagen);
  }
  if (orden !== undefined) { // Permite enviar null para quitar el orden
    updateFields.push(`orden = $${paramIndex++}`);
    queryParams.push(orden === null ? null : parseInt(orden));
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar.'});
  }

  queryParams.push(id_imagen);
  const updateQuery = `UPDATE imagenes_producto SET ${updateFields.join(', ')} WHERE id_imagen = $${paramIndex} RETURNING *`;
  
  try {
    const imagenActualQuery = await db.query('SELECT * FROM imagenes_producto WHERE id_imagen = $1', [id_imagen]);
    if (imagenActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Imagen de producto no encontrada para actualizar.' });
    }
        
    const result = await db.query(updateQuery, queryParams);
    const imagenActualizada = result.rows[0];

    let responseImagen = { ...imagenActualizada };
    if (imagenActualizada.id_producto) {
        const productoInfoQuery = `SELECT titulo FROM productos WHERE id_producto = $1`;
        const productoInfo = await db.query(productoInfoQuery, [imagenActualizada.id_producto]);
        if (productoInfo.rows.length > 0) {
            responseImagen.nombre_producto = productoInfo.rows[0].titulo; // <<< CORREGIDO AQUÍ
        }
    }
    res.status(200).json(responseImagen);

  } catch (error) {
    console.error(`Error al actualizar imagen de producto ${id_imagen}:`, error);
    console.error('CONSULTA EJECUTADA (imagenes_producto PUT):', updateQuery, queryParams);
    if (error.code === '23503' && id_producto !== undefined) { 
      return res.status(400).json({ error: 'El nuevo producto especificado para la imagen no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/imagenes-producto/:id_imagen - Eliminar una imagen de producto
router.delete('/:id_imagen', async (req, res) => {
  const { id_imagen } = req.params;
  if (isNaN(parseInt(id_imagen))) {
    return res.status(400).json({ error: 'El ID de la imagen debe ser un número entero válido.' });
  }

  const deleteQuery = 'DELETE FROM imagenes_producto WHERE id_imagen = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_imagen]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Imagen de producto no encontrada para borrar.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error(`Error al borrar imagen de producto ${id_imagen}:`, error);
    console.error('CONSULTA EJECUTADA (imagenes_producto DELETE):', deleteQuery, [id_imagen]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
