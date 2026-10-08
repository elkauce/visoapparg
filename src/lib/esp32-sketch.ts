// Ejemplo para ESP32 con una tira o aro WS2812 (NeoPixel). Consulta el estado y pinta el color
export function buildEsp32Sketch(statusUrl: string): string {
  return `#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Adafruit_NeoPixel.h>

const char* WIFI_SSID = "TU_WIFI";
const char* WIFI_PASS = "TU_CLAVE";
const char* STATUS_URL = "${statusUrl}";

#define LED_PIN 5
#define LED_COUNT 8
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
  strip.setBrightness(120);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(300);
}

void paint(int r, int g, int b) {
  for (int i = 0; i < LED_COUNT; i++) strip.setPixelColor(i, strip.Color(r, g, b));
  strip.show();
}

void loop() {
  WiFiClientSecure client;
  client.setInsecure();  // simple para empezar; usa un certificado raiz en produccion
  HTTPClient http;
  if (http.begin(client, STATUS_URL) && http.GET() == 200) {
    int r, g, b;
    if (sscanf(http.getString().c_str(), "%d,%d,%d", &r, &g, &b) == 3) paint(r, g, b);
  }
  http.end();
  delay(5000);  // cada 5 segundos es suficiente
}
`;
}
