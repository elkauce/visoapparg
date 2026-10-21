// Development-only capture fixture. Vite's production entry does not include it.
// Render the actual VISO components with labelled example data; no user account,
// microphone, physical light command or external provider is accessed.
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import WeatherScreen from "../../src/pages/deck/_components/weather-screen";
import SportsScreen from "../../src/pages/deck/_components/sports-screen";
import StandbyScreen from "../../src/pages/deck/_components/standby-screen";
import SpotifyScreen from "../../src/pages/deck/_components/spotify-screen";
import { normalizeScreenSettings } from "../../convex/lib/screen_settings";
import { normalizeStandbySettings } from "../../convex/lib/clock_settings";
import { drawReferenceMeter } from "../../src/pages/deck/_lib/vu-renderer";
import "../../src/index.css";

const params = new URLSearchParams(location.search);
const kind = params.get("kind") ?? "weather";
const variant = params.get("style") ?? "spectrum-led";
const date = "2026-10-21";
const settings = normalizeScreenSettings({ city: "Buenos Aires", sportsDate: date, sportsLeague: "ligaarg" });
const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const times = Array.from({ length: 48 }, (_, i) => `${date}T${String(i % 24).padStart(2,"0")}:00`);
query.setQueryData(["full-weather", settings.latitude, settings.longitude, settings.units], {
  timezone: "America/Argentina/Buenos_Aires",
  current: { time: `${date}T09:00`, temperature_2m: 18, relative_humidity_2m: 68, apparent_temperature: 17, is_day: 1, precipitation: 0, weather_code: 2, cloud_cover: 40, wind_speed_10m: 12, wind_direction_10m: 90, pressure_msl: 1015 },
  hourly: { time: times, temperature_2m: times.map((_, i) => 18 + Math.round(Math.sin(i / 4) * 4)), precipitation_probability: times.map(() => 10), weather_code: times.map(() => 2), visibility: times.map(() => 12000) },
  daily: { time: Array.from({length:7},(_,i)=>`2026-10-${21+i}`), weather_code: [2,0,3,61,2,0,1], temperature_2m_max: [24,25,22,20,23,26,25], temperature_2m_min: [15,16,14,13,15,17,16], sunrise: times.slice(0,7).map(()=>`${date}T06:10`), sunset: times.slice(0,7).map(()=>`${date}T19:15`), uv_index_max: [5,6,3,2,5,7,6], precipitation_probability_max: [10,0,30,80,20,0,10] },
});
const team = (name:string, score:string, homeAway:string) => ({ name, score, homeAway, logo:null });
query.setQueryData(["sports-full", "ligaarg", date], [
  { id:"example-1", name:"Partido de ejemplo", date:`${date}T19:00:00-03:00`, state:"in", detail:"65′", venue:"Estadio · vista de ejemplo", competitors:[team("Equipo local","2","home"), team("Equipo visitante","1","away")] },
  { id:"example-2", name:"Encuentro de ejemplo", date:`${date}T21:00:00-03:00`, state:"post", detail:"Finalizado", competitors:[team("Club del Sur","1","home"), team("Club del Norte","1","away")] },
  { id:"example-3", name:"Próximo encuentro", date:`${date}T22:00:00-03:00`, state:"pre", detail:"22:00", competitors:[team("Atlético Central","—","home"), team("Deportivo Oeste","—","away")] },
]);
const client = new ConvexReactClient("http://127.0.0.1:3210");
const noop = () => undefined;

function Meter() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas=ref.current!; const ctx=canvas.getContext("2d")!;
    canvas.width=canvas.clientWidth*2; canvas.height=canvas.clientHeight*2;
    const bands=Array.from({length:32},(_,i)=>0.1+0.65*Math.exp(-Math.pow((i-11)/5,2))+0.25*Math.exp(-Math.pow((i-26)/3,2)));
    const frame={bands,level:0.13,peak:0.42,channelLevels:[0.13,0.19],wave:Array.from({length:256},(_,i)=>Math.sin(i/6)*0.35),db:-18};
    const held=Array(32).fill(0), smooth=[0,0];
    for(let i=0;i<40;i++)drawReferenceMeter(ctx,canvas.width,canvas.height,variant as Parameters<typeof drawReferenceMeter>[3],frame,1,"#a3ff12",held,smooth);
  }, []);
  return <canvas ref={ref} style={{width:"100%",height:"100%"}} />;
}
function Content() {
  if(kind==="weather") return <WeatherScreen settings={settings} active={false} />;
  if(kind==="football") return <SportsScreen settings={settings} active={false} />;
  if(kind==="visualizer") return <Meter />;
  if(kind==="spotify") {
    // Preview the Android presentation, not a fabricated Spotify web API.
    Capacitor.isNativePlatform=()=>true; Capacitor.getPlatform=()=>"android";
    return <div style={{padding:32,height:"100%",background:"#141619",color:"white"}}><SpotifyScreen media={{permissionGranted:true,available:true,packageName:"com.spotify.music",sourceName:"Spotify",title:"Reproducción de ejemplo",artist:"Vista previa de VISO",album:"Datos de demostración",artwork:"/marketplace/covers/original-icons.png",state:"playing",positionMs:48000,durationMs:210000,canPlayPause:true,canNext:true,canPrevious:true}} loading={false} pending={false} error={null} onCommand={noop} onRefresh={noop} onRequestAccess={noop} /></div>;
  }
  return <StandbyScreen userId="preview-only" media={null} mediaLoading={false} activeStatus={{name:"Libre",color:"#22c55e"}} connected={true} onMediaCommand={noop} mediaBusy={false} sharedSettings={normalizeStandbySettings({clockStyle:"digital",showMusic:false,showBattery:false,accent:"#a3ff12"})} sharedPhotos={[]} />;
}
createRoot(document.getElementById("root")!).render(<ConvexProvider client={client}><QueryClientProvider client={query}><div style={{height:"100dvh",display:"flex",flexDirection:"column",background:"#141619"}}><div style={{flex:1,minHeight:0,overflow:"hidden"}}><Content /></div><p style={{height:28,flexShrink:0,display:"grid",placeItems:"center",margin:0,background:"#f5f3ef",color:"#4d4c48",fontSize:10,fontFamily:"system-ui",letterSpacing:1}}>CAPTURA DE VISO · DATOS DE EJEMPLO{kind==="spotify" ? " · VISTA ANDROID" : ""}</p></div></QueryClientProvider></ConvexProvider>);
