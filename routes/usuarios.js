// routes/usuarios.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario
// const bcrypt = require('bcryptjs'); // DESCOMENTA e INSTALA (npm install bcryptjs) para hashear contraseñas

// GET /api/usuarios - Obtener todos los usuarios (¡MUY RESTRINGIDO - SOLO ADMIN!)
router.get('/', async (req, res) => {
  // ¡¡¡ IMPLEMENTAR AUTORIZACIÓN DE ADMINISTRADOR AQUÍ !!!
  try {
    const queryText = `
      SELECT id_usuario, nombre, apellido, email, telefono, 
             fecha_creacion, tipo_usuario, tipo_cuenta 
      FROM usuarios 
      ORDER BY apellido ASC, nombre ASC
    `;
    const result = await db.query(queryText);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    console.error('CONSULTA EJECUTADA (usuarios GET /):', queryText);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/usuarios/:id_usuario - Obtener un usuario específico por su ID
router.get('/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }
  // ¡¡¡ IMPLEMENTAR AUTORIZACIÓN (Admin o usuario propio) !!!
  const queryText = `
    SELECT id_usuario, nombre, apellido, email, telefono, 
           fecha_creacion, tipo_usuario, tipo_cuenta 
    FROM usuarios 
    WHERE id_usuario = $1
  `;
  try {
    const result = await db.query(queryText, [id_usuario]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (usuarios GET /:id_usuario):', queryText, [id_usuario]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/usuarios - Crear un nuevo usuario (Registro)
router.post('/', async (req, res) => {
  const {
    nombre,
    apellido,
    email,
    telefono,
    password, 
    tipo_usuario, 
    tipo_cuenta   
  } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
  }
  if (password.length < 6) { 
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.'});
  }

  let contrasenaHasheada;
  try {
    // ¡¡¡ IMPLEMENTAR BCRYPTJS O ARGON2 PARA HASHEAR CONTRASEÑAS ANTES DE PRODUCCIÓN !!!
    // const salt = await bcrypt.genSalt(10);
    // contrasenaHasheada = await bcrypt.hash(password, salt);
    
    contrasenaHasheada = password; // Temporalmente inseguro
    if (contrasenaHasheada.length > 60) { 
        return res.status(400).json({ error: 'La contraseña procesada es demasiado larga (max 60 char).' });
    }
  } catch (hashError) {
    console.error('Error al hashear contraseña:', hashError);
    return res.status(500).json({ error: 'Error interno al procesar la contraseña.' });
  }
  
  const insertQuery = `
      INSERT INTO usuarios (nombre, apellido, email, telefono, contraseña_hash, tipo_usuario, tipo_cuenta)
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id_usuario, nombre, apellido, email, telefono, fecha_creacion, tipo_usuario, tipo_cuenta`;
  const values = [
        nombre || null,
        apellido || null,
        email.toLowerCase(), 
        telefono || null,
        contrasenaHasheada, 
        tipo_usuario || 'comprador', 
        tipo_cuenta || 'personal'
      ];

  try {
    const result = await db.query(insertQuery, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    console.error('CONSULTA EJECUTADA (usuarios POST):', insertQuery);
    console.error('VALORES ENVIADOS A LA CONSULTA:', values);
    if (error.code === '23505' && error.constraint === 'usuarios_email_key') {
      return res.status(409).json({ error: 'El email proporcionado ya está registrado.' });
    }
    if (error.message && (error.message.includes('invalid input value for enum tipo_usuario_enum') || error.message.includes('invalid input value for enum tipo_cuenta_enum'))) {
        return res.status(400).json({ error: 'Valor proporcionado para tipo_usuario o tipo_cuenta no es válido.' });
    }
    // Si el error es por 'contraseña_hash' no existe, el log lo mostrará,
    // pero el cambio en el nombre de la columna en INSERT debería arreglarlo.
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message, codigo_db: error.code });
  }
});

// PUT /api/usuarios/:id_usuario - Actualizar un usuario existente
router.put('/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }
  // ¡¡¡ IMPLEMENTAR AUTORIZACIÓN !!!

  const {
    nombre,
    apellido,
    email, 
    telefono,
    tipo_usuario, 
    tipo_cuenta   
  } = req.body;

  if (Object.keys(req.body).filter(key => key !== 'password' && key !== 'contrasena_hash' && key !== 'contraseña_hash').length === 0) {
     return res.status(400).json({ error: 'Se requiere al menos un campo para actualizar (sin incluir contraseña).' });
  }

  let updateFields = [];
  let queryParams = [];
  let paramIndex = 1;

  if (nombre !== undefined) {
    updateFields.push(`nombre = $${paramIndex++}`);
    queryParams.push(nombre);
  }
  if (apellido !== undefined) {
    updateFields.push(`apellido = $${paramIndex++}`);
    queryParams.push(apellido);
  }
  if (email !== undefined) {
    updateFields.push(`email = $${paramIndex++}`);
    queryParams.push(email.toLowerCase());
  }
  if (telefono !== undefined) {
    updateFields.push(`telefono = $${paramIndex++}`);
    queryParams.push(telefono);
  }
  if (tipo_usuario !== undefined) {
    updateFields.push(`tipo_usuario = $${paramIndex++}`);
    queryParams.push(tipo_usuario);
  }
  if (tipo_cuenta !== undefined) {
    updateFields.push(`tipo_cuenta = $${paramIndex++}`);
    queryParams.push(tipo_cuenta);
  }
  
  if (updateFields.length === 0) {
     return res.status(400).json({ error: 'No hay campos válidos para actualizar.'});
  }

  queryParams.push(id_usuario);
  const updateQuery = `
    UPDATE usuarios 
    SET ${updateFields.join(', ')} 
    WHERE id_usuario = $${paramIndex} 
    RETURNING id_usuario, nombre, apellido, email, telefono, fecha_creacion, tipo_usuario, tipo_cuenta`;

  try {
    const usuarioActualQuery = await db.query('SELECT id_usuario FROM usuarios WHERE id_usuario = $1', [id_usuario]);
    if (usuarioActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado para actualizar.' });
    }
        
    const result = await db.query(updateQuery, queryParams);
    res.status(200).json(result.rows[0]);

  } catch (error) {
    console.error(`Error al actualizar usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (usuarios PUT):', updateQuery, queryParams);
    if (error.code === '23505' && error.constraint === 'usuarios_email_key') {
      return res.status(409).json({ error: 'El email proporcionado ya está en uso por otro usuario.' });
    }
    if (error.message && (error.message.includes('invalid input value for enum tipo_usuario_enum') || error.message.includes('invalid input value for enum tipo_cuenta_enum'))) {
        return res.status(400).json({ error: 'Valor proporcionado para tipo_usuario o tipo_cuenta no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message, codigo_db: error.code });
  }
});

// DELETE /api/usuarios/:id_usuario - Eliminar un usuario
router.delete('/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
   // ¡¡¡ IMPLEMENTAR AUTORIZACIÓN !!!
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'El ID del usuario debe ser un número entero válido.' });
  }

  const deleteQuery = 'DELETE FROM usuarios WHERE id_usuario = $1 RETURNING id_usuario, email, nombre, apellido';
  try {
    const result = await db.query(deleteQuery, [id_usuario]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado para borrar.' });
    }
    res.status(200).json({ message: 'Usuario borrado exitosamente', usuario_borrado: result.rows[0]});
  } catch (error) {
    console.error(`Error al borrar usuario ${id_usuario}:`, error);
    console.error('CONSULTA EJECUTADA (usuarios DELETE):', deleteQuery, [id_usuario]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message, codigo_db: error.code });
  }
});

module.exports = router;
