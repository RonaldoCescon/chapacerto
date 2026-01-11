'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Lock, MapPin, UserCircle } from 'lucide-react';
import { useEffect } from 'react';

// --- CONFIGURAÇÃO DOS ÍCONES ---
// Criamos ícones personalizados usando HTML/CSS para não depender de imagens
const createCustomIcon = (type: 'user' | 'driver', label?: string) => {
  const colorClass = type === 'user' ? 'bg-blue-600' : 'bg-green-600';
  const iconHtml = `
    <div class="relative flex items-center justify-center">
      <div class="${colorClass} w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white">
        ${type === 'user' 
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>' 
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'}
      </div>
      ${label ? `<span class="absolute -bottom-6 bg-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md whitespace-nowrap border border-gray-200">${label}</span>` : ''}
    </div>
  `;

  return L.divIcon({
    className: 'custom-icon',
    html: iconHtml,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

// --- COMPONENTE AUXILIAR PARA CENTRALIZAR O MAPA ---
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 14); // Zoom 14
  }, [center, map]);
  return null;
}

// --- PROPS DO COMPONENTE ---
interface MapRadarProps {
  userLat: number | null;
  userLng: number | null;
  drivers: any[];
  onSelectDriver: (driver: any) => void;
}

export default function MapRadar({ userLat, userLng, drivers, onSelectDriver }: MapRadarProps) {
  // Se não tiver GPS do usuário, mostra um loading ou nada
  if (!userLat || !userLng) return <div className="h-full w-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">Aguardando GPS...</div>;

  return (
    <div className="h-[400px] w-full rounded-3xl overflow-hidden shadow-inner border border-gray-200 relative z-0">
      <MapContainer 
        center={[userLat, userLng]} 
        zoom={14} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
      >
        <ChangeView center={[userLat, userLng]} />
        
        {/* Mapa Gratuito do OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Marcador do USUÁRIO (Você) */}
        <Marker position={[userLat, userLng]} icon={createCustomIcon('user', 'Você')}>
          <Popup>Você está aqui</Popup>
        </Marker>

        {/* Marcadores dos CHAPAS */}
        {drivers.map((driver) => {
            if (!driver.last_lat || !driver.last_lng) return null;
            
            return (
              <Marker 
                key={driver.id} 
                position={[driver.last_lat, driver.last_lng]} 
                icon={createCustomIcon('driver', driver.nome_razao.split(' ')[0])}
              >
                <Popup>
                  <div className="text-center min-w-[150px]">
                    <h3 className="font-bold text-gray-900">{driver.nome_razao}</h3>
                    <div className="flex flex-wrap gap-1 justify-center my-2">
                        {driver.skills?.slice(0,2).map((s: string) => (
                            <span key={s} className="text-[9px] bg-blue-50 text-blue-600 px-1 rounded uppercase font-bold">{s.replace('_',' ')}</span>
                        ))}
                    </div>
                    <button 
                        onClick={() => onSelectDriver(driver)}
                        className="w-full bg-green-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-green-700"
                    >
                        <Lock size={12}/> Liberar (R$ 4,99)
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
        })}
      </MapContainer>
    </div>
  );
}