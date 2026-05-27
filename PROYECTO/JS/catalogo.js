// ============================================
// CATÁLOGO DE DISPOSITIVOS - TECH SHOP MX
// ============================================
document.addEventListener('DOMContentLoaded', () => {

    // Variable para guardar los productos de la BD
    let productos = [];

    // ============================================
    // ELEMENTOS DEL DOM
    // ============================================
    const catalogoGrid = document.getElementById('catalogo-grid');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const filtroMarca = document.getElementById('filtro-marca');
    const filtroPrecio = document.getElementById('filtro-precio');
    const filtroEstado = document.getElementById('filtro-estado');
    const btnBuscar = document.getElementById('btn-buscar');
    const btnLimpiar = document.getElementById('btn-limpiar-filtros');
    const btnMostrarTodos = document.getElementById('btn-mostrar-todos');
    const contadorSpan = document.querySelector('#contador-resultados span');
    const sinResultados = document.getElementById('sin-resultados');
    const modal = document.getElementById('modal-producto');
    const modalClose = document.querySelector('.modal-close');

    // ============================================
    // FUNCIÓN: Formatear precio a moneda
    // ============================================
    function formatearPrecio(precio) {
        return '$' + parseFloat(precio).toLocaleString('es-MX');
    }

    // ============================================
    // FUNCIÓN: Generar estrellas de calificación
    // ============================================
    function generarEstrellas(rating) {
        const ratingValue = parseFloat(rating) || 0;
        const totalStars = 5;
        let starsHTML = '';
        for (let i = 1; i <= totalStars; i++) {
            starsHTML += `<span class="${i <= ratingValue ? 'filled' : ''}">★</span>`;
        }
        return `<div class="star-rating">${starsHTML}</div>`;
    }


    // ============================================
    // FUNCIÓN: Capitalizar primera letra
    // ============================================
    function capitalizar(texto) {
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }

    // ============================================
    // FUNCIÓN: Obtener clase de badge según estado
    // ============================================
    function obtenerClaseBadge(estado) {
        switch (estado) {
            case 'excelente': return 'badge-excelente';
            case 'bueno': return 'badge-bueno';
            case 'regular': return 'badge-regular';
            default: return 'badge-bueno';
        }
    }

    // ============================================
    // FUNCIÓN: Crear tarjeta de producto
    // ============================================
    // Guardar favoritos globalmente
    let misFavoritos = [];

    function crearTarjetaProducto(producto) {
        const card = document.createElement('article');
        card.className = 'producto-card';
        card.setAttribute('data-id', producto.id);
        card.setAttribute('data-categoria', producto.categoria);
        card.setAttribute('data-marca', producto.marca);
        card.setAttribute('data-precio', producto.precio);
        card.setAttribute('data-estado', producto.estado);

        const esFavorito = misFavoritos.includes(producto.id);
        const heartText = esFavorito ? '❤️' : '🤍';
        const heartShadow = esFavorito ? 'none' : '0 2px 4px rgba(0,0,0,0.3)';

        card.innerHTML = `
            <div class="heart-icon-card" data-id="${producto.id}" title="Agregar a favoritos" style="text-shadow: ${heartShadow}">${heartText}</div>
            <div class="producto-imagen">
                <img src="${producto.imagen}" alt="${producto.nombre}" loading="lazy" onerror="this.src='Img/placeholder.jpg'; this.onerror=null;">
                <span class="producto-categoria-etiqueta">${capitalizar(producto.categoria)}</span>
            </div>
            <div class="producto-detalle">
                <span class="producto-marca">${capitalizar(producto.marca)}</span>
                <h3 class="producto-nombre">${producto.nombre}</h3>
                <div class="rating-summary">
                    ${generarEstrellas(producto.rating_avg)}
                    <span>(${producto.rating_count} ${producto.rating_count === 1 ? 'opinión' : 'opiniones'})</span>
                </div>
                <p class="producto-descripcion" style="margin-top: 0.5rem;">${producto.descripcion}</p>
                <div class="producto-footer">
                    <span class="producto-precio">${formatearPrecio(producto.precio)}</span>
                    <button class="btn-detalle" data-id="${producto.id}">Ver Detalle</button>
                </div>
            </div>
        `;

        // Evento para el corazón en la tarjeta minimizada
        const heartIcon = card.querySelector('.heart-icon-card');
        heartIcon.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que se abra el modal de detalle
            
            fetch('/api/user-status')
                .then(res => res.json())
                .then(data => {
                    if (!data.loggedIn) {
                        alert('Debes iniciar sesión para agregar a favoritos.');
                        window.location.href = 'iniciosesion.html';
                    } else {
                        fetch('/api/favoritos/toggle', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ producto_id: producto.id })
                        })
                        .then(res => res.json())
                        .then(toggleData => {
                            if (toggleData.success) {
                                if (toggleData.action === 'added') {
                                    heartIcon.textContent = '❤️';
                                    heartIcon.style.textShadow = 'none';
                                    misFavoritos.push(producto.id);
                                } else {
                                    heartIcon.textContent = '🤍';
                                    heartIcon.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)';
                                    misFavoritos = misFavoritos.filter(id => id !== producto.id);
                                }
                            }
                        });
                    }
                });
        });

        // Evento para abrir modal al hacer clic en "Ver Detalle"
        card.querySelector('.btn-detalle').addEventListener('click', (e) => {
            e.stopPropagation();
            mostrarModal(producto);
        });

        // Evento para abrir modal al hacer clic en la tarjeta completa
        card.addEventListener('click', () => {
            mostrarModal(producto);
        });

        return card;
    }

    // ============================================
    // FUNCIÓN: Mostrar productos en el grid
    // ============================================
    function mostrarProductos(productosAMostrar) {
        catalogoGrid.innerHTML = '';

        if (productosAMostrar.length === 0) {
            catalogoGrid.style.display = 'none';
            sinResultados.style.display = 'block';
        } else {
            catalogoGrid.style.display = 'grid';
            sinResultados.style.display = 'none';

            productosAMostrar.forEach(producto => {
                const tarjeta = crearTarjetaProducto(producto);
                catalogoGrid.appendChild(tarjeta);
            });
        }

        contadorSpan.textContent = productosAMostrar.length;
    }

    // ============================================
    // FUNCIÓN: Filtrar productos
    // ============================================
    function filtrarProductos() {
        const categoria = filtroCategoria.value;
        const marca = filtroMarca.value;
        const precioMax = filtroPrecio.value;
        const estado = filtroEstado.value;

        let productosFiltrados = [...productos];

        // Filtrar por categoría
        if (categoria !== 'todos') {
            productosFiltrados = productosFiltrados.filter(p => p.categoria === categoria);
        }

        // Filtrar por marca (solo 4 marcas: samsung, apple, dell, lenovo)
        if (marca !== 'todas') {
            productosFiltrados = productosFiltrados.filter(p => p.marca === marca);
        }

        // Filtrar por precio máximo
        if (precioMax !== 'todos') {
            productosFiltrados = productosFiltrados.filter(p => p.precio <= parseInt(precioMax));
        }

        // Filtrar por estado
        if (estado !== 'todos') {
            productosFiltrados = productosFiltrados.filter(p => p.estado === estado);
        }

        mostrarProductos(productosFiltrados);
    }

    // ============================================
    // FUNCIÓN: Limpiar filtros
    // ============================================
    function limpiarFiltros() {
        filtroCategoria.value = 'todos';
        filtroMarca.value = 'todas';
        filtroPrecio.value = 'todos';
        filtroEstado.value = 'todos';
        mostrarProductos(productos);
    }

    // ============================================
    // FUNCIÓN: Animación tipo TikTok
    // ============================================
    function mostrarAnimacionCorazon(x, y) {
        const heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.className = 'floating-heart';
        
        // Centrar en la pantalla si no hay coordenadas exactas
        const posX = x || window.innerWidth / 2;
        const posY = y || window.innerHeight / 2;

        heart.style.left = `${posX}px`;
        heart.style.top = `${posY}px`;
        document.body.appendChild(heart);

        setTimeout(() => {
            heart.remove();
        }, 800); // 800ms de duración
    }

    // ============================================
    // FUNCIÓN: Mostrar modal de detalle
    // ============================================
    function mostrarModal(producto) {
        document.getElementById('modal-img').src = producto.imagen;
        document.getElementById('modal-img').alt = producto.nombre;
        document.getElementById('modal-titulo').textContent = producto.nombre;

        const badge = document.getElementById('modal-badge');
        badge.textContent = capitalizar(producto.estado);
        badge.className = 'producto-badge ' + obtenerClaseBadge(producto.estado);

        document.getElementById('modal-descripcion').textContent = producto.descripcion;
        document.getElementById('modal-especificaciones').textContent = producto.especificaciones;
        document.getElementById('modal-precio').textContent = formatearPrecio(producto.precio);

        // Configurar botones del modal
        const btnCompra = document.getElementById('btn-solicitar-compra');
        btnCompra.innerHTML = '🛒 Agregar al Carrito';
        btnCompra.onclick = () => {
            fetch('/api/user-status')
                .then(res => res.json())
                .then(data => {
                    if (!data.loggedIn) {
                        alert('Debes iniciar sesión para agregar al carrito.');
                        window.location.href = 'iniciosesion.html';
                    } else {
                        fetch('/api/carrito/add', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ producto_id: producto.id })
                        }).then(res => res.json()).then(resData => {
                            if(resData.success) {
                                alert(`${producto.nombre} se agregó a tu carrito 🛒`);
                                cerrarModal();
                            }
                        });
                    }
                });
        };

        const esFavoritoModal = misFavoritos.includes(producto.id);
        const btnFavorito = document.getElementById('btn-agregar-favorito');
        btnFavorito.innerHTML = esFavoritoModal ? '❤️ Agregado a Favoritos' : '🤍 Agregar a Favoritos';
        btnFavorito.style.background = esFavoritoModal ? '#10b981' : '';
        
        btnFavorito.onclick = (e) => {
            fetch('/api/user-status')
                .then(res => res.json())
                .then(data => {
                    if (!data.loggedIn) {
                        alert('Debes iniciar sesión para agregar a favoritos.');
                        window.location.href = 'iniciosesion.html';
                    } else {
                        fetch('/api/favoritos/toggle', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ producto_id: producto.id })
                        }).then(res => res.json()).then(toggleData => {
                            if (toggleData.action === 'added') {
                                mostrarAnimacionCorazon(e.clientX, e.clientY);
                                btnFavorito.innerHTML = '❤️ Agregado a Favoritos';
                                btnFavorito.style.background = '#10b981';
                                misFavoritos.push(producto.id);
                                const cardHeart = document.querySelector(`.producto-card[data-id="${producto.id}"] .heart-icon-card`);
                                if(cardHeart) { cardHeart.textContent = '❤️'; cardHeart.style.textShadow = 'none'; }
                            } else {
                                btnFavorito.innerHTML = '🤍 Agregar a Favoritos';
                                btnFavorito.style.background = '';
                                misFavoritos = misFavoritos.filter(id => id !== producto.id);
                                const cardHeart = document.querySelector(`.producto-card[data-id="${producto.id}"] .heart-icon-card`);
                                if(cardHeart) { cardHeart.textContent = '🤍'; cardHeart.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)'; }
                            }
                        });
                    }
                });
        };

        // Cargar y mostrar calificaciones
        const reviewsList = document.getElementById('modal-reviews-list');
        const reviewForm = document.getElementById('review-form');
        const ratingSummary = document.getElementById('modal-rating-summary');

        ratingSummary.innerHTML = `
            ${generarEstrellas(producto.rating_avg)}
            <span>${(producto.rating_avg || 0).toFixed(1)} de 5 (${producto.rating_count} opiniones)</span>
        `;

        fetch(`/api/productos/${producto.id}/calificaciones`)
            .then(res => res.json())
            .then(calificaciones => {
                reviewsList.innerHTML = '';
                if (calificaciones.length === 0) {
                    reviewsList.innerHTML = '<p style="font-size: 0.9rem; color: #6b7280;">Este producto aún no tiene opiniones. ¡Sé el primero!</p>';
                } else {
                    calificaciones.forEach(cal => {
                        const reviewDiv = document.createElement('div');
                        reviewDiv.className = 'review-item';
                        reviewDiv.innerHTML = `
                            <div class="review-header">
                                <span class="review-author">${cal.username}</span>
                                <span class="review-date">${new Date(cal.fecha).toLocaleDateString('es-MX')}</span>
                            </div>
                            ${generarEstrellas(cal.puntuacion)}
                            <p>${cal.comentario || ''}</p>
                        `;
                        reviewsList.appendChild(reviewDiv);
                    });
                }
            });

        // Lógica del formulario de opinión
        fetch('/api/user-status').then(res => res.json()).then(user => {
            if (user.loggedIn) {
                reviewForm.style.display = 'block';
                const stars = reviewForm.querySelectorAll('.star-rating-input span');
                const ratingInput = reviewForm.querySelector('.star-rating-input');

                stars.forEach(star => {
                    star.onclick = () => {
                        const ratingValue = star.dataset.value;
                        ratingInput.dataset.puntuacion = ratingValue;
                        stars.forEach(s => {
                            s.classList.toggle('selected', s.dataset.value <= ratingValue);
                        });
                    };
                });

                reviewForm.onsubmit = (e) => {
                    e.preventDefault();
                    const puntuacion = ratingInput.dataset.puntuacion;
                    const comentario = document.getElementById('review-comment').value;
                    if (puntuacion === '0') return alert('Por favor, selecciona una puntuación de estrellas.');

                    fetch(`/api/productos/${producto.id}/calificar`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ puntuacion, comentario })
                    }).then(res => res.json()).then(data => {
                        if (data.success) { alert('¡Gracias por tu opinión!'); cerrarModal(); }
                    });
                };
            }
        });

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // ============================================
    // FUNCIÓN: Cerrar modal
    // ============================================
    function cerrarModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ============================================
    // EVENTOS
    // ============================================

    // Botón buscar
    btnBuscar.addEventListener('click', filtrarProductos);

    // Filtros automáticos al cambiar selección
    filtroCategoria.addEventListener('change', filtrarProductos);
    filtroMarca.addEventListener('change', filtrarProductos);
    filtroPrecio.addEventListener('change', filtrarProductos);
    filtroEstado.addEventListener('change', filtrarProductos);

    // Botón limpiar filtros
    btnLimpiar.addEventListener('click', limpiarFiltros);

    // Botón mostrar todos (cuando no hay resultados)
    btnMostrarTodos.addEventListener('click', limpiarFiltros);

    // Cerrar modal
    modalClose.addEventListener('click', cerrarModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            cerrarModal();
        }
    });

    // Cerrar modal con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            cerrarModal();
        }
    });

    // ============================================
    // CARGA INICIAL: Mostrar todos los productos
    // ============================================
    
    fetch('/api/productos')
        .then(res => {
            if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
            return res.json();
        })
        .then(data => {
            productos = data; // Guardar productos de la BD
            return fetch('/api/favoritos/ids');
        })
        .then(res => res.json())
        .then(favIds => {
            misFavoritos = favIds || [];
            mostrarProductos(productos);
        })
        .catch(err => {
            console.error('Error cargando productos desde la base de datos:', err);
            if (catalogoGrid) {
                catalogoGrid.innerHTML = `<div class="empty-cart" style="color: var(--danger-color); background: #fff1f1; padding: 40px;"><h2>Error de Conexión</h2><p>No pudimos cargar los productos. Por favor, intenta recargar la página.</p></div>`;
            }
        });
});