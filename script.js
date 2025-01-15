// Configuración del mapa con Mapbox
const maptilerkey = "JA1CxEdD438plygBeIFj";
mapboxgl.accessToken = 'pk.eyJ1IjoiYWxlbWVzYTQiLCJhIjoiY200cjU1eGR0MDFjdzJrc2lwejZ6cGx4YSJ9.ZyDg8WWmuh97A7kvhtBn3g';

const map = new mapboxgl.Map({
  container: 'map', // ID del contenedor en index.html
  style: `https://api.maptiler.com/maps/cd7a6c9f-0b93-475d-ac25-d605335afbab/style.json?key=${maptilerkey}`,
  center: [-50, 0], // Centro inicial del mapa
  zoom: 2,
  renderWorldCopies: false,
  dragRotate: false,
  touchPitch: false,
  maxPitch: 0,
  maxBounds: [
    [-160, -60], // Suroeste: límite inferior izquierdo (longitud, latitud)
    [70, 70]     // Noreste: límite superior derecho (longitud, latitud)
]

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

    // Obtener la hora local en la zona horaria de España
    const timestamp = new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date());

    const visita = {
      ip: data.ip,
      lat: latitude,
      lon: longitude,
      ciudad: city,
      pais: country,
      timestamp // Usar la hora local en la zona horaria de España
    };

    // Enviar visita al servidor
    await fetch('http://localhost:3000/api/visitas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
};

// Configuración del WebSocket
const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
  console.log('Conexión WebSocket abierta');
};

socket.onmessage = (event) => {
  const visitas = JSON.parse(event.data);
  console.log('Datos recibidos de WebSocket:', visitas);
  actualizarMarcadores(visitas);
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

  // Añadir nuevos marcadores y mantener los existentes
  ipsActivas.forEach(ip => {
    if (!marcadores.has(ip.ip)) {
      // Validar lat y lon antes de crear el marcador
      if (isNaN(ip.lat) || isNaN(ip.lon)) {
        console.error('Datos de IP con coordenadas inválidas:', ip);
        return;
      }
      const marker = agregarMarcador(ip.lat, ip.lon, `
        <div style="text-align: center;">
          <h3 style="margin: 0; color: #333;">${ip.pais}</h3>
          <p style="margin: 0;">Ciudad: <b>${ip.ciudad}</b></p>
          <p style="margin: 0;">Hora: <b>${ip.timestamp}</b></p>
        </div>
      `);
      marcadores.set(ip.ip, marker);
    }
  });

}

// Función para agregar un marcador al mapa
function agregarMarcador(lat, lon, popupInfo, duration = 5 * 60 * 1000) { // Duración de 5 minutos por defecto
  if (isNaN(lat) || isNaN(lon)) {
    console.error('Coordenadas inválidas:', { lat, lon });
    return null;
  }

  // Crear el contenedor del marcador
  const el = document.createElement('div');
  el.className = 'marker';

  // Crear el efecto de pulso dentro del marcador
  const pulse = document.createElement('div');
  pulse.className = 'pulse';
  el.appendChild(pulse);

  // Crear el popup asociado al marcador
  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
  }).setHTML(popupInfo);

  // Agregar eventos al marcador para mostrar y ocultar el popup
  el.addEventListener('mouseenter', () => {
    popup.setLngLat([lon, lat]).addTo(map);
  });
  el.addEventListener('mouseleave', () => {
    popup.remove();
  });

  // Crear el marcador y añadirlo al mapa
  const marker = new mapboxgl.Marker({
    element: el,
    anchor: 'center'
  })
    .setLngLat([lon, lat])
    .addTo(map);

  // Reducir opacidad gradualmente
  const interval = 100; // Intervalo de 100 ms
  const steps = duration / interval;
  let currentStep = 0;

  const fadeInterval = setInterval(() => {
    currentStep++;
    const newOpacity = 1 - currentStep / steps; // Calcular la nueva opacidad
    el.style.opacity = newOpacity.toFixed(2);

    if (currentStep >= steps) {
      clearInterval(fadeInterval); // Detener la reducción
      marker.remove(); // Eliminar el marcador del mapa
    }
  }, interval);

  return marker;
}

// Función para guardar las IPs activas en el localStorage
// function guardarIpsEnLocalStorage(visitas) {
//   let ipsActivas = JSON.parse(localStorage.getItem('ipsActivas')) || [];
//   visitas.forEach(visita => {
//     if (!ipsActivas.some(ip => ip.ip === visita.ip)) {
//       ipsActivas.push(visita);
//     }
//   });
//   localStorage.setItem('ipsActivas', JSON.stringify(ipsActivas));
// }

// // Función para cargar las IPs activas desde el localStorage
// function cargarIpsDesdeLocalStorage() {
//   const ipsActivas = JSON.parse(localStorage.getItem('ipsActivas'));
//   if (ipsActivas) {
//     actualizarMarcadores(ipsActivas);
//   }
// }
