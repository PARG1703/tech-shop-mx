document.addEventListener('DOMContentLoaded', () => {
    cargarCarrito();

    // --- Lógica de Modales ---
    const closeModalBtn = document.getElementById('close-modal-btn');
    const paymentModal = document.getElementById('payment-modal');
    if(closeModalBtn) closeModalBtn.addEventListener('click', () => paymentModal.style.display = 'none');

    const closeShippingModalBtn = document.getElementById('close-shipping-modal-btn');
    const shippingModal = document.getElementById('shipping-modal');
    if(closeShippingModalBtn) closeShippingModalBtn.addEventListener('click', () => shippingModal.style.display = 'none');

    document.getElementById('shipping-form').addEventListener('submit', guardarDireccionYContinuar);
});

function cargarCarrito() {
    fetch('/api/carrito')
        .then(res => {
            if (!res.ok) throw new Error('No logueado');
            return res.json();
        })
        .then(productos => {
            const container = document.getElementById('cart-items');
            const summary = document.getElementById('cart-summary');
            const count = document.querySelector('.cart-header span');
            
            if (productos.length === 0) return; // Muestra el mensaje de "vacío" que ya está en el HTML
            
            count.textContent = `${productos.length} Artículos`;
            container.innerHTML = '<div style="display: flex; flex-direction: column; gap: 15px;"></div>';
            const grid = container.querySelector('div');
            
            let total = 0;

            productos.forEach(prod => {
                total += parseFloat(prod.precio);
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.justifyContent = 'space-between';
                item.style.padding = '15px';
                item.style.border = '1px solid #e5e7eb';
                item.style.borderRadius = '10px';
                
                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <img src="${prod.imagen}" alt="${prod.nombre}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                        <div>
                            <h3 style="font-size: 1.1rem; color: #1f2937;">${prod.nombre}</h3>
                            <p style="color: #6b7280; font-size: 0.9rem;">Estado: ${prod.estado}</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; font-size: 1.2rem; color: var(--primary-color); margin-bottom: 5px;">$${parseFloat(prod.precio).toLocaleString('es-MX')}</div>
                        <button class="btn btn-small" style="background: #ef4444;" onclick="quitarDelCarrito(${prod.id})">🗑️ Quitar</button>
                    </div>
                `;
                grid.appendChild(item);
            });
            
            summary.style.display = 'block';
            document.querySelector('.cart-total').textContent = `Total a pagar: $${total.toLocaleString('es-MX')}`;
            
            // Configurar el botón de pago
            document.getElementById('btn-proceder-pago').addEventListener('click', iniciarProcesoDePago);
            document.getElementById('payment-form').addEventListener('submit', procesarPagoFinal);

        })
        .catch(() => window.location.href = 'iniciosesion.html');
}

function iniciarProcesoDePago() {
    // 1. Obtener la dirección actual del usuario
    fetch('/api/direccion')
        .then(res => res.json())
        .then(direccion => {
            // 2. Llenar el formulario con los datos existentes
            document.getElementById('shipping-calle').value = direccion.calle || '';
            document.getElementById('shipping-numero').value = direccion.numero_ext || '';
            document.getElementById('shipping-colonia').value = direccion.colonia || '';
            document.getElementById('shipping-cp').value = direccion.codigo_postal || '';
            document.getElementById('shipping-ciudad').value = direccion.ciudad || '';

            // 3. Mostrar el modal de dirección
            document.getElementById('shipping-modal').style.display = 'flex';
        })
        .catch(err => console.error('Error al obtener dirección:', err));
}

function guardarDireccionYContinuar(e) {
    e.preventDefault();
    const direccion = {
        calle: document.getElementById('shipping-calle').value,
        numero_ext: document.getElementById('shipping-numero').value,
        colonia: document.getElementById('shipping-colonia').value,
        codigo_postal: document.getElementById('shipping-cp').value,
        ciudad: document.getElementById('shipping-ciudad').value,
        pais: 'México' // Asumimos México, se puede hacer un campo si es necesario
    };

    // 1. Guardar la dirección en la base de datos
    fetch('/api/direccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(direccion)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // 2. Si se guarda bien, ocultar modal de dirección y mostrar el de pago
            document.getElementById('shipping-modal').style.display = 'none';
            document.getElementById('payment-modal').style.display = 'flex';
        } else {
            alert('Hubo un error al guardar tu dirección. Intenta de nuevo.');
        }
    })
    .catch(err => console.error('Error al guardar dirección:', err));
}

function procesarPagoFinal(e) {
    e.preventDefault();
    const payNowBtn = document.getElementById('pay-now-btn');
    
    payNowBtn.disabled = true;
    payNowBtn.textContent = 'Procesando pago... ⏳';

    // Simulación de 2 segundos de procesamiento
    setTimeout(() => {
        fetch('/api/carrito/checkout', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Ocultar modal y carrito, mostrar confirmación personalizada
                    document.getElementById('payment-modal').style.display = 'none';
                    document.querySelector('.cart-container').style.display = 'none';
                    
                    const thankYouMessage = document.getElementById('thank-you-message');
                    thankYouMessage.textContent = `¡Muchas gracias por tu compra, ${data.nombreUsuario}!`;

                    const confirmationView = document.getElementById('order-confirmation');
                    confirmationView.style.display = 'block';
                    confirmationView.classList.add('fade-in-down'); // Añadimos la clase para la animación
                } else {
                    alert('Hubo un error con tu pago. Intenta de nuevo.');
                    payNowBtn.disabled = false;
                    payNowBtn.textContent = 'Pagar';
                }
            });
    }, 2000);
}

window.quitarDelCarrito = function(id) {
    fetch('/api/carrito/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto_id: id })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Recargamos el carrito dinámicamente sin refrescar la página, para una mejor experiencia.
            cargarCarrito();
        }
    });
};