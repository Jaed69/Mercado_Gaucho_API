// routes/promociones.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/promociones - Obtener todas las promociones
// Filtros opcionales: activo (true/false), codigo_promocion, vigentes_ahora (true/false)
router.get('/', async (req, res) => {
  const { activo, codigo_promocion, vigentes_ahora } = req.query;

  let queryText = 'SELECT * FROM promociones';
  const queryParams = [];
  const conditions = [];
  let paramIndex = 1;

  if (activo !== undefined) {
    if (activo !== 'true' && activo !== 'false') {
      return res.status(400).json({ error: 'El parámetro activo debe ser "true" o "false".' });
    }
    conditions.push(`activo = $${paramIndex++}`);
    queryParams.push(activo === 'true');
  }
  if (codigo_promocion) {
    conditions.push(`codigo_promocion ILIKE $${paramIndex++}`); // Case-insensitive
    queryParams.push(codigo_promocion); // Búsqueda exacta, o podrías usar %codigo% para parcial
  }
  if (vigentes_ahora === 'true') {
    const hoy = new Date().toISOString().slice(0, 10); // Formato YYYY-MM-DD
    conditions.push(`(fecha_inicio <= $${paramIndex++} OR fecha_inicio IS NULL)`);
    queryParams.push(hoy);
    conditions.push(`(fecha_fin >= $${paramIndex++} OR fecha_fin IS NULL)`);
    queryParams.push(hoy);
    conditions.push(`activo = true`); // Solo considerar activas para "vigentes_ahora"
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND ');
  }
  queryText += ' ORDER BY fecha_inicio DESC, titulo ASC';

  try {
    const result = await db.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener promociones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/promociones/:id_promocion - Obtener una promoción específica por su ID
router.get('/:id_promocion', async (req, res) => {
  const { id_promocion } = req.params;
  if (isNaN(parseInt(id_promocion))) {
    return res.status(400).json({ error: 'El ID de la promoción debe ser un número entero válido.' });
  }

  try {
    const result = await db.query('SELECT * FROM promociones WHERE id_promocion = $1', [id_promocion]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promoción no encontrada.' });
    }
    const promocion = result.rows[0];

    // Opcional: Obtener productos asociados a esta promoción
    // const productosAsociados = await db.query(
    //   `SELECT p.id_producto, p.nombre_producto 
    //    FROM productos_promocionados pp 
    //    JOIN productos p ON pp.id_producto = p.id_producto 
    //    WHERE pp.id_promocion = $1`,
    //   [id_promocion]
    // );
    // promocion.productos = productosAsociados.rows;

    res.status(200).json(promocion);
  } catch (error) {
    console.error(`Error al obtener promoción ${id_promocion}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/promociones/codigo/:codigo_promocion - Obtener una promoción por su código único
router.get('/codigo/:codigo_promocion', async (req, res) => {
  const { codigo_promocion } = req.params;
  if (!codigo_promocion) {
    return res.status(400).json({ error: 'El código de promoción es requerido.' });
  }

  try {
    const result = await db.query('SELECT * FROM promociones WHERE codigo_promocion ILIKE $1 AND activo = true', [codigo_promocion]);
    // Podrías también verificar que esté dentro de fecha_inicio y fecha_fin aquí si es para aplicar la promo
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Código de promoción no válido, no encontrado o no activo.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener promoción por código ${codigo_promocion}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// POST /api/promociones - Crear una nueva promoción
router.post('/', async (req, res) => {
  const {
    titulo,
    descripcion,
    descuento_porcentaje,
    fecha_inicio, // Se espera formato 'YYYY-MM-DD'
    fecha_fin,    // Se espera formato 'YYYY-MM-DD'
    condiciones,
    codigo_promocion,
    activo
  } = req.body;

  if (!titulo) {
    return res.status(400).json({ error: 'El título de la promoción es requerido.' });
  }
  if (descuento_porcentaje !== undefined && (isNaN(parseInt(descuento_porcentaje)) || parseInt(descuento_porcentaje) < 0 || parseInt(descuento_porcentaje) > 100)) {
    return res.status(400).json({ error: 'descuento_porcentaje debe ser un número entero entre 0 y 100.' });
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

  try {
    const result = await db.query(
      `INSERT INTO promociones (titulo, descripcion, descuento_porcentaje, fecha_inicio, fecha_fin, condiciones, codigo_promocion, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        titulo,
        descripcion || null,
        descuento_porcentaje === undefined ? null : parseInt(descuento_porcentaje),
        fecha_inicio || null,
        fecha_fin || null,
        condiciones || null,
        codigo_promocion || null, // Puede ser null si no se usa código
        activo === undefined ? true : activo // Default 'true' si no se especifica
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear promoción:', error);
    if (error.code === '23505' && error.constraint === 'promociones_codigo_promocion_key') {
      return res.status(409).json({ error: 'El código de promoción ya existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/promociones/:id_promocion - Actualizar una promoción existente
router.put('/:id_promocion', async (req, res) => {
  const { id_promocion } = req.params;
  const {
    titulo,
    descripcion,
    descuento_porcentaje,
    fecha_inicio,
    fecha_fin,
    condiciones,
    codigo_promocion,
    activo
  } = req.body;

  if (isNaN(parseInt(id_promocion))) {
    return res.status(400).json({ error: 'El ID de la promoción debe ser un número entero válido.' });
  }
  if (Object.keys(req.body).length === 0) {
     return res.status(400).json({ error: 'Se requiere al menos un campo para actualizar.' });
  }
  // Validaciones similares al POST
  if (descuento_porcentaje !== undefined && (isNaN(parseInt(descuento_porcentaje)) || parseInt(descuento_porcentaje) < 0 || parseInt(descuento_porcentaje) > 100)) {
    return res.status(400).json({ error: 'descuento_porcentaje debe ser un número entero entre 0 y 100.' });
  }
  // ... (otras validaciones de fecha, etc.)

  try {
    const promoActualQuery = await db.query('SELECT * FROM promociones WHERE id_promocion = $1', [id_promocion]);
    if (promoActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Promoción no encontrada para actualizar.' });
    }
    const promoActual = promoActualQuery.rows[0];

    const updatedTitulo = titulo !== undefined ? titulo : promoActual.titulo;
    const updatedDesc = descripcion !== undefined ? descripcion : promoActual.descripcion;
    const updatedDescuento = descuento_porcentaje !== undefined ? descuento_porcentaje : promoActual.descuento_porcentaje;
    const updatedInicio = fecha_inicio !== undefined ? fecha_inicio : promoActual.fecha_inicio;
    const updatedFin = fecha_fin !== undefined ? fecha_fin : promoActual.fecha_fin;
    const updatedCondiciones = condiciones !== undefined ? condiciones : promoActual.condiciones;
    const updatedCodigo = codigo_promocion !== undefined ? codigo_promocion : promoActual.codigo_promocion;
    const updatedActivo = activo !== undefined ? activo : promoActual.activo;

    const result = await db.query(
      `UPDATE promociones 
       SET titulo = $1, descripcion = $2, descuento_porcentaje = $3, fecha_inicio = $4, 
           fecha_fin = $5, condiciones = $6, codigo_promocion = $7, activo = $8
       WHERE id_promocion = $9 RETURNING *`,
      [updatedTitulo, updatedDesc, updatedDescuento, updatedInicio, updatedFin, updatedCondiciones, updatedCodigo, updatedActivo, id_promocion]
    );
    
    res.status(200).json(result.rows[0]);

  } catch (error) {
    console.error(`Error al actualizar promoción ${id_promocion}:`, error);
    if (error.code === '23505' && error.constraint === 'promociones_codigo_promocion_key') {
      return res.status(409).json({ error: 'El código de promoción ya está en uso por otra promoción.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/promociones/:id_promocion - Eliminar una promoción
router.delete('/:id_promocion', async (req, res) => {
  const { id_promocion } = req.params;
   if (isNaN(parseInt(id_promocion))) {
    return res.status(400).json({ error: 'El ID de la promoción debe ser un número entero válido.' });
  }

  try {
    // ON DELETE CASCADE en productos_promocionados se encargará de los enlaces.
    const result = await db.query('DELETE FROM promociones WHERE id_promocion = $1 RETURNING *', [id_promocion]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Promoción no encontrada para borrar.' });
    }
    res.status(204).send(); // No Content
  } catch (error) {
    console.error(`Error al borrar promoción ${id_promocion}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
