// routes/usuarios.js
const express = require('express');
const router = express.Router();
const db = require('../db_config');

// GET /api/usuarios - Obtener todos los usuarios (datos limitados)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT id_usuario, nombre, apellido, email, tipo_usuario, tipo_cuenta, fecha_creacion FROM usuarios ORDER BY id_usuario');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/usuarios/:id - Obtener un usuario por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT id_usuario, nombre, apellido, email, telefono, tipo_usuario, tipo_cuenta, fecha_creacion FROM usuarios WHERE id_usuario = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener usuario ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/usuarios - Crear un nuevo usuario (¡SIN HASHING AÚN!)
router.post('/', async (req, res) => {
  const { nombre, apellido, email, telefono, contraseña_hash, tipo_usuario, tipo_cuenta } = req.body;

  // --- Validación básica ---
  if (!nombre || !apellido || !email || !contraseña_hash) { // Contraseña hash requerida por ahora
    return res.status(400).json({ error: 'Faltan campos requeridos: nombre, apellido, email, contraseña_hash' });
  }
  // Validar enums si se envían, si no, usarán DEFAULT
  // --- Fin Validación ---

  // !! IMPORTANTE: Aquí deberías HASHEAR la contraseña antes de guardarla usando bcrypt !!
  // const hashedPassword = await bcrypt.hash(contraseña_enviada, 10); // Ejemplo conceptual

  const queryText = `
    INSERT INTO usuarios (nombre, apellido, email, telefono, contraseña_hash, tipo_usuario, tipo_cuenta)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id_usuario, nombre, apellido, email, tipo_usuario, tipo_cuenta, fecha_creacion; -- No devolver hash
  `;
  const values = [
      nombre,
      apellido,
      email,
      telefono || null,
      contraseña_hash, // ¡Debería ser el hash real!
      tipo_usuario || 'comprador', // Usa default si no se envía
      tipo_cuenta || 'personal'   // Usa default si no se envía
    ];

  try {
    const result = await db.query(queryText, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    if (error.code === '23505') { // Error de violación de unicidad (ej. email)
         return res.status(409).json({ error: 'Conflicto: El email ya está registrado.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/usuarios/:id - Actualizar un usuario (¡SIN HASHING AÚN!)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  // Campos que se pueden actualizar (ejemplo, no permitir cambiar email o contraseña aquí quizás)
  const { nombre, apellido, telefono, tipo_usuario, tipo_cuenta } = req.body;

  // Construir query dinámica similar a la de productos
  const fields = [];
  const values = [];
  let queryIndex = 1;

  if (nombre !== undefined) { fields.push(`nombre = $${queryIndex++}`); values.push(nombre); }
  if (apellido !== undefined) { fields.push(`apellido = $${queryIndex++}`); values.push(apellido); }
  if (telefono !== undefined) { fields.push(`telefono = $${queryIndex++}`); values.push(telefono); }
  if (tipo_usuario !== undefined) { fields.push(`tipo_usuario = $${queryIndex++}`); values.push(tipo_usuario); } // Validar enum
  if (tipo_cuenta !== undefined) { fields.push(`tipo_cuenta = $${queryIndex++}`); values.push(tipo_cuenta); }   // Validar enum

  if (fields.length === 0) {
       return res.status(400).json({ error: 'Ningún campo válido proporcionado para actualizar.' });
  }

  values.push(id); // ID para el WHERE

  const queryText = `
    UPDATE usuarios
    SET ${fields.join(', ')}
    WHERE id_usuario = $${queryIndex}
    RETURNING id_usuario, nombre, apellido, email, tipo_usuario, tipo_cuenta, fecha_creacion;
  `;

  try {
    const result = await db.query(queryText, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado para actualizar' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al actualizar usuario ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/usuarios/:id - Borrar un usuario
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // ON DELETE CASCADE/SET NULL en otras tablas manejará las referencias
    const result = await db.query('DELETE FROM usuarios WHERE id_usuario = $1 RETURNING id_usuario, email', [id]);
     if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado para borrar' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(`Error al borrar usuario ${id}:`, error);
     if (error.code === '23503') {
        return res.status(409).json({ error: 'Conflicto: El usuario está referenciado en otras tablas importantes.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


module.exports = router;
