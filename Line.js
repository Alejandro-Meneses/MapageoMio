
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
  
