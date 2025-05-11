// routes/mensajes.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/mensajes - Obtener todos los mensajes
// Filtros opcionales: id_emisor, id_receptor, id_producto, respondido (true/false)
// ¡IMPORTANTE: Esta ruta debe estar protegida y filtrar mensajes según el usuario autenticado o rol (admin)!
router.get('/', async (req, res) => {
  const { id_emisor, id_receptor, id_producto, respondido } = req.query;
  // const requestingUserId = req.user.id; // Para lógica de autorización

  let queryText = `
    SELECT 
      m.id_mensaje, m.id_emisor, m.id_receptor, m.id_producto, 
      m.mensaje, m.respuesta, m.fecha_envio, m.fecha_respuesta,
      emisor.nombre AS nombre_emisor,         -- CORREGIDO
      emisor.apellido AS apellido_emisor,     -- AÑADIDO
      emisor.email AS email_emisor,           -- AÑADIDO
      receptor.nombre AS nombre_receptor,     -- CORREGIDO
      receptor.apellido AS apellido_receptor, -- AÑADIDO
      receptor.email AS email_receptor,       -- AÑADIDO
      p.titulo AS nombre_producto             -- CORREGIDO (asumiendo 'titulo' en productos)
    FROM mensajes m
    LEFT JOIN usuarios emisor ON m.id_emisor = emisor.id_usuario
    LEFT JOIN usuarios receptor ON m.id_receptor = receptor.id_usuario
    LEFT JOIN productos p ON m.id_producto = p.id_producto 
  `;
  const queryParams = [];
  const conditions = [];
  let paramIndex = 1;

  // Lógica de autorización de ejemplo (descomentar y adaptar con tu sistema de auth):
  // if (req.user && !req.user.isAdmin) {
  //   conditions.push(`(m.id_emisor = $${paramIndex} OR m.id_receptor = $${paramIndex + 1})`);
  //   queryParams.push(req.user.id, req.user.id);
  //   paramIndex += 2;
  // }


  if (id_emisor) {
    if (isNaN(parseInt(id_emisor))) return res.status(400).json({ error: 'id_emisor debe ser un número.' });
    conditions.push(`m.id_emisor = $${paramIndex++}`);
    queryParams.push(id_emisor);
  }
  if (id_receptor) {
    if (isNaN(parseInt(id_receptor))) return res.status(400).json({ error: 'id_receptor debe ser un número.' });
    conditions.push(`m.id_receptor = $${paramIndex++}`);
    queryParams.push(id_receptor);
  }
  if (id_producto) {
    if (isNaN(parseInt(id_producto))) return res.status(400).json({ error: 'id_producto debe ser un número.' });
    conditions.push(`m.id_producto = $${paramIndex++}`);
    queryParams.push(id_producto);
  }
  if (respondido !== undefined) {
    if (respondido !== 'true' && respondido !== 'false') return res.status(400).json({ error: 'respondido debe ser "true" o "false".' });
    conditions.push(respondido === 'true' ? 'm.respuesta IS NOT NULL' : 'm.respuesta IS NULL');
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND ');
  }
  queryText += ' ORDER BY m.fecha_envio DESC';

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    console.error('CONSULTA EJECUTADA (mensajes GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/mensajes/:id_mensaje - Obtener un mensaje específico por su ID
// ¡IMPORTANTE: Verificar que el usuario autenticado sea emisor, receptor o admin!
router.get('/:id_mensaje', async (req, res) => {
  const { id_mensaje } = req.params;
  if (isNaN(parseInt(id_mensaje))) {
    return res.status(400).json({ error: 'El ID del mensaje debe ser un número entero válido.' });
  }

  // const requestingUserId = req.user.id; // Para autorización

  const queryText = `
      SELECT 
        m.*, 
        emisor.nombre AS nombre_emisor,         -- CORREGIDO
        emisor.apellido AS apellido_emisor,     -- AÑADIDO
        emisor.email AS email_emisor,           -- AÑADIDO
        receptor.nombre AS nombre_receptor,     -- CORREGIDO
        receptor.apellido AS apellido_receptor, -- AÑADIDO
        receptor.email AS email_receptor,       -- AÑADIDO
        p.titulo AS nombre_producto             -- CORREGIDO
      FROM mensajes m
      LEFT JOIN usuarios emisor ON m.id_emisor = emisor.id_usuario
      LEFT JOIN usuarios receptor ON m.id_receptor = receptor.id_usuario
      LEFT JOIN productos p ON m.id_producto = p.id_producto
      WHERE m.id_mensaje = $1
    `;
  try {
    const result = await db.query(queryText, [id_mensaje]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mensaje no encontrado.' });
    }
    // Lógica de autorización aquí
    // if (req.user && result.rows[0].id_emisor !== requestingUserId && result.rows[0].id_receptor !== requestingUserId && !req.user.isAdmin) {
    //    return res.status(403).json({ error: 'No autorizado para ver este mensaje.' });
    // }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener mensaje ${id_mensaje}:`, error);
    console.error('CONSULTA EJECUTADA (mensajes GET /:id_mensaje):', queryText, [id_mensaje]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/mensajes - Enviar un nuevo mensaje
router.post('/', async (req, res) => {
  const { id_emisor, id_receptor, id_producto, mensaje } = req.body;
  // const authenticatedUserId = req.user.id; // El id_emisor debería ser el usuario autenticado

  if (id_emisor === undefined /*|| parseInt(id_emisor) !== authenticatedUserId */ || 
      id_receptor === undefined || !mensaje) {
    return res.status(400).json({ error: 'id_emisor (autenticado), id_receptor y mensaje son requeridos.' });
  }
  if (isNaN(parseInt(id_emisor)) || isNaN(parseInt(id_receptor))) {
    return res.status(400).json({ error: 'id_emisor y id_receptor deben ser números enteros válidos.' });
  }
  if (id_producto !== undefined && id_producto !== null && isNaN(parseInt(id_producto))) {
    return res.status(400).json({ error: 'Si se proporciona, id_producto debe ser un número entero válido o null.' });
  }
  if (parseInt(id_emisor) === parseInt(id_receptor)) {
      return res.status(400).json({ error: 'El emisor y el receptor no pueden ser el mismo usuario.' });
  }
  
  const insertQuery = `
      INSERT INTO mensajes (id_emisor, id_receptor, id_producto, mensaje) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *`;
  const values = [id_emisor, id_receptor, id_producto === undefined ? null : id_producto, mensaje];

  try {
    const result = await db.query(insertQuery, values);
    const nuevoMensaje = result.rows[0];

    // Enriquecer la respuesta con nombres
    let responseMensaje = { ...nuevoMensaje };
    const emisorInfo = await db.query('SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1', [nuevoMensaje.id_emisor]);
    if (emisorInfo.rows.length > 0) {
        responseMensaje.nombre_emisor = emisorInfo.rows[0].nombre;
        responseMensaje.apellido_emisor = emisorInfo.rows[0].apellido;
        responseMensaje.email_emisor = emisorInfo.rows[0].email;
    }
    const receptorInfo = await db.query('SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1', [nuevoMensaje.id_receptor]);
     if (receptorInfo.rows.length > 0) {
        responseMensaje.nombre_receptor = receptorInfo.rows[0].nombre;
        responseMensaje.apellido_receptor = receptorInfo.rows[0].apellido;
        responseMensaje.email_receptor = receptorInfo.rows[0].email;
    }
    if (nuevoMensaje.id_producto) {
        const productoInfo = await db.query('SELECT titulo FROM productos WHERE id_producto = $1', [nuevoMensaje.id_producto]);
        if (productoInfo.rows.length > 0) {
            responseMensaje.nombre_producto = productoInfo.rows[0].titulo;
        }
    }
    res.status(201).json(responseMensaje);
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    console.error('CONSULTA EJECUTADA (mensajes POST):', insertQuery, values);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El emisor, receptor o producto especificado no existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// PUT /api/mensajes/:id_mensaje/respuesta - Responder a un mensaje
router.put('/:id_mensaje/respuesta', async (req, res) => {
  const { id_mensaje } = req.params;
  const { respuesta } = req.body;
  // const replierId = req.user.id; // Usuario autenticado que responde

  if (isNaN(parseInt(id_mensaje))) {
    return res.status(400).json({ error: 'El ID del mensaje debe ser un número entero válido.' });
  }
  if (!respuesta) {
    return res.status(400).json({ error: 'El campo respuesta es requerido.' });
  }

  const updateQuery = `
      UPDATE mensajes 
      SET respuesta = $1, fecha_respuesta = CURRENT_TIMESTAMP 
      WHERE id_mensaje = $2 AND respuesta IS NULL 
      RETURNING *`; // 'AND respuesta IS NULL' es opcional, para evitar sobrescribir respuestas.
  const values = [respuesta, id_mensaje];

  try {
    const mensajeOriginalQuery = await db.query('SELECT id_receptor FROM mensajes WHERE id_mensaje = $1', [id_mensaje]);
    if (mensajeOriginalQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Mensaje original no encontrado.' });
    }
    // Lógica de autorización:
    // const mensajeOriginal = mensajeOriginalQuery.rows[0];
    // if (replierId !== mensajeOriginal.id_receptor /* && !req.user.isAdmin */) {
    //   return res.status(403).json({ error: "No autorizado para responder a este mensaje." });
    // }
        
    const result = await db.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mensaje no encontrado o ya respondido (si se aplicó lógica para no sobrescribir).' });
    }
    
    // Enriquecer la respuesta
    const mensajeRespondido = result.rows[0];
    let responseMensaje = { ...mensajeRespondido };
    // ... (similar al POST, obtener info de emisor, receptor, producto) ...
    // (Simplificado aquí, pero podrías añadir la misma lógica de enriquecimiento que en POST)
    const emisorInfo = await db.query('SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1', [mensajeRespondido.id_emisor]);
    if (emisorInfo.rows.length > 0) {
        responseMensaje.nombre_emisor = emisorInfo.rows[0].nombre;
        responseMensaje.apellido_emisor = emisorInfo.rows[0].apellido;
    }
    const receptorInfo = await db.query('SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1', [mensajeRespondido.id_receptor]);
     if (receptorInfo.rows.length > 0) {
        responseMensaje.nombre_receptor = receptorInfo.rows[0].nombre;
        responseMensaje.apellido_receptor = receptorInfo.rows[0].apellido;
    }
    if (mensajeRespondido.id_producto) {
        const productoInfo = await db.query('SELECT titulo FROM productos WHERE id_producto = $1', [mensajeRespondido.id_producto]);
        if (productoInfo.rows.length > 0) {
            responseMensaje.nombre_producto = productoInfo.rows[0].titulo;
        }
    }
    res.status(200).json(responseMensaje);

  } catch (error) {
    console.error(`Error al responder al mensaje ${id_mensaje}:`, error);
    console.error('CONSULTA EJECUTADA (mensajes PUT respuesta):', updateQuery, values);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/mensajes/:id_mensaje - Eliminar un mensaje
router.delete('/:id_mensaje', async (req, res) => {
  const { id_mensaje } = req.params;
  // const deleterId = req.user.id; // Para autorización

  if (isNaN(parseInt(id_mensaje))) {
    return res.status(400).json({ error: 'El ID del mensaje debe ser un número entero válido.' });
  }
  
  // Lógica de autorización aquí...

  const deleteQuery = 'DELETE FROM mensajes WHERE id_mensaje = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_mensaje]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Mensaje no encontrado para borrar.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error(`Error al borrar mensaje ${id_mensaje}:`, error);
    console.error('CONSULTA EJECUTADA (mensajes DELETE):', deleteQuery, [id_mensaje]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
