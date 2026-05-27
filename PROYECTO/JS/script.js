// =========================================
// FUNCIONES GLOBALES (necesarias para `onclick`)
// =========================================
function toggleDropdown() {
    const dropdown = document.getElementById("dropdown-content");
    if (dropdown) dropdown.classList.toggle("show");
}

function actualizarRastreo(id, estado) {
    const orderNumber = document.querySelector('#dynamic-tracking .order-number');
    if (orderNumber) orderNumber.textContent = `#TS-${id}`;
    
    const steps = document.querySelectorAll('#dynamic-tracking .step-indicator');
    if (!steps.length) return;

    steps.forEach((step, index) => {
        step.className = 'step-indicator';
        step.textContent = index + 1;
    });

    let pasoActual = 0;
    if (estado === 'Pendiente') pasoActual = 1;
    if (estado === 'Recibido') pasoActual = 2;
    if (estado === 'Reparando') pasoActual = 3;
    if (estado === 'Listo') pasoActual = 4;

    for (let i = 0; i < pasoActual; i++) {
        if (i === pasoActual - 1) {
            steps[i].className = 'step-indicator active';
            steps[i].textContent = i + 1;
        } else {
            steps[i].className = 'step-indicator completed';
            steps[i].textContent = '✓';
        }
    }
}

// =========================================
// CÓDIGO PRINCIPAL (se ejecuta al cargar la página)
// =========================================
document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------
    // 3. LÓGICA PARA PÁGINA DE LOGIN
    // -----------------------------------------
const loginForm = document.querySelector('form[action="/login"]');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        // Quitamos el e.preventDefault() para que el formulario SÍ se envíe al servidor
        
        const identifier = document.getElementById('identificador').value;
        const password = document.getElementById('password_login').value; // ID Corregido
        if (password.length < 8) {
            e.preventDefault(); // Solo bloqueamos si la contraseña es muy corta
            alert('La contraseña debe tener al menos 8 caracteres');
        }
    });
}

    // -----------------------------------------
    // 4. LÓGICA PARA PÁGINA DE REGISTRO
    // -----------------------------------------
    const registroForm = document.querySelector('form[action="/procesar_registro"]');
    if (registroForm) {
        registroForm.addEventListener('submit', (e) => {
            
            const pass = registroForm.querySelector('input[name="password"]').value;
            const confirmPass = registroForm.querySelector('input[name="confirm_password"]').value;

            if (pass !== confirmPass) {
                e.preventDefault(); // Solo detenemos el envío si las contraseñas no coinciden
                alert('Las contraseñas no coinciden. Inténtalo de nuevo.');
            }
        });

        // Mensaje de seguridad de contraseña en tiempo real
        const strengthText = document.querySelector('#password-strength-text');
        const passwordFieldForStrength = registroForm.querySelector('input[name="password"]');
        if (strengthText && passwordFieldForStrength) {
            passwordFieldForStrength.addEventListener('input', function() {
                const val = passwordFieldForStrength.value;
                if (val.length === 0) {
                    strengthText.textContent = "";
                } else if (val.length < 8) {
                    strengthText.textContent = "⚠️ Demasiado corta";
                    strengthText.className = "strength-msg short";
                } else {
                    const regex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
                    if (regex.test(val)) {
                        strengthText.textContent = "✅ Contraseña segura";
                        strengthText.className = "strength-msg secure";
                    } else {
                        strengthText.textContent = "🟠 Contraseña débil (falta mayúscula o número)";
                        strengthText.className = "strength-msg weak";
                    }
                }
            });
        }
    }

    // -----------------------------------------
    // 6. LÓGICA PARA FORMULARIO DE REPARACIÓN (SIMPLE)
    // -----------------------------------------
    const repairForm = document.querySelector('.repair-form');
    if (repairForm) {
        repairForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const dispositivo = document.getElementById('tipo-dispositivo').value;
            const falla = document.getElementById('descripcion-falla').value;
            
            if (dispositivo === "Selecciona un dispositivo" || falla.trim() === "") {
                alert('Por favor, selecciona un dispositivo y describe la falla.');
                return;
            }

            try {
                const response = await fetch('/api/solicitar-reparacion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dispositivo, falla })
                });
                const data = await response.json();
                
                if (data.success) {
                    alert('¡Solicitud enviada! Orden de servicio #' + data.id + '. Pronto nos contactaremos.');
                    repairForm.reset(); // Limpiar el formulario
                } else {
                    alert('Error al enviar la solicitud.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error de conexión con el servidor.');
            }
        });
    }

    // -----------------------------------------
    // 5. LÓGICA PARA PÁGINA PRINCIPAL (INDEX)
    // -----------------------------------------
    const trackingCard = document.getElementById('dynamic-tracking');
    const misSolicitudesContainer = document.getElementById('mis-solicitudes-container');
    
    if (trackingCard && misSolicitudesContainer) {
        fetch('/api/mis-reparaciones')
            .then(res => res.json())
            .then(reparaciones => {
                if (reparaciones.length > 0) {
                    // Mostrar lista arriba del formulario
                    misSolicitudesContainer.style.display = 'block';
                    const lista = document.getElementById('lista-solicitudes');                    
                    
                    // Limpiamos y añadimos un solo event listener para toda la lista (más eficiente)
                    lista.innerHTML = '';
                    lista.addEventListener('click', (e) => {
                        const target = e.target.closest('.btn-rastreo');
                        if (target) {
                            const id = target.dataset.id;
                            const estado = target.dataset.estado;
                            actualizarRastreo(id, estado);
                        }
                    });
                    
                    reparaciones.forEach(rep => {
                        const div = document.createElement('div');
                        div.style.background = 'white';
                        div.style.padding = '15px';
                        div.style.borderRadius = '10px';
                        div.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                        
                        // Asegurar que exista descripción de falla para evitar errores
                        const descripcion = rep.descripcion_falla || 'Sin descripción';
                        // Cortar descripción si es muy larga
                        const shortDesc = descripcion.length > 50 ? descripcion.substring(0, 50) + '...' : descripcion;

                        div.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>Orden #${rep.id}</strong> - ${rep.tipo_dispositivo}<br>
                                    <small style="color: #6b7280;">Detalle: ${shortDesc}</small><br>
                                    <small style="color: #6b7280;">Estado: <span style="color: var(--primary-color); font-weight: bold;">${rep.estado}</span></small>
                                </div>
                                <button class="btn btn-small btn-rastreo" data-id="${rep.id}" data-estado="${rep.estado}">Ver Rastreo</button>
                            </div>
                        `;
                        lista.appendChild(div);
                    });

                    // Mostrar rastreo de la última reparación por defecto
                    const ultimaRep = reparaciones[0];
                    actualizarRastreo(ultimaRep.id, ultimaRep.estado);
                }
            })
            .catch(err => console.error("Error cargando reparaciones:", err));
    }

    // Cargar productos recomendados
    const recommendedGrid = document.getElementById('recommended-products-grid');
    if (recommendedGrid) {
        fetch('/api/productos/recomendados')
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(productos => {
                recommendedGrid.innerHTML = '';
                if (productos.length === 0) {
                    recommendedGrid.innerHTML = '<p style="color: white;">No hay productos para mostrar.</p>';
                    return;
                }
                productos.forEach(prod => {
                    const card = document.createElement('article');
                    card.className = 'product-card';
                    
                    const estadoBadge = {
                        excelente: 'badge-excelente',
                        bueno: 'badge-bueno',
                        regular: 'badge-regular'
                    };

                    card.innerHTML = `
                        <div class="product-image">
                            <img src="${prod.imagen}" alt="${prod.nombre}" loading="lazy">
                        </div>
                        <div class="product-info">
                            <h3 class="product-title">${prod.nombre}</h3>
                            <span class="product-badge ${estadoBadge[prod.estado] || 'badge-bueno'}">${prod.estado.charAt(0).toUpperCase() + prod.estado.slice(1)}</span>
                            <p class="product-category">${prod.categoria.charAt(0).toUpperCase() + prod.categoria.slice(1)}</p>
                            <p class="product-description">${prod.descripcion.substring(0, 60)}...</p>
                            <div class="product-footer">
                                <span class="product-price">$${parseFloat(prod.precio).toLocaleString('es-MX')}</span>
                                <a href="catalogo.html" class="btn btn-small" style="text-decoration: none;">Ver Detalles</a>
                            </div>
                        </div>
                    `;
                    recommendedGrid.appendChild(card);
                });
            })
            .catch(err => {
                console.error("Error cargando recomendados:", err);
                recommendedGrid.innerHTML = '<p style="color: #ffcccc;">Error al cargar productos. Intenta recargar.</p>';
            });
    }

    // -----------------------------------------
    // 1. LÓGICA GENERAL DE NAVEGACIÓN Y SESIÓN
    // -----------------------------------------
    fetch('/api/user-status')
        .then(res => res.json())
        .then(data => {
            const authSection = document.getElementById('nav-auth-section');
            const userMenu = document.getElementById('user-menu');
            const displayName = document.getElementById('user-display-name');
            if (data.loggedIn) {
                if (authSection) authSection.style.display = 'none';
                if (userMenu) userMenu.style.display = 'block';
                if (displayName) displayName.textContent = data.username;
                if (data.rol === 'admin') {
                    const dropdownContent = document.getElementById('dropdown-content');
                    const adminLink = document.createElement('a');
                    adminLink.href = '/admin';
                    adminLink.innerHTML = '👑 Panel Admin';
                    dropdownContent.insertAdjacentElement('afterbegin', adminLink);
                }
            }
        })
        .catch(err => console.error("Error verificando sesión:", err));

    // -----------------------------------------
    // 2. LÓGICA PARA MOSTRAR/OCULTAR CONTRASEÑAS (Genérico)
    // -----------------------------------------
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
        input.addEventListener('dblclick', () => {
            if (input.type === 'password') {
                input.type = 'text';
                input.style.borderColor = '#10b981';
            } else {
                input.type = 'password';
                input.style.borderColor = '#d1d5db';
            }
        });
    });

    // Lógica del ícono de ojo para la página de REGISTRO
    const togglePassword = document.querySelector('#togglePassword');
    const passwordField = document.querySelector('#password');
    if (togglePassword && passwordField) {
        togglePassword.addEventListener('click', function () {
            const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }

    // Lógica del ícono de ojo para la página de LOGIN
    const toggleLogin = document.querySelector('#togglePasswordLogin');
    const passLogin = document.querySelector('#password_login');
    if (toggleLogin && passLogin) {
        toggleLogin.addEventListener('click', function () {
            const type = passLogin.getAttribute('type') === 'password' ? 'text' : 'password';
            passLogin.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }
});