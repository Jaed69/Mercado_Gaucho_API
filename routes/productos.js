// routes/productos.js
const express = require('express');
const router = express.Router();
const db = require('../db_config');

// GET /api/productos - Obtener todos los productos (con datos básicos de vendedor y categoría)
router.get('/', async (req, res) => {
  try {
    // Query un poco más compleja para traer nombres en lugar de solo IDs
    const queryText = `
        SELECT
            p.id_producto, p.titulo, p.precio, p.stock, p.estado, p.fecha_publicacion,
            u.id_usuario AS vendedor_id, u.nombre AS vendedor_nombre, u.email AS vendedor_email,
            c.id_categoria, c.nombre_categoria
        FROM productos p
        LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        ORDER BY p.fecha_publicacion DESC;
    `;
    const result = await db.query(queryText);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/productos/:id - Obtener un producto por ID (con más detalle)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
      const queryText = `
        SELECT
            p.*, -- Todos los campos de producto
            u.nombre AS vendedor_nombre, u.apellido AS vendedor_apellido, u.email AS vendedor_email,
            c.nombre_categoria
        FROM productos p
        LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE p.id_producto = $1;
    `;
    const result = await db.query(queryText, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener producto ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/productos - Crear un nuevo producto
router.post('/', async (req, res) => {
  const { id_usuario, id_categoria, titulo, descripcion, precio, stock, estado } = req.body;

  // --- Validación básica --- (¡Usa express-validator en un proyecto real!)
  if (!id_usuario || !id_categoria || !titulo || precio === undefined || stock === undefined || !estado) {
    return res.status(400).json({ error: 'Faltan campos requeridos: id_usuario, id_categoria, titulo, precio, stock, estado' });
  }
  if (!['nuevo', 'usado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido. Debe ser "nuevo" o "usado"' });
  }
  // --- Fin Validación ---

  const queryText = `
    INSERT INTO productos (id_usuario, id_categoria, titulo, descripcion, precio, stock, estado)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [id_usuario, id_categoria, titulo, descripcion || null, precio, stock, estado];

  try {
    const result = await db.query(queryText, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear producto:', error);
     // Chequear error de FK (si el usuario o categoría no existen)
    if (error.code === '23503') {
        return res.status(400).json({ error: 'Error de referencia: El usuario o la categoría proporcionados no existen.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/productos/:id - Actualizar un producto existente
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  // Permitir actualizar solo ciertos campos
  const { id_categoria, titulo, descripcion, precio, stock, estado } = req.body;

  // --- Validación básica ---
  if (!id_categoria && !titulo && descripcion === undefined && precio === undefined && stock === undefined && !estado) {
    return res.status(400).json({ error: 'Se requiere al menos un campo para actualizar' });
  }
  if (estado && !['nuevo', 'usado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido. Debe ser "nuevo" o "usado"' });
  }
  // --- Fin Validación ---

  // Construir la query dinámicamente (más avanzado, pero útil)
  const fields = [];
  const values = [];
  let queryIndex = 1;

  if (id_categoria !== undefined) { fields.push(`id_categoria = $${queryIndex++}`); values.push(id_categoria); }
  if (titulo !== undefined) { fields.push(`titulo = $${queryIndex++}`); values.push(titulo); }
  if (descripcion !== undefined) { fields.push(`descripcion = $${queryIndex++}`); values.push(descripcion); }
  if (precio !== undefined) { fields.push(`precio = $${queryIndex++}`); values.push(precio); }
  if (stock !== undefined) { fields.push(`stock = $${queryIndex++}`); values.push(stock); }
  if (estado !== undefined) { fields.push(`estado = $${queryIndex++}`); values.push(estado); }

  if (fields.length === 0) {
       return res.status(400).json({ error: 'Ningún campo válido proporcionado para actualizar.' });
  }

  values.push(id); // Añadir el ID del producto al final para el WHERE

  const queryText = `
    UPDATE productos
    SET ${fields.join(', ')}
    WHERE id_producto = $${queryIndex}
    RETURNING *;
  `;

  try {
    const result = await db.query(queryText, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado para actualizar' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al actualizar producto ${id}:`, error);
     if (error.code === '23503') { // Si se intenta poner un id_categoria que no existe
        return res.status(400).json({ error: 'Error de referencia: La categoría proporcionada no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/productos/:id - Borrar un producto
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Considera borrar en cascada imágenes, detalles de carrito, etc. si es necesario
    // O manejarlo en la definición de la BD con ON DELETE CASCADE
    const result = await db.query('DELETE FROM productos WHERE id_producto = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado para borrar' });
    }
    res.status(204).send();
  } catch (error) {
    // Podría fallar si el producto está en una orden, etc. y hay restricciones FK
    console.error(`Error al borrar producto ${id}:`, error);
     if (error.code === '23503') {
        return res.status(409).json({ error: 'Conflicto: El producto está referenciado en otras tablas (órdenes, carritos, etc.).' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
