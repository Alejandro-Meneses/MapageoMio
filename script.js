// Configuración del mapa con Mapbox
const maptilerkey = "JA1CxEdD438plygBeIFj";
mapboxgl.accessToken = 'pk.eyJ1IjoiYWxlbWVzYTQiLCJhIjoiY200cjU1eGR0MDFjdzJrc2lwejZ6cGx4YSJ9.ZyDg8WWmuh97A7kvhtBn3g';

const map = new mapboxgl.Map({
  container: 'map', // ID del contenedor en index.html
  style: `https://api.maptiler.com/maps/cd7a6c9f-0b93-475d-ac25-d605335afbab/style.json?key=${maptilerkey}`,
  center: [0, 0],
  zoom: 2,
  renderWorldCopies: false,
  dragRotate: false, // Desactiva rotación
  touchPitch: false, // Desactiva inclinación
  maxPitch: 0 // Bloquea vista 3D
});

// Configuración del WebSocket
const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
  console.log('Conexión WebSocket abierta');
};

socket.onmessage = (event) => {
  const visita = JSON.parse(event.data);

  // Agregar marcador dinámico al mapa
  agregarMarcador(visita.lat, visita.lon, `
    <div style="text-align: center;">
      <h3 style="margin: 0; color: #333;">${visita.pais}</h3>
      <p style="margin: 0;">Ciudad: <b>${visita.ciudad}</b></p>
    </div>
  `);
};

socket.onerror = (error) => {
  console.error('Error en WebSocket:', error);
};

socket.onclose = () => {
  console.log('Conexión WebSocket cerrada');
};

// Función para agregar un marcador al mapa
function agregarMarcador(lat, lon, popupInfo) {
  // Crear el contenedor del marcador
  const el = document.createElement('div');
  el.className = 'marker';

  // Añadir un SVG con un halo circular
  el.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="12" cy="12" r="5" fill="rgba(255, 255, 0, 0.9)" style="filter: url(#glow);" />
    </svg>
  `;

  // Crear y añadir el marcador al mapa
  new mapboxgl.Marker(el)
    .setLngLat([lon, lat]) // Coordenadas
    .setPopup(new mapboxgl.Popup().setHTML(popupInfo)) // Popup asociado
    .addTo(map);
}


