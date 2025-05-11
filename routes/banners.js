// routes/banners.js
const express = require('express');
const router = express.Router();
const db = require('../db_config'); // Ajusta la ruta si es necesario

// GET /api/banners - Obtener todos los banners
// Ordenados por prioridad (mayor primero) y luego por fecha de inicio más reciente
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM banners ORDER BY prioridad DESC, fecha_inicio DESC, id_banner');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener banners:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener banners' });
  }
});

// GET /api/banners/:id - Obtener un banner por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'El ID del banner debe ser un número entero válido.' });
  }
  try {
    const result = await db.query('SELECT * FROM banners WHERE id_banner = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Banner no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener banner ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor al obtener banner' });
  }
});

// POST /api/banners - Crear un nuevo banner
router.post('/', async (req, res) => {
  const {
    titulo,
    descripcion,
    imagen_url,
    enlace_url,
    fecha_inicio, // Se espera formato 'YYYY-MM-DD'
    fecha_fin,    // Se espera formato 'YYYY-MM-DD'
    prioridad,
    ubicacion
  } = req.body;

  // Validaciones básicas (puedes expandirlas según tus necesidades)
  if (!titulo || !imagen_url) {
    return res.status(400).json({ error: 'El título y la URL de la imagen son requeridos para el banner.' });
  }
  if (prioridad !== undefined && isNaN(parseInt(prioridad))) {
    return res.status(400).json({ error: 'La prioridad debe ser un número.' });
  }
  // Podrías agregar validaciones para el formato de las fechas aquí si lo deseas

  try {
    const result = await db.query(
      `INSERT INTO banners (titulo, descripcion, imagen_url, enlace_url, fecha_inicio, fecha_fin, prioridad, ubicacion) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        titulo,
        descripcion || null,
        imagen_url,
        enlace_url || null,
        fecha_inicio || null,
        fecha_fin || null,
        prioridad !== undefined ? prioridad : 0, // Usa el default de la DB si es null, o 0 si es undefined.
        ubicacion || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear banner:', error);
    res.status(500).json({ error: 'Error interno del servidor al crear banner' });
  }
});

// PUT /api/banners/:id - Actualizar un banner existente
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'El ID del banner debe ser un número entero válido.' });
  }

  const {
    titulo,
    descripcion,
    imagen_url,
    enlace_url,
    fecha_inicio,
    fecha_fin,
    prioridad,
    ubicacion
  } = req.body;

  // Verificar que al menos un campo se esté enviando para actualizar
  if (titulo === undefined && descripcion === undefined && imagen_url === undefined && enlace_url === undefined &&
      fecha_inicio === undefined && fecha_fin === undefined && prioridad === undefined && ubicacion === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos un campo para actualizar.' });
  }
  if (prioridad !== undefined && isNaN(parseInt(prioridad))) {
    return res.status(400).json({ error: 'La prioridad debe ser un número.' });
  }

  try {
    // Obtener el banner actual para actualizar solo los campos proporcionados
    const bannerActualQuery = await db.query('SELECT * FROM banners WHERE id_banner = $1', [id]);
    if (bannerActualQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Banner no encontrado para actualizar' });
    }
    const bannerActual = bannerActualQuery.rows[0];

    // Fusionar los datos actuales con los nuevos datos (solo si se proporcionan)
    const updatedTitulo = titulo !== undefined ? titulo : bannerActual.titulo;
    const updatedDescripcion = descripcion !== undefined ? descripcion : bannerActual.descripcion;
    const updatedImagenUrl = imagen_url !== undefined ? imagen_url : bannerActual.imagen_url;
    const updatedEnlaceUrl = enlace_url !== undefined ? enlace_url : bannerActual.enlace_url;
    const updatedFechaInicio = fecha_inicio !== undefined ? fecha_inicio : bannerActual.fecha_inicio;
    const updatedFechaFin = fecha_fin !== undefined ? fecha_fin : bannerActual.fecha_fin;
    const updatedPrioridad = prioridad !== undefined ? prioridad : bannerActual.prioridad;
    const updatedUbicacion = ubicacion !== undefined ? ubicacion : bannerActual.ubicacion;

    const result = await db.query(
      `UPDATE banners 
       SET titulo = $1, descripcion = $2, imagen_url = $3, enlace_url = $4, 
           fecha_inicio = $5, fecha_fin = $6, prioridad = $7, ubicacion = $8
       WHERE id_banner = $9 RETURNING *`,
      [
        updatedTitulo,
        updatedDescripcion,
        updatedImagenUrl,
        updatedEnlaceUrl,
        updatedFechaInicio,
        updatedFechaFin,
        updatedPrioridad,
        updatedUbicacion,
        id
      ]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al actualizar banner ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor al actualizar banner' });
  }
});

// DELETE /api/banners/:id - Borrar un banner
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
   if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'El ID del banner debe ser un número entero válido.' });
  }
  try {
    const result = await db.query('DELETE FROM banners WHERE id_banner = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Banner no encontrado para borrar' });
    }
    res.status(204).send(); // 204 No Content es apropiado para DELETE exitoso
  } catch (error) {
    console.error(`Error al borrar banner ${id}:`, error);
    // En este caso, no hay claves foráneas obvias apuntando a 'banners' que podrían causar un error 23503,
    // pero se deja la estructura por si acaso o para otros tipos de errores de base de datos.
    // if (error.code === ' spezifische Fehlercodes ') { ... }
    res.status(500).json({ error: 'Error interno del servidor al borrar banner' });
  }
});

module.exports = router;
