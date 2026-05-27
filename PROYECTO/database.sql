-- Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS tech_shop_db;
USE tech_shop_db;

-- Crear la tabla de usuarios basada en el registro de server.js
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contacto VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    pais VARCHAR(100) NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);