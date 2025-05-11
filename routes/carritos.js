// routes/carritos.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/carritos - Obtener todos los carritos (potencialmente para admin)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.id_carrito, 
        c.id_usuario, 
        u.nombre AS nombre_usuario,         -- CORREGIDO
        u.apellido AS apellido_usuario,     -- AÑADIDO
        u.email AS email_usuario,           -- AÑADIDO (opcional, pero útil)
        c.fecha_creacion 
      FROM carritos c
      LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
      ORDER BY c.fecha_creacion DESC
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener todos los carritos:', error);
    // Para depurar, puedes imprimir la consulta si sospechas de la construcción dinámica
    // console.error('CONSULTA EJECUTADA (carritos GET /):', TU_QUERY_TEXT_SI_ES_DINAMICA, TUS_QUERY_PARAMS_SI_LOS_HAY);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/carritos/:id_carrito - Obtener un carrito por su ID
router.get('/:id_carrito', async (req, res) => {
  const { id_carrito } = req.params;
  if (isNaN(parseInt(id_carrito))) {
    return res.status(400).json({ error: 'El ID del carrito debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        c.id_carrito, 
        c.id_usuario, 
        u.nombre AS nombre_usuario,       -- CORREGIDO
        u.apellido AS apellido_usuario,   -- AÑADIDO
        u.email AS email_usuario,         -- AÑADIDO
        c.fecha_creacion
      FROM carritos c
      LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
      WHERE c.id_carrito = $1
    `;
  try {
    const result = await db.query(queryText, [id_carrito]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carrito no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener carrito ${id_carrito}:`, error);
    console.error('CONSULTA EJECUTADA (carritos GET /:id_carrito):', queryText, [id_carrito]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/carritos/usuario/:id_usuario - Obtener el carrito de un usuario específico
router.get('/usuario/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        c.id_carrito, 
        c.id_usuario, 
        u.nombre AS nombre_usuario,       -- CORREGIDO
        u.apellido AS apellido_usuario,   -- AÑADIDO
        u.email AS email_usuario,         -- AÑADIDO
        c.fecha_creacion
      FROM carritos c
      LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario 
      WHERE c.id_usuario = $1
    `;
  try {
    const result = await db.query(queryText, [id_usuario]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carrito no encontrado para este usuario. Puede crearse uno nuevo.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener carrito para el usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (carritos GET /usuario/:id_usuario):', queryText, [id_usuario]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/carritos - Crear un nuevo carrito para un usuario (o devolver el existente)
router.post('/', async (req, res) => {
  const { id_usuario } = req.body;

  if (id_usuario === undefined) {
    return res.status(400).json({ error: 'El id_usuario es requerido.' });
  }
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El id_usuario debe ser un número entero válido.' });
  }

  const client = await db.getClient(); 
  try {
    await client.query('BEGIN');
    
    let cartQuery = 'SELECT * FROM carritos WHERE id_usuario = $1';
    let cart = await client.query(cartQuery, [id_usuario]);
    let carritoCreadoOExistente;

    if (cart.rows.length > 0) {
      carritoCreadoOExistente = cart.rows[0];
    } else {
      const resultInsert = await client.query(
        'INSERT INTO carritos (id_usuario) VALUES ($1) RETURNING *',
        [id_usuario]
      );
      carritoCreadoOExistente = resultInsert.rows[0];
    }

    // Enriquecer con info del usuario
    const queryJoin = `
        SELECT c.id_carrito, c.id_usuario, c.fecha_creacion,
               u.nombre AS nombre_usuario, u.apellido AS apellido_usuario, u.email AS email_usuario
        FROM carritos c
        LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario 
        WHERE c.id_carrito = $1
      `;
    const finalCartDetails = await client.query(queryJoin, [carritoCreadoOExistente.id_carrito]);
    
    await client.query('COMMIT');
    
    if (cart.rows.length > 0) {
        res.status(200).json({ message: 'Carrito existente recuperado.', carrito: finalCartDetails.rows[0] });
    } else {
        res.status(201).json(finalCartDetails.rows[0]);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear o recuperar carrito:', error);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El usuario especificado no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  } finally {
    client.release();
  }
});

// PUT /api/carritos/:id_carrito - Actualizar un carrito (uso limitado para este schema)
router.put('/:id_carrito', async (req, res) => {
    const { id_carrito } = req.params;
    res.status(501).json({ message: `La actualización directa del carrito ${id_carrito} no tiene campos modificables o no está implementada.` });
});

// DELETE /api/carritos/:id_carrito - Eliminar un carrito por su ID
router.delete('/:id_carrito', async (req, res) => {
  const { id_carrito } = req.params;
  if (isNaN(parseInt(id_carrito))) {
    return res.status(400).json({ error: 'El ID del carrito debe ser un número entero válido.' });
  }
  const deleteQuery = 'DELETE FROM carritos WHERE id_carrito = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_carrito]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Carrito no encontrado para borrar.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error(`Error al borrar carrito ${id_carrito}:`, error);
    console.error('CONSULTA EJECUTADA (carritos DELETE /:id_carrito):', deleteQuery, [id_carrito]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/carritos/usuario/:id_usuario - Eliminar el carrito de un usuario específico
router.delete('/usuario/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }
  const deleteQuery = 'DELETE FROM carritos WHERE id_usuario = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_usuario]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Carrito no encontrado para este usuario para borrar.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(`Error al borrar carrito del usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (carritos DELETE /usuario/:id_usuario):', deleteQuery, [id_usuario]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
