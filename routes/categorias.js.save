// routes/categorias.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/categorias - Obtener todas las categorías
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categorias ORDER BY nombre_categoria');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/categorias/:id - Obtener una categoría por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM categorias WHERE id_categoria = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener categoría ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/categorias - Crear una nueva categoría
router.post('/', async (req, res) => {
  const { nombre_categoria, descripcion } = req.body;

  if (!nombre_categoria) {
    return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
  }

  try {
    const result = await db.query(
      'INSERT INTO categorias (nombre_categoria, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre_categoria, descripcion || null] // Usa null si la descripción es opcional y no se envía
    );
    res.status(201).json(result.rows[0]); // 201 Creado
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/categorias/:id - Actualizar una categoría existente
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre_categoria, descripcion } = req.body;

  if (!nombre_categoria) {
    return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
  }

  try {
    const result = await db.query(
      'UPDATE categorias SET nombre_categoria = $1, descripcion = $2 WHERE id_categoria = $3 RETURNING *',
      [nombre_categoria, descripcion || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada para actualizar' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al actualizar categoría ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/categorias/:id - Borrar una categoría
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM categorias WHERE id_categoria = $1 RETURNING *', [id]);
    if (result.rowCount === 0) { // rowCount es más fiable para DELETE
      return res.status(404).json({ error: 'Categoría no encontrada para borrar' });
    }
    // Envía 200 OK con la categoría borrada o 204 No Content
    // res.status(200).json({ message: 'Categoría borrada', categoria: result.rows[0] });
    res.status(204).send(); // 204 No Content es común para DELETE exitoso
  } catch (error) {
    // Podría fallar por restricciones de clave foránea si hay productos usando esta categoría
    // y no se configuró ON DELETE SET NULL o CASCADE
    console.error(`Error al borrar categoría ${id}:`, error);
    if (error.code === '23503') { // Código de error de violación de FK en PostgreSQL
        return res.status(409).json({ error: 'Conflicto: La categoría está siendo usada por uno o más productos.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


module.exports = router; // Exporta el router
