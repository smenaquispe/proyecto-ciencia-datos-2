"use client"

import { useState } from "react"
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps"
import type { Country } from "@/lib/types"

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

// Map country_name from our DB → ISO 3166-1 alpha-3 or display name patterns
// We use lat/lng markers on top of the real map
const COUNTRY_COLORS: Record<string, string> = {
  "Spain":                        "#c60b1e",
  "England":                      "#012169",
  "Germany":                      "#000000",
  "France":                       "#002395",
  "Italy":                        "#0066cc",
  "Argentina":                    "#74acdf",
  "Africa":                       "#e8a838",
  "Europe":                       "#4a6fa5",
  "International":                "#27ae60",
  "India":                        "#ff671f",
  "North and Central America":    "#bf0a30",
  "South America":                "#009c3b",
  "United States of America":     "#3c3b6e",
}

interface Props {
  countries: Country[]
  selected: Country | null
  onSelect: (c: Country) => void
  mapHeight?: number
}

export default function WorldMap({ countries, selected, onSelect, mapHeight = 280 }: Props) {
  const [tooltip, setTooltip] = useState<{ name: string; matches: number; x: number; y: number } | null>(null)

  return (
    <div className="relative w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
      <div className="px-4 pt-3 pb-1 text-xs text-slate-400 font-semibold uppercase tracking-widest">
        Selecciona un País — {countries.length} disponibles
      </div>

      <div style={{ width: "100%", height: mapHeight }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 90, center: [10, 20] }}
          style={{ width: "100%", height: "100%", background: "#0f172a" }}
        >
          <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={4}>
            {/* Real world map geography */}
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: any[] }) =>
                geographies.map((geo: any) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={0.4}
                    style={{
                      default: { outline: "none" },
                      hover:   { fill: "#334155", outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* Country markers */}
            {countries.map((c) => {
              const isSelected = selected?.country_name === c.country_name
              const color = COUNTRY_COLORS[c.country_name] ?? "#64748b"
              const r = Math.max(8, Math.min(22, 6 + Math.sqrt(c.matches) * 0.7))

              return (
                <Marker
                  key={c.country_name}
                  coordinates={[c.lng, c.lat]}
                  onClick={() => onSelect(c)}
                  onMouseEnter={(e: any) => {
                    setTooltip({ name: c.country_name, matches: c.matches, x: e.clientX, y: e.clientY })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Pulse ring for selected */}
                  {isSelected && (
                    <circle r={r + 6} fill="none" stroke="#f59e0b" strokeWidth={2} opacity={0.7}>
                      <animate attributeName="r" from={r + 2} to={r + 10} dur="1.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.7" to="0" dur="1.4s" repeatCount="indefinite" />
                    </circle>
                  )}

                  <circle
                    r={r}
                    fill={isSelected ? "#f59e0b" : color}
                    fillOpacity={isSelected ? 1 : 0.82}
                    stroke={isSelected ? "#fbbf24" : "rgba(255,255,255,0.5)"}
                    strokeWidth={isSelected ? 2 : 0.8}
                    style={{ cursor: "pointer", transition: "all 0.15s" }}
                  />
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fontSize={r > 13 ? 8 : 6}
                    fontWeight="bold"
                    fill={isSelected ? "#000" : "white"}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {c.matches}
                  </text>
                </Marker>
              )
            })}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white shadow-xl pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="font-bold">{tooltip.name}</div>
          <div className="text-slate-400">{tooltip.matches} partidos</div>
        </div>
      )}

      {/* Selected info */}
      <div className="px-4 pb-3 pt-1 text-xs">
        {selected ? (
          <span className="text-amber-400 font-semibold">
            ✓ {selected.country_name} · {selected.matches} partidos · {selected.competitions} ligas
          </span>
        ) : (
          <span className="text-slate-600">Haz clic en un punto del mapa</span>
        )}
      </div>
    </div>
  )
}
