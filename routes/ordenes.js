// routes/ordenes.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/ordenes - Obtener todas las órdenes
// Filtros opcionales: id_usuario, estado, fecha_desde, fecha_hasta
router.get('/', async (req, res) => {
  const { id_usuario, estado, fecha_desde, fecha_hasta } = req.query;
  // const requestingUserId = req.user.id; // Para autorización

  let queryText = `
    SELECT 
      o.id_orden, o.id_usuario, o.fecha_orden, o.total, o.estado,
      u.nombre AS nombre_usuario,         -- CORREGIDO
      u.apellido AS apellido_usuario,     -- AÑADIDO
      u.email AS email_usuario           -- AÑADIDO
    FROM ordenes o
    LEFT JOIN usuarios u ON o.id_usuario = u.id_usuario 
  `;
  const queryParams = [];
  const conditions = [];
  let paramIndex = 1;

  // Lógica de autorización y filtros (adaptar con tu sistema de auth)
  // if (req.user && !req.user.isAdmin) {
  //   conditions.push(`o.id_usuario = $${paramIndex++}`);
  //   queryParams.push(requestingUserId);
  // } else 
  if (id_usuario) {
    if (isNaN(parseInt(id_usuario))) return res.status(400).json({ error: 'id_usuario debe ser un número.' });
    conditions.push(`o.id_usuario = $${paramIndex++}`);
    queryParams.push(id_usuario);
  }

  if (estado) {
    conditions.push(`o.estado = $${paramIndex++}`);
    queryParams.push(estado);
  }
  if (fecha_desde) {
    if (isNaN(new Date(fecha_desde).getTime())) return res.status(400).json({ error: 'Formato de fecha_desde inválido.' });
    conditions.push(`o.fecha_orden >= $${paramIndex++}`);
    queryParams.push(fecha_desde);
  }
  if (fecha_hasta) {
    if (isNaN(new Date(fecha_hasta).getTime())) return res.status(400).json({ error: 'Formato de fecha_hasta inválido.' });
    conditions.push(`o.fecha_orden <= $${paramIndex++}`);
    queryParams.push(fecha_hasta);
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND ');
  }
  queryText += ' ORDER BY o.fecha_orden DESC';

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    console.error('CONSULTA EJECUTADA (ordenes GET /):', queryText, queryParams);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// GET /api/ordenes/:id_orden - Obtener una orden específica por su ID
router.get('/:id_orden', async (req, res) => {
  const { id_orden } = req.params;
  // const requestingUserId = req.user.id; // Para autorización

  if (isNaN(parseInt(id_orden))) {
    return res.status(400).json({ error: 'El ID de la orden debe ser un número entero válido.' });
  }

  const queryText = `
      SELECT 
        o.*, 
        u.nombre AS nombre_usuario,       -- CORREGIDO
        u.apellido AS apellido_usuario,   -- AÑADIDO
        u.email AS email_usuario         -- AÑADIDO
      FROM ordenes o
      LEFT JOIN usuarios u ON o.id_usuario = u.id_usuario
      WHERE o.id_orden = $1
    `;
  try {
    const ordenQuery = await db.query(queryText, [id_orden]);

    if (ordenQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }
    let orden = ordenQuery.rows[0];
    
    // Lógica de autorización aquí...

    // Opcional: Obtener detalles de la orden (items)
    const detallesQuery = await db.query(`
      SELECT dod.*, p.titulo AS nombre_producto, p.descripcion as descripcion_producto 
      FROM detalle_orden dod 
      LEFT JOIN productos p ON dod.id_producto = p.id_producto 
      WHERE dod.id_orden = $1 ORDER BY dod.id_detalle
    `, [id_orden]); // Usando p.titulo
    orden.detalles = detallesQuery.rows;
    
    // También podrías obtener info de envío y pago aquí si lo deseas
    const envioQuery = await db.query('SELECT * FROM envios WHERE id_orden = $1', [id_orden]);
    if(envioQuery.rows.length > 0) {
        orden.envio = envioQuery.rows[0];
    }

    const pagosQuery = await db.query('SELECT * FROM pagos WHERE id_orden = $1 ORDER BY fecha_pago DESC', [id_orden]);
    orden.pagos = pagosQuery.rows;


    res.status(200).json(orden);
  } catch (error) {
    console.error(`Error al obtener orden ${id_orden}:`, error);
    console.error('CONSULTA EJECUTADA (ordenes GET /:id_orden):', queryText, [id_orden]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// POST /api/ordenes - Crear una nueva orden
router.post('/', async (req, res) => {
  const { id_usuario, total, estado, detalles } = req.body;
  // const requestingUserId = req.user.id; 
  // if (parseInt(id_usuario) !== requestingUserId && !req.user.isAdmin ) { ... }

  if (id_usuario === undefined || total === undefined) {
    return res.status(400).json({ error: 'id_usuario y total son requeridos.' });
  }
  if (isNaN(parseInt(id_usuario))) {
    return res.status(400).json({ error: 'id_usuario debe ser un número entero válido.' });
  }
  if (isNaN(parseFloat(total)) || parseFloat(total) < 0) {
    return res.status(400).json({ error: 'El total debe ser un número no negativo.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const ordenResult = await client.query(
      `INSERT INTO ordenes (id_usuario, total, estado) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [id_usuario, total, estado || 'pendiente']
    );
    let nuevaOrden = ordenResult.rows[0];

    if (detalles && Array.isArray(detalles) && detalles.length > 0) {
      for (const item of detalles) {
        if (!item.id_producto || item.cantidad === undefined || item.precio_unitario === undefined) {
          await client.query('ROLLBACK'); // Importante hacer rollback si algo falla
          return res.status(400).json({ error: 'Cada item del detalle debe tener id_producto, cantidad y precio_unitario.'});
        }
        if (isNaN(parseInt(item.id_producto)) || isNaN(parseInt(item.cantidad)) || isNaN(parseFloat(item.precio_unitario))) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'id_producto, cantidad y precio_unitario en detalles deben ser números válidos.'});
        }
        await client.query(
          `INSERT INTO detalle_orden (id_orden, id_producto, cantidad, precio_unitario)
           VALUES ($1, $2, $3, $4)`,
          [nuevaOrden.id_orden, item.id_producto, item.cantidad, item.precio_unitario]
        );
      }
    }
    // Podrías recalcular el total aquí basado en los detalles insertados para mayor seguridad.

    await client.query('COMMIT');

    // Enriquecer respuesta con info de usuario y detalles
    const usuarioInfoQuery = `SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1`;
    const usuarioInfo = await db.query(usuarioInfoQuery, [nuevaOrden.id_usuario]);
    if (usuarioInfo.rows.length > 0) {
        nuevaOrden.nombre_usuario = usuarioInfo.rows[0].nombre;
        nuevaOrden.apellido_usuario = usuarioInfo.rows[0].apellido;
        nuevaOrden.email_usuario = usuarioInfo.rows[0].email;
    }
    // Volver a cargar los detalles para la respuesta
    const detallesActuales = await db.query(`
        SELECT dod.*, p.titulo AS nombre_producto 
        FROM detalle_orden dod 
        LEFT JOIN productos p ON dod.id_producto = p.id_producto 
        WHERE dod.id_orden = $1 ORDER BY dod.id_detalle`, 
        [nuevaOrden.id_orden]
    );
    nuevaOrden.detalles = detallesActuales.rows;

    res.status(201).json(nuevaOrden);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear orden:', error);
    if (error.code === '23503') { 
      return res.status(400).json({ error: 'El usuario o uno de los productos especificados no existe.' });
    }
    if (error.message && error.message.includes('invalid input value for enum orden_estado_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para estado no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al crear orden', detalle: error.message });
  } finally {
    client.release();
  }
});

// PUT /api/ordenes/:id_orden - Actualizar el estado (u otros campos) de una orden
router.put('/:id_orden', async (req, res) => {
  const { id_orden } = req.params;
  const { estado, total } = req.body;

  if (isNaN(parseInt(id_orden))) {
    return res.status(400).json({ error: 'El ID de la orden debe ser un número entero válido.' });
  }
  if (estado === undefined && total === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos un campo (ej. estado, total) para actualizar.' });
  }
  if (total !== undefined && (isNaN(parseFloat(total)) || parseFloat(total) < 0)) {
    return res.status(400).json({ error: 'Si se proporciona, el total debe ser un número no negativo.' });
  }
  
  // Construcción dinámica de la consulta UPDATE
  let updateFields = [];
  let queryParams = [];
  let paramIndex = 1;

  if (estado !== undefined) {
    updateFields.push(`estado = $${paramIndex++}`);
    queryParams.push(estado);
  }
  if (total !== undefined) {
    updateFields.push(`total = $${paramIndex++}`);
    queryParams.push(total);
  }

  if (updateFields.length === 0) {
     return res.status(400).json({ error: 'No hay campos válidos para actualizar.'});
  }

  queryParams.push(id_orden);
  const updateQuery = `UPDATE ordenes SET ${updateFields.join(', ')} WHERE id_orden = $${paramIndex} RETURNING *`;

  try {
    const ordenActualQuery = await db.query('SELECT * FROM ordenes WHERE id_orden = $1', [id_orden]);
    if (ordenActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada para actualizar.' });
    }
        
    const result = await db.query(updateQuery, queryParams);
    let ordenActualizada = result.rows[0];

    // Enriquecer respuesta con info de usuario
    if (ordenActualizada.id_usuario) {
        const usuarioInfoQuery = `SELECT nombre, apellido, email FROM usuarios WHERE id_usuario = $1`;
        const usuarioInfo = await db.query(usuarioInfoQuery, [ordenActualizada.id_usuario]);
        if (usuarioInfo.rows.length > 0) {
            ordenActualizada.nombre_usuario = usuarioInfo.rows[0].nombre;
            ordenActualizada.apellido_usuario = usuarioInfo.rows[0].apellido;
            ordenActualizada.email_usuario = usuarioInfo.rows[0].email;
        }
    }
    res.status(200).json(ordenActualizada);

  } catch (error) {
    console.error(`Error al actualizar orden ${id_orden}:`, error);
    console.error('CONSULTA EJECUTADA (ordenes PUT):', updateQuery, queryParams);
    if (error.message && error.message.includes('invalid input value for enum orden_estado_enum')) {
        return res.status(400).json({ error: 'Valor proporcionado para estado no es válido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

// DELETE /api/ordenes/:id_orden - Eliminar una orden
router.delete('/:id_orden', async (req, res) => {
  const { id_orden } = req.params;
  if (isNaN(parseInt(id_orden))) {
    return res.status(400).json({ error: 'El ID de la orden debe ser un número entero válido.' });
  }

  const deleteQuery = 'DELETE FROM ordenes WHERE id_orden = $1 RETURNING *';
  try {
    const result = await db.query(deleteQuery, [id_orden]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Orden no encontrada para borrar.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error(`Error al borrar orden ${id_orden}:`, error);
    console.error('CONSULTA EJECUTADA (ordenes DELETE):', deleteQuery, [id_orden]);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;
