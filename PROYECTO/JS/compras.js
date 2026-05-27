document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/mis-compras')
        .then(res => {
            if (!res.ok) throw new Error('No logueado');
            return res.json();
        })
        .then(orders => {
            const container = document.getElementById('orders-container');
            if (orders.length === 0) {
                container.innerHTML = '<div class="order-card" style="text-align:center; padding: 40px;"><p>No has realizado ninguna compra todavía.</p></div>';
                return;
            }
            container.innerHTML = '';
            orders.forEach(order => {
                const orderCard = document.createElement('div');
                orderCard.className = 'order-card';
                const fecha = new Date(order.fecha_orden).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
                
                orderCard.innerHTML = `
                    <div class="order-header">
                        <span>Pedido realizado el <strong>${fecha}</strong></span>
                        <span>Total: <strong>$${parseFloat(order.total).toLocaleString('es-MX')}</strong></span>
                    </div>
                    <div class="order-body">
                        <p><strong>Estado:</strong> <span class="estado-${order.estado.toLowerCase()}">${order.estado}</span></p>
                        <p>${order.item_count} artículo(s) en este pedido.</p>
                    </div>
                    <div class="order-footer">
                        <span>ID de Pedido: <strong>#${order.id}</strong></span>
                    </div>
                `;
                container.appendChild(orderCard);
            });
        })
        .catch(() => {
            window.location.href = 'iniciosesion.html';
        });
});