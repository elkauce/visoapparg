import { Label } from "@/components/ui/label.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  DEFAULT_LIGHT,
  kelvinToTemperature,
  LIGHT_LIMITS,
  temperatureToKelvin,
  type KeyLightSetting,
} from "@/lib/key-light.ts";

type LightFieldsProps = {
  value: KeyLightSetting | null;
  onChange: (value: KeyLightSetting | null) => void;
};

// Ajuste de la Key Light para un estado: apagada del todo (sin control), encendida o apagada
export default function LightFields({ value, onChange }: LightFieldsProps) {
  const controlled = value !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="light-control">Controlar la luz con este estado</Label>
        <Switch
          id="light-control"
          checked={controlled}
          onCheckedChange={(on) => onChange(on ? DEFAULT_LIGHT : null)}
        />
      </div>

      {value && (
        <div className="space-y-4 rounded-xl bg-muted/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="light-on">Luz encendida</Label>
            <Switch
              id="light-on"
              checked={value.on}
              onCheckedChange={(on) => onChange({ ...value, on })}
            />
          </div>
          {value.on && (
            <>
              <div className="space-y-2">
                <Label>Brillo: {value.brightness}%</Label>
                <Slider
                  min={LIGHT_LIMITS.minBrightness}
                  max={LIGHT_LIMITS.maxBrightness}
                  step={1}
                  value={[value.brightness]}
                  onValueChange={([brightness]) => onChange({ ...value, brightness })}
                />
              </div>
              <div className="space-y-2">
                <Label>Temperatura: {temperatureToKelvin(value.temperature)}K</Label>
                <Slider
                  min={LIGHT_LIMITS.minKelvin}
                  max={LIGHT_LIMITS.maxKelvin}
                  step={50}
                  value={[temperatureToKelvin(value.temperature)]}
                  onValueChange={([kelvin]) =>
                    onChange({ ...value, temperature: kelvinToTemperature(kelvin) })
                  }
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
