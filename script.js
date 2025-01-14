// Configuración del mapa con Mapbox
const maptilerkey = "JA1CxEdD438plygBeIFj";
mapboxgl.accessToken = 'pk.eyJ1IjoiYWxlbWVzYTQiLCJhIjoiY200cjU1eGR0MDFjdzJrc2lwejZ6cGx4YSJ9.ZyDg8WWmuh97A7kvhtBn3g';

const map = new mapboxgl.Map({
  container: 'map', // ID del contenedor en index.html
  style: `https://api.maptiler.com/maps/cd7a6c9f-0b93-475d-ac25-d605335afbab/style.json?key=${maptilerkey}`,
  center: [0, 0],
  zoom: 2,
  renderWorldCopies: false,
  dragRotate: false,
  touchPitch: false,
  maxPitch: 0
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

    // Enviar visita al servidor
    await fetch('http://localhost:3000/api/visitas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visita)
    });

    console.log('Información de IP enviada al servidor:', visita);
    guardarIpsEnLocalStorage([visita]); // Guardar la IP detectada en el localStorage
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
  const visitas = JSON.parse(event.data);
  console.log('Datos recibidos de WebSocket:', visitas);
  actualizarMarcadores(visitas);
  guardarIpsEnLocalStorage(visitas); // Guardar las IPs recibidas en el localStorage
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
      // Validar lat y lon antes de crear el marcador
      if (isNaN(ip.lat) || isNaN(ip.lon)) {
        console.error('Datos de IP con coordenadas inválidas:', ip);
        return;
      }
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
  // Verificar que las coordenadas sean válidas
  if (isNaN(lat) || isNaN(lon)) {
    console.error('Coordenadas inválidas:', { lat, lon });
    return null; // No intentar crear el marcador
  }

  const el = document.createElement('div');
  el.className = 'marker';

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

  return new mapboxgl.Marker(el)
    .setLngLat([lon, lat])
    .setPopup(new mapboxgl.Popup().setHTML(popupInfo))
    .addTo(map);
}

// Función para guardar las IPs activas en el localStorage
function guardarIpsEnLocalStorage(visitas) {
  let ipsActivas = JSON.parse(localStorage.getItem('ipsActivas')) || [];
  visitas.forEach(visita => {
    if (!ipsActivas.some(ip => ip.ip === visita.ip)) {
      ipsActivas.push(visita);
    }
  });
  localStorage.setItem('ipsActivas', JSON.stringify(ipsActivas));
}

// Función para cargar las IPs activas desde el localStorage
function cargarIpsDesdeLocalStorage() {
  const ipsActivas = JSON.parse(localStorage.getItem('ipsActivas'));
  if (ipsActivas) {
    actualizarMarcadores(ipsActivas);
  }
}

map.on('load', () => {
  // 1. Obtenemos la línea terminadora y un polígono que represente la parte nocturna
  const terminatorLine = createTerminatorLine();
  const nightPolygon = createNightPolygon(terminatorLine);

  // 2. Agregamos la fuente y capa de la LÍNEA
  map.addSource('terminator-line', {
    type: 'geojson',
    data: terminatorLine
  });

  map.addLayer({
    id: 'terminator-line',
    type: 'line',
    source: 'terminator-line',
    paint: {
      'line-color': '#ffe482',
      'line-width': 2
    }
  });

  // 3. Agregamos la fuente y capa de la SOMBRA nocturna
  map.addSource('terminator-night', {
    type: 'geojson',
    data: nightPolygon
  });

  map.addLayer({
    id: 'terminator-night',
    type: 'fill',
    source: 'terminator-night',
    paint: {
      'fill-color': '#000000',
      'fill-opacity': 0.4
    }
  });

   setInterval(() => {
   const newTerminatorLine = createTerminatorLine();
    const newNightPolygon = createNightPolygon(newTerminatorLine);
   map.getSource('terminator-line').setData(newTerminatorLine);
   map.getSource('terminator-night').setData(newNightPolygon);
  }, 60_000); // cada 1 minuto
});

/**
 * Genera el GeoJSON de la línea terminadora (LineString).
 * Se basa en un cálculo aproximado del punto subsolar y traza un gran círculo a 90°.
 */
function createTerminatorLine(date = new Date()) {
  const coords = getTerminatorCoordinates(date);
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: coords
    }
  };
}

/**
 * Genera el GeoJSON de un polígono que representa la parte NOCTURNA,
 * tomando la línea terminadora y "cerrándola" por el lado oscuro.
 */
function createNightPolygon(terminatorLineFeature) {
  // Extraemos las coords de la línea
  const coords = terminatorLineFeature.geometry.coordinates;
  // Hacemos una copia invertida (para que el polígono cubra el lado opuesto)
  const reversed = [...coords].reverse();
  // Cerramos el polígono repitiendo la primera coordenada al final
  reversed.push(reversed[0]);

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [reversed]
    }
  };
}

/**
 * Cálculo astronómico aproximado para la línea terminadora.
 * Devuelve un array de [lng, lat].
 */
function getTerminatorCoordinates(date = new Date()) {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  // Convertir fecha a Julian day (aprox)
  function toJulianDay(d) {
    return (d / 86400000) + 2440587.5;
  }

  const jd = toJulianDay(date);
  const n = jd - 2451545.0; // días desde 2000-01-01 12:00 UTC

  // Longitud media del Sol
  const L = 280.46 + 0.9856474 * n;
  // Anomalía media del Sol
  const g = 357.528 + 0.9856003 * n;
  // Eclíptica (lambda)
  const lambda = L + 1.915 * Math.sin(g * rad) + 0.02 * Math.sin(2 * g * rad);
  // Oblicuidad de la eclíptica
  const obliq = 23.439 - 0.0000004 * n;

  // Declinación
  const delta = Math.asin(Math.sin(obliq * rad) * Math.sin(lambda * rad)) * deg;

  // Ascensión recta aproximada
  const alpha = Math.atan(Math.cos(obliq * rad) * Math.tan(lambda * rad)) * deg;

  // Ajustar ascensión recta (ra)
  let ll = alpha - L;
  if (Math.abs(ll) > 180) {
    ll = ll + (ll > 0 ? -360 : 360);
  }
  const ra = L + ll;

  // Tiempo sideral en Greenwich
  const UT = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const GMST0 = ra / 15;
  const GMST = GMST0 + UT;
  let lng = -(GMST * 15) % 360;
  if (lng < -180) lng += 360;
  if (lng > 180)  lng -= 360;

  const lat = delta;

  // Trazamos un gran círculo a 90° de distancia
  const step = 2; // puedes reducirlo para mayor precisión
  const terminatorCoords = [];
  for (let bearing = 0; bearing <= 360; bearing += step) {
    const point = destination(lat, lng, 90, bearing);
    // point devuelto en [lat2, lng2], lo invertimos a [lng2, lat2]
    terminatorCoords.push([point[1], point[0]]);
  }
  return terminatorCoords;
}

/**
 * Calcula un punto destino a 'dist' grados de distancia desde (lat, lng), con 'bearing' en grados.
 * Fórmula de navegación en esfera (geodesia aproximada).
 */
function destination(lat, lng, dist, bearing) {
  const rad = Math.PI / 180;
  const lat1 = lat * rad;
  const lng1 = lng * rad;
  const brng = bearing * rad;
  const d = dist * rad; // dist en "grados de arco" => radianes

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [lat2 * (180 / Math.PI), lng2 * (180 / Math.PI)];
}
