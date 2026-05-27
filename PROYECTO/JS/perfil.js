document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/perfil')
        .then(response => {
            if (!response.ok) {
                // Si no hay sesión, mandamos al usuario al login
                window.location.href = 'iniciosesion.html';
            }
            return response.json();
        })
        .then(data => {
            // Llenamos el HTML con los datos recibidos de MySQL
            document.getElementById('display-username').textContent = `@${data.username}`;
            document.getElementById('info-nombre').textContent = data.nombre_completo;
            document.getElementById('info-contacto').textContent = data.contacto;
            document.getElementById('info-pais').textContent = data.pais;
            document.getElementById('info-ciudad').textContent = data.ciudad;
        })
        .catch(error => console.error('Error al cargar el perfil:', error));
});