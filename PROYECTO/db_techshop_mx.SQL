CREATE DATABASE tech_shop_db;
USE tech_shop_db;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contacto VARCHAR(100) NOT NULL, -- Correo o teléfono
    nombre_completo VARCHAR(150) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    pais VARCHAR(50),
    ciudad VARCHAR(50),
    password VARCHAR(255) NOT NULL, -- Aquí guardaremos la clave encriptada
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
