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

// Detectar la IP del cliente
async function detectClientIP() {
  try {
    const response = await fetch('https://ipinfo.io/json?token=58cfb474c004c3');
    const data = await response.json();
    const loc = data.loc.split(",");
    const latitude = parseFloat(loc[0]);
    const longitude = parseFloat(loc[1]);
    const city = data.city || "Desconocida";
    const country = data.country || "Desconocido";

    const visita = {
      ip: data.ip,
      lat: latitude,
      lon: longitude,
      ciudad: city,
      pais: country,
      status: 'active'
    };

    // Enviar la información al servidor
    await fetch('/save-ip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(visita)
    });

    console.log('Información de IP enviada al servidor:', visita);
  } catch (error) {
    console.error('Error al detectar IP:', error);
  }
}

// Llamar a la función detectClientIP cuando se carga la página
window.onload = async () => {
  await detectClientIP();
  cargarIpsDesdeLocalStorage();
};

// Configuración del WebSocket
const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
  console.log('Conexión WebSocket abierta');
};

socket.onmessage = (event) => {
  const visita = JSON.parse(event.data);
  actualizarMarcadores([visita]);
  guardarIpsEnLocalStorage(visita);
};

socket.onerror = (error) => {
  console.error('Error en WebSocket:', error);
};

socket.onclose = () => {
  console.log('Conexión WebSocket cerrada');
};

const marcadores = new Map();

// Función para actualizar los marcadores en el mapa
function actualizarMarcadores(ipsActivas) {
  const nuevasIps = new Set(ipsActivas.map(ip => ip.ip));

  // Eliminar marcadores de IPs que ya no están activas
  for (const [ip, marker] of marcadores) {
    if (!nuevasIps.has(ip)) {
      marker.remove();
      marcadores.delete(ip);
    }
  }

  // Añadir nuevos marcadores y mantener los existentes
  ipsActivas.forEach(ip => {
    if (!marcadores.has(ip.ip)) {
      const marker = agregarMarcador(ip.lat, ip.lon, `
        <div style="text-align: center;">
          <h3 style="margin: 0; color: #333;">${ip.pais}</h3>
          <p style="margin: 0;">Ciudad: <b>${ip.ciudad}</b></p>
        </div>
      `);
      marcadores.set(ip.ip, marker);
    }
  });
}

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
  return new mapboxgl.Marker(el)
    .setLngLat([lon, lat]) // Coordenadas
    .setPopup(new mapboxgl.Popup().setHTML(popupInfo)) // Popup asociado
    .addTo(map);
}

// Función para guardar las IPs activas en el localStorage
function guardarIpsEnLocalStorage(visita) {
  let ipsActivas = JSON.parse(localStorage.getItem('ipsActivas')) || [];
  ipsActivas.push(visita);
  localStorage.setItem('ipsActivas', JSON.stringify(ipsActivas));
}

// Función para cargar las IPs activas desde el localStorage
function cargarIpsDesdeLocalStorage() {
  const ipsActivas = JSON.parse(localStorage.getItem('ipsActivas'));
  if (ipsActivas) {
    actualizarMarcadores(ipsActivas);
  }
}