document.addEventListener('DOMContentLoaded', () => {
    cargarReparaciones();
    cargarProductos();

    // Lógica del modal de productos
    document.getElementById('btn-nuevo-producto').addEventListener('click', () => abrirModalProducto());
    document.getElementById('close-product-modal-btn').addEventListener('click', () => cerrarModalProducto());
    document.getElementById('product-form').addEventListener('submit', guardarProducto);
});

function cargarReparaciones() {
    fetch('/api/admin/reparaciones')
        .then(res => res.json())
        .then(reparaciones => {
            const tbody = document.getElementById('reparaciones-tbody');
            tbody.innerHTML = '';

            if (reparaciones.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">No hay reparaciones registradas.</td></tr>';
                return;
            }

            reparaciones.forEach(rep => {
                const tr = document.createElement('tr');
                const fecha = new Date(rep.fecha_solicitud).toLocaleDateString('es-MX');
                
                tr.innerHTML = `
                    <td>${rep.id}</td>
                    <td>${rep.nombre_completo || 'No registrado'}</td>
                    <td>${rep.contacto || 'N/A'}</td>
                    <td>${rep.tipo_dispositivo}</td>
                    <td>${rep.descripcion_falla}</td>
                    <td>${fecha}</td>
                    <td>
                        <select class="status-select" data-id="${rep.id}">
                            <option value="Pendiente" ${rep.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="Recibido" ${rep.estado === 'Recibido' ? 'selected' : ''}>Recibido</option>
                            <option value="Reparando" ${rep.estado === 'Reparando' ? 'selected' : ''}>Reparando</option>
                            <option value="Listo" ${rep.estado === 'Listo' ? 'selected' : ''}>Listo</option>
                        </select>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Añadir eventos a todos los <select>
            document.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    const id = e.target.dataset.id;
                    const nuevoEstado = e.target.value;
                    
                    fetch(`/api/admin/reparaciones/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estado: nuevoEstado })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (!data.success) alert('Error al actualizar el estado.');
                    });
                });
            });
        });
}

function cargarProductos() {
    fetch('/api/admin/productos')
        .then(res => res.json())
        .then(productos => {
            const tbody = document.getElementById('productos-tbody');
            tbody.innerHTML = '';

            if (productos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No hay productos en el catálogo.</td></tr>';
                return;
            }

            productos.forEach(prod => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${prod.id}</td>
                    <td><img src="${prod.imagen}" alt="${prod.nombre}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;"></td>
                    <td>${prod.nombre}</td>
                    <td>$${parseFloat(prod.precio).toLocaleString('es-MX')}</td>
                    <td>${prod.categoria}</td>
                    <td>
                        <button class="btn action-btn edit-btn" onclick="abrirModalProducto(${prod.id})">Editar</button>
                        <button class="btn action-btn delete-btn" onclick="eliminarProducto(${prod.id})">Eliminar</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        });
}

function abrirModalProducto(id = null) {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    form.reset();
    document.getElementById('product-id').value = '';

    if (id) {
        // Modo Edición
        document.getElementById('product-modal-title').textContent = 'Editar Producto';
        fetch(`/api/admin/productos/${id}`)
            .then(res => res.json())
            .then(prod => {
                document.getElementById('product-id').value = prod.id;
                document.getElementById('product-nombre').value = prod.nombre;
                document.getElementById('product-precio').value = prod.precio;
                document.getElementById('product-imagen').value = prod.imagen;
                document.getElementById('product-descripcion').value = prod.descripcion;
                document.getElementById('product-especificaciones').value = prod.especificaciones;
            });
    } else {
        // Modo Creación
        document.getElementById('product-modal-title').textContent = 'Agregar Nuevo Producto';
    }
    modal.style.display = 'flex';
}

function cerrarModalProducto() {
    document.getElementById('product-modal').style.display = 'none';
}

function guardarProducto(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const producto = {
        nombre: document.getElementById('product-nombre').value,
        precio: document.getElementById('product-precio').value,
        imagen: document.getElementById('product-imagen').value,
        descripcion: document.getElementById('product-descripcion').value,
        especificaciones: document.getElementById('product-especificaciones').value
        // Aquí recolectarías los demás campos
    };

    const esNuevo = !id;
    const url = esNuevo ? '/api/admin/productos' : `/api/admin/productos/${id}`;
    const method = esNuevo ? 'POST' : 'PUT';

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(producto)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            cerrarModalProducto();
            cargarProductos(); // Recargar la tabla
        } else {
            alert('Error al guardar el producto.');
        }
    });
}

window.eliminarProducto = function(id) {
    if (!confirm(`¿Estás seguro de que quieres eliminar el producto #${id}? Esta acción no se puede deshacer.`)) {
        return;
    }

    fetch(`/api/admin/productos/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                cargarProductos(); // Recargar la tabla
            } else {
                alert('Error al eliminar el producto.');
            }
        });
}