const express = require('express');
const mysql = require('mysql2');
require('dotenv').config(); // Cargar variables de entorno desde .env
const bcrypt = require('bcrypt');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const nodemailer = require('nodemailer');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const saltRounds = 10;

// Configuración de Multer para subir fotos de reparación
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Configuración básica
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));

// Conexión a la base de datos usando un Pool (más robusto)
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    ssl: {
        ca: fs.readFileSync(path.join(__dirname, 'isrgrootx1.pem'))
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verificamos la conexión al iniciar
db.getConnection((err, connection) => {
    if (err) {
        // Mostramos el error real para un mejor diagnóstico en producción
        console.error('❌ No se pudo conectar a la base de datos. Error detallado:', err);
        throw err; // Detenemos la aplicación si no hay BD
    }
    console.log('✅ Conectado exitosamente a la base de datos en la nube.');
    connection.release();
});

// Configuración del almacenamiento de sesión en la base de datos
const sessionStore = new MySQLStore({
    expiration: 1000 * 60 * 60 * 24 * 7, // La sesión dura 7 días
    createDatabaseTable: true, // Crea la tabla 'sessions' automáticamente
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
}, db); // Pasamos el pool de conexión directamente

// Configuración de Gmail para enviar correos
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Usar SSL
    auth: {
        user: 'pabloaldo1703@gmail.com', // Cambia por tu correo
        pass: process.env.GMAIL_PASS  // ¡Ahora lee la contraseña segura desde .env!
    }
});

// Configuración de la sesión (después de la BD y antes de las rutas)
app.use(session({
    key: 'session_cookie_name',
    secret: 'mi_secreto_tecnologico_super_seguro',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7 // La cookie en el navegador también dura 7 días
    }
}));
// Ruta para procesar el registro de nuevos usuarios
app.post('/procesar_registro', async (req, res) => {
    const { contacto, nombre_completo, username, pais, ciudad, password } = req.body;

    try {
        // Encriptar la contraseña antes de guardarla
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const sql = `INSERT INTO usuarios (contacto, nombre_completo, username, pais, ciudad, password) 
                     VALUES (?, ?, ?, ?, ?, ?)`;
        
        db.query(sql, [contacto, nombre_completo, username, pais, ciudad, hashedPassword], (err, result) => {
            if (err) {
                console.error(err);
                return res.send('Hubo un error al registrarte. Quizás el usuario ya existe.');
            }

            // Enviar correo de bienvenida al usuario registrado
            const mailOptions = {
                from: 'Tech Shop MX <pabloaldo1703@gmail.com>',
                to: contacto,
                subject: '¡Bienvenido a Tech Shop MX!',
                text: `¡Hola ${nombre_completo}! Te has registrado exitosamente a Tech Shop MX. Bienvenido a nuestra comunidad tecnológica.`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("Error al enviar email de bienvenida:", error);
                } else {
                    console.log("Email enviado con éxito a: " + contacto);
                }
            });

            // Redirigir al login después del registro
            res.redirect('/iniciosesion.html');
        });
    } catch (error) {
        res.status(500).send('Error en el servidor');
    }
});

// Ruta para el inicio de sesión
app.post('/login', (req, res) => {
    const { identificador, password } = req.body;

    const sql = "SELECT * FROM usuarios WHERE (username = ? OR contacto = ?)";
    
    db.query(sql, [identificador, identificador], async (err, results) => {
        if (err) {
            console.error("Error en la consulta de login:", err);
            // Esto evita que el servidor se caiga y da una respuesta amigable
            return res.status(500).send('<h1>Error interno del servidor. Por favor, intenta más tarde.</h1>');
        }

        if (results.length > 0) {
            const user = results[0];
            // Comparar contraseña ingresada con la encriptada en la BD
            const match = await bcrypt.compare(password, user.password);
            
            if (match) {
                req.session.userId = user.id;
                req.session.username = user.username;
                res.redirect('/index.html');
            } else {
                res.send('<h1>Error: Usuario o contraseña incorrectos</h1><a href="iniciosesion.html">Volver a intentar</a>');
            }
        } else {
            res.send('<h1>Error: Usuario o contraseña incorrectos</h1><a href="iniciosesion.html">Volver a intentar</a>');
        }
    });
});

// Ruta para verificar el estado de la sesión desde el frontend
app.get('/api/user-status', (req, res) => {
    // Evitar que el navegador guarde en caché el estado de la sesión
    res.setHeader('Cache-Control', 'no-store, no-cache, private');
    if (req.session.username) {
        db.query("SELECT rol FROM usuarios WHERE id = ?", [req.session.userId], (err, users) => {
            const rol = (!err && users.length > 0) ? users[0].rol : 'cliente';
            res.json({ loggedIn: true, username: req.session.username, rol: rol });
        });
    } else {
        res.json({ loggedIn: false });
    }
});

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/index.html');
});
// Ruta para obtener los datos del perfil del usuario logueado
app.get('/api/perfil', (req, res) => {
    // Verificamos si hay una sesión activa
    if (!req.session.userId) {
        return res.status(401).json({ error: "No has iniciado sesión" });
    }

    const userId = req.session.userId;
    const sql = "SELECT nombre_completo, contacto, username, pais, ciudad FROM usuarios WHERE id = ?";

    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).send("Error en la base de datos");
        
        if (results.length > 0) {
            res.json(results[0]); // Enviamos los datos del usuario como JSON
        } else {
            res.status(404).send("Usuario no encontrado");
        }
    });
});

// Ruta para recibir solicitudes de reparación
app.post('/api/solicitar-reparacion', (req, res) => {
    const { dispositivo, falla } = req.body;
    const userId = req.session.userId || null;
    
    if (!dispositivo || !falla) {
        return res.status(400).json({ success: false, message: 'Faltan datos' });
    }

    const sql = "INSERT INTO solicitudes_reparacion (user_id, tipo_dispositivo, descripcion_falla) VALUES (?, ?, ?)";
    db.query(sql, [userId, dispositivo, falla], (err, result) => {
        if (err) {
            console.error('Error guardando solicitud:', err);
            return res.status(500).json({ success: false, message: 'Error en el servidor' });
        }
        res.json({ success: true, message: 'Solicitud enviada', id: result.insertId });
    });
});

// Ruta AVANZADA para recibir solicitudes de reparación (Con fotos y envío de correo)
app.post('/api/solicitar-reparacion-avanzada', upload.array('fotos', 5), (req, res) => {
    const { tipo_dispositivo, modelo, descripcion } = req.body;
    const userId = req.session.userId || null;
    
    // 1. Guardar en la Base de Datos
    const sql = "INSERT INTO solicitudes_reparacion (user_id, tipo_dispositivo, descripcion_falla, estado) VALUES (?, ?, ?, 'Pendiente')";
    const fallaCompleta = `Modelo: ${modelo} | Falla: ${descripcion}`;
    
    db.query(sql, [userId, tipo_dispositivo, fallaCompleta], (err, result) => {
        if (err) { console.error('Error guardando solicitud avanzada:', err); return res.status(500).send("Error guardando la solicitud."); }
        
        const orderId = result.insertId;

        // Función para enviar el correo y la respuesta
        const sendEmailAndResponse = (userInfo) => {
            const mailOptions = {
                from: 'Sistema Tech Shop MX <pabloaldo1703@gmail.com>',
                to: 'pabloaldo1703@gmail.com', // Tu correo de empresa
                subject: `🔧 Nueva Reparación #${orderId}: ${tipo_dispositivo} - ${modelo}`,
                text: `¡Hola equipo!\n\nSe ha recibido una nueva solicitud de reparación en el sistema.\n\n${userInfo}\nDetalles del Equipo:\n- Orden ID: #${orderId}\n- Equipo: ${tipo_dispositivo}\n- Modelo: ${modelo}\n- Descripción del problema: ${descripcion}\n\n*Nota: Si el usuario subió fotos, se han guardado en la carpeta 'uploads' de tu servidor.`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) { console.error("Error al enviar email de reparación a la empresa:", error); } 
                else { console.log("Notificación de reparación enviada a la empresa."); }
            });
            
            res.send(`<div style="text-align:center; padding: 50px; font-family: sans-serif;"><h2>¡Solicitud enviada con éxito!</h2><p>Tu orden de servicio es la <b>#${orderId}</b>.</p><p>Pronto nos pondremos en contacto contigo.</p><br><a href="/index.html" style="background:#2563eb; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">Volver al inicio</a></div>`);
        };

        // Si el usuario está logueado, obtener sus datos para el correo
        if (userId) {
            db.query("SELECT nombre_completo, contacto, username FROM usuarios WHERE id = ?", [userId], (userErr, users) => {
                let userInfoText = 'Usuario: No registrado o no logueado.\n';
                if (!userErr && users.length > 0) {
                    const u = users[0];
                    userInfoText = `Datos del Cliente:\n- Nombre: ${u.nombre_completo}\n- Usuario: @${u.username}\n- Contacto: ${u.contacto}\n`;
                }
                sendEmailAndResponse(userInfoText);
            });
        } else {
            sendEmailAndResponse('Usuario: No registrado o no logueado.\n');
        }
    });
});

// Ruta para obtener las reparaciones del usuario logueado
app.get('/api/mis-reparaciones', (req, res) => {
    if (!req.session.userId) return res.json([]);
    
    db.query("SELECT * FROM solicitudes_reparacion WHERE user_id = ? ORDER BY fecha_solicitud DESC", [req.session.userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en BD' });
        res.json(results);
    });
});

// Ruta para obtener el catálogo de productos
app.get('/api/productos', (req, res) => {
    const sql = `
        SELECT p.*, AVG(c.puntuacion) as rating_avg, COUNT(c.id) as rating_count
        FROM productos p
        LEFT JOIN calificaciones c ON p.id = c.producto_id
        GROUP BY p.id`;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error obteniendo productos:', err);
            return res.status(500).json({ error: 'Error en la base de datos' });
        }
        res.json(results);
    });
});

// Ruta para obtener productos recomendados para el index
app.get('/api/productos/recomendados', (req, res) => {
    const sql = `
        SELECT p.*, AVG(c.puntuacion) as rating_avg, COUNT(c.id) as rating_count
        FROM productos p
        LEFT JOIN calificaciones c ON p.id = c.producto_id
        GROUP BY p.id
        ORDER BY RAND() LIMIT 4`;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error obteniendo productos recomendados:', err);
            return res.status(500).json({ error: 'Error en la base de datos' });
        }
        res.json(results);
    });
});
// Ruta para agregar/quitar favorito
app.post('/api/favoritos/toggle', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'No has iniciado sesión' });
    }
    const { producto_id } = req.body;
    const userId = req.session.userId;

    db.query("SELECT * FROM favoritos WHERE user_id = ? AND producto_id = ?", [userId, producto_id], (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err });

        if (results.length > 0) {
            db.query("DELETE FROM favoritos WHERE user_id = ? AND producto_id = ?", [userId, producto_id], (err2) => {
                if (err2) return res.status(500).json({ success: false, error: err2 });
                res.json({ success: true, action: 'removed' });
            });
        } else {
            db.query("INSERT INTO favoritos (user_id, producto_id) VALUES (?, ?)", [userId, producto_id], (err2) => {
                if (err2) return res.status(500).json({ success: false, error: err2 });
                res.json({ success: true, action: 'added' });
            });
        }
    });
});

// Ruta para obtener los favoritos completos del usuario
app.get('/api/favoritos', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'No autorizado' });
    
    const sql = `SELECT p.* FROM productos p INNER JOIN favoritos f ON p.id = f.producto_id WHERE f.user_id = ?`;
    
    db.query(sql, [req.session.userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en BD' });
        res.json(results);
    });
});

// Ruta para obtener solo los IDs favoritos (para el catálogo)
app.get('/api/favoritos/ids', (req, res) => {
    if (!req.session.userId) return res.json([]);
    db.query("SELECT producto_id FROM favoritos WHERE user_id = ?", [req.session.userId], (err, results) => {
        if (err) return res.json([]);
        res.json(results.map(r => r.producto_id));
    });
});

// ==========================================
// RUTAS DEL CARRITO DE COMPRAS Y PAGO
// ==========================================
app.post('/api/carrito/add', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false, message: 'No logueado' });
    const { producto_id } = req.body;
    
    db.query("INSERT IGNORE INTO carrito (user_id, producto_id) VALUES (?, ?)", [req.session.userId, producto_id], (err) => {
        if (err) return res.status(500).json({ success: false, error: err });
        res.json({ success: true });
    });
});

app.get('/api/carrito', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'No autorizado' });
    const sql = `SELECT p.*, c.id as cart_id FROM productos p INNER JOIN carrito c ON p.id = c.producto_id WHERE c.user_id = ?`;
    db.query(sql, [req.session.userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error BD' });
        res.json(results);
    });
});

app.post('/api/carrito/remove', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { producto_id } = req.body;
    db.query("DELETE FROM carrito WHERE user_id = ? AND producto_id = ?", [req.session.userId, producto_id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.post('/api/carrito/checkout', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false, message: 'No logueado' });
    const userId = req.session.userId;

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [users] = await connection.query("SELECT * FROM usuarios WHERE id = ?", [userId]);
        if (users.length === 0) throw new Error('Usuario no encontrado');
        const usuario = users[0];

        const [productos] = await connection.query("SELECT p.id, p.nombre, p.precio FROM productos p JOIN carrito c ON p.id = c.producto_id WHERE c.user_id = ?", [userId]);
        if (productos.length === 0) {
            throw new Error('El carrito está vacío.');
        }

        let total = 0;
        let listaProductosEmail = '';
        productos.forEach(p => {
            total += parseFloat(p.precio);
            listaProductosEmail += `- ${p.nombre}: $${parseFloat(p.precio).toLocaleString('es-MX')}\n`;
        });

        const direccionEnvio = `Calle: ${usuario.calle || 'N/A'} #${usuario.numero_ext || 'S/N'}, Col. ${usuario.colonia || 'N/A'}, C.P. ${usuario.codigo_postal || 'N/A'}, ${usuario.ciudad || 'N/A'}`;

        const [ordenResult] = await connection.query("INSERT INTO ordenes (user_id, total, direccion_envio) VALUES (?, ?, ?)", [userId, total, direccionEnvio]);
        const ordenId = ordenResult.insertId;

        const detallesValues = productos.map(p => [ordenId, p.id, 1, p.precio, p.nombre]);
        await connection.query("INSERT INTO orden_detalles (orden_id, producto_id, cantidad, precio_unitario, nombre_producto) VALUES ?", [detallesValues]);

        await connection.query("DELETE FROM carrito WHERE user_id = ?", [userId]);

        await connection.commit();

        // --- Enviar correos (fuera de la transacción) ---
        const mailOptionsCliente = {
            from: 'Tech Shop MX <pabloaldo1703@gmail.com>',
            to: usuario.contacto,
            subject: `🛒 Confirmación de Compra #${ordenId} - Tech Shop MX`,
            text: `¡Hola ${usuario.nombre_completo}!\n\nHemos recibido tu pago exitosamente.\n\nResumen de tu pedido:\n${listaProductosEmail}\nTotal pagado: $${total.toLocaleString('es-MX')}\n\nPronto nos pondremos en contacto contigo para el envío.\n\n¡Gracias por elegir Tech Shop MX!`
        };
        transporter.sendMail(mailOptionsCliente).catch(err => console.error("Error al enviar email de compra al cliente:", err));

        const mailOptionsEmpresa = {
            from: 'Sistema Tech Shop MX <pabloaldo1703@gmail.com>',
            to: 'pabloaldo1703@gmail.com',
            subject: `📦 Nueva Venta #${ordenId} - Usuario: ${usuario.username}`,
            text: `¡Se ha registrado una nueva venta en el sistema!\n\nCliente: ${usuario.nombre_completo} (ID: ${usuario.id}, Contacto: ${usuario.contacto})\n\nDirección de Envío:\n${direccionEnvio}\n\nProductos Comprados:\n${listaProductosEmail}\nTotal de la Venta: $${total.toLocaleString('es-MX')}\n\nPor favor, prepara el pedido para su envío.`
        };
        transporter.sendMail(mailOptionsEmpresa).catch(err => console.error("Error al enviar email de venta a la empresa:", err));

        res.json({ success: true, nombreUsuario: usuario.nombre_completo.split(' ')[0] });

    } catch (error) {
        console.error("Error en checkout:", error);
        if (connection) await connection.rollback();
        res.status(500).json({ success: false, message: 'Error interno del servidor durante el pago.' });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
// RUTAS DE DIRECCIÓN DE ENVÍO
// ==========================================
app.get('/api/direccion', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'No autorizado' });
    const sql = "SELECT calle, numero_ext, colonia, codigo_postal, ciudad, pais FROM usuarios WHERE id = ?";
    db.query(sql, [req.session.userId], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({});
        res.json(results[0] || {});
    });
});

app.post('/api/direccion', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { calle, numero_ext, colonia, codigo_postal, ciudad, pais } = req.body;
    const sql = "UPDATE usuarios SET calle = ?, numero_ext = ?, colonia = ?, codigo_postal = ?, ciudad = ?, pais = ? WHERE id = ?";
    db.query(sql, [calle, numero_ext, colonia, codigo_postal, ciudad, pais, req.session.userId], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// ==========================================
// RUTAS DE HISTORIAL DE COMPRAS
// ==========================================
app.get('/api/mis-compras', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'No autorizado' });
    
    const sql = `
        SELECT o.id, o.total, o.fecha_orden, o.estado, 
        (SELECT COUNT(*) FROM orden_detalles od WHERE od.orden_id = o.id) as item_count
        FROM ordenes o
        WHERE o.user_id = ? ORDER BY o.fecha_orden DESC`;
    
    db.query(sql, [req.session.userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en BD' });
        res.json(results);
    });
});

// ==========================================
// RUTAS DEL PANEL DE ADMINISTRADOR
// ==========================================

// Middleware de seguridad: solo deja pasar a los admins
function isAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).redirect('/iniciosesion.html');
    }
    db.query("SELECT rol FROM usuarios WHERE id = ?", [req.session.userId], (err, results) => {
        if (err || results.length === 0 || results[0].rol !== 'admin') {
            return res.status(403).send('<h1>Acceso Denegado</h1><p>No tienes permiso para ver esta página.</p><a href="/index.html">Volver</a>');
        }
        next(); // Si es admin, continúa
    });
}

// Ruta para mostrar la página de admin
app.get('/admin', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// API: Obtener todas las solicitudes de reparación
app.get('/api/admin/reparaciones', isAdmin, (req, res) => {
    const sql = "SELECT r.*, u.nombre_completo, u.contacto FROM solicitudes_reparacion r LEFT JOIN usuarios u ON r.user_id = u.id ORDER BY r.fecha_solicitud DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en BD' });
        res.json(results);
    });
});

// API: Actualizar el estado de una reparación
app.put('/api/admin/reparaciones/:id', isAdmin, (req, res) => {
    const { estado } = req.body;
    db.query("UPDATE solicitudes_reparacion SET estado = ? WHERE id = ?", [estado, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// API: Obtener TODOS los productos para el admin
app.get('/api/admin/productos', isAdmin, (req, res) => {
    db.query("SELECT id, nombre, precio, categoria, imagen FROM productos ORDER BY id DESC", (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en BD' });
        res.json(results);
    });
});

// API: Obtener un solo producto para editar
app.get('/api/admin/productos/:id', isAdmin, (req, res) => {
    db.query("SELECT * FROM productos WHERE id = ?", [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(results[0]);
    });
});

// API: Crear un nuevo producto
app.post('/api/admin/productos', isAdmin, (req, res) => {
    const { nombre, precio, imagen, descripcion, especificaciones } = req.body;
    // Aquí faltaría recibir y guardar categoria, marca, estado, etc.
    const sql = "INSERT INTO productos (nombre, precio, imagen, descripcion, especificaciones, categoria, marca, estado) VALUES (?, ?, ?, ?, ?, 'celulares', 'samsung', 'excelente')";
    db.query(sql, [nombre, precio, imagen, descripcion, especificaciones], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err });
        res.json({ success: true, id: result.insertId });
    });
});

// API: Actualizar un producto existente
app.put('/api/admin/productos/:id', isAdmin, (req, res) => {
    const { nombre, precio, imagen, descripcion, especificaciones } = req.body;
    const sql = "UPDATE productos SET nombre = ?, precio = ?, imagen = ?, descripcion = ?, especificaciones = ? WHERE id = ?";
    db.query(sql, [nombre, precio, imagen, descripcion, especificaciones, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err });
        res.json({ success: true });
    });
});

// API: Eliminar un producto
app.delete('/api/admin/productos/:id', isAdmin, (req, res) => {
    db.query("DELETE FROM productos WHERE id = ?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err });
        res.json({ success: true });
    });
});

// ==========================================
// RUTAS DE CALIFICACIONES DE PRODUCTOS
// ==========================================
app.get('/api/productos/:id/calificaciones', (req, res) => {
    const sql = `
        SELECT c.puntuacion, c.comentario, c.fecha, u.username 
        FROM calificaciones c 
        JOIN usuarios u ON c.user_id = u.id 
        WHERE c.producto_id = ? 
        ORDER BY c.fecha DESC
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en BD' });
        res.json(results);
    });
});

app.post('/api/productos/:id/calificar', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Debes iniciar sesión para calificar.' });
    }
    const { puntuacion, comentario } = req.body;
    const producto_id = req.params.id;
    const user_id = req.session.userId;

    // Usamos INSERT ... ON DUPLICATE KEY UPDATE para permitir que el usuario actualice su calificación
    const sql = `
        INSERT INTO calificaciones (producto_id, user_id, puntuacion, comentario) 
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE puntuacion = VALUES(puntuacion), comentario = VALUES(comentario)`;
    db.query(sql, [producto_id, user_id, puntuacion, comentario], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err });
        res.json({ success: true });
    });
});

// Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
});