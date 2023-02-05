/* 
 
*/
#include <ESP8266WiFi.h>
#include <WiFiManager.h>
#include <ESP8266httpUpdate.h>
#include <ESP8266HTTPClient.h>
#include <EEPROM.h>
#include <LittleFS.h>
#include "TCP2UART.h"
//#include "SPI.h"

#include <ArduinoOTA.h>
static int otaPartProcentCount = 0;

#include <ESP8266WebServer.h>

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
//#include <Fonts/FreeMono9pt7b.h>

#include <ArduinoJson.h>

#include "FSBrowser.h"
extern const char upload_html[];
FSBrowser fsBrowser;

#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 32 // OLED display height, in pixels

#define SCREEN_ADDRESS 0x3C ///< See datasheet for Address; 0x3D for 128x64, 0x3C for 128x32
Adafruit_SSD1306 display(128, 64, &Wire, -1); // -1 = no reset pin

#define DEBUG_UART Serial1

TCP2UART tcp2uart;


// QUICKFIX...See https://github.com/esp8266/Arduino/issues/263
#define min(a,b) ((a)<(b)?(a):(b))
#define max(a,b) ((a)>(b)?(a):(b))

#define LED_PIN 5                       // 0 = GPIO0, 2=GPIO2
#define LED_COUNT 50

#define WIFI_TIMEOUT 30000              // checks WiFi every ...ms. Reset after this time, if WiFi cannot reconnect.
#define HTTP_PORT 80

unsigned long auto_last_change = 0;
unsigned long last_wifi_check_time = 0;

ESP8266WebServer server(HTTP_PORT);
HTTPClient http;
WiFiClient client;

unsigned long currTime = 0;
unsigned long deltaTime_second = 0;

void printESP_info(void);
void checkForUpdates(void);
void setup_BasicOTA(void);
void sendOneSpiByte(uint8_t data);

void oled_LCD_write12digitDec(uint32_t value, uint8_t maxDigits, uint8_t dotPos);

void srv_handle_list_files();
bool handleFileRead(String path);
String getContentType(String filename);
bool write_to_file(String file_name, String contents);
bool load_from_file(String file_name, String &contents);


DynamicJsonDocument jsonDoc(1024);

#define HOME_ASSISTANT_SETTINGS_FILENAME "/ha/settings.json"

bool loadHomeAssistantSettings()
{
    String json = "";
    if (!load_from_file(HOME_ASSISTANT_SETTINGS_FILENAME, json))
    {
        jsonDoc["count"] = 8;
        jsonDoc["authorization"] = F("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIzN2NlMjg4ZGVkMWE0OTBhYmIzNDYxMDNiM2YzMzIzNCIsImlhdCI6MTY2OTkwNjI1OCwiZXhwIjoxOTg1MjY2MjU4fQ.XP-8H5PRQG6tJ8MBYmiN0I4djs-KpahZliTrnPTvlcQ");
        jsonDoc["server"] = F("http://192.168.1.107:8123/api/states/");
        jsonDoc["items"][0]["id"] = "item1";
        jsonDoc["items"][1]["id"] = "item2";
        jsonDoc["items"][2]["id"] = "item3";
        jsonDoc["items"][3]["id"] = "item4";
        jsonDoc["items"][4]["id"] = "item5";
        jsonDoc["items"][5]["id"] = "item6";
        jsonDoc["items"][6]["id"] = "item7";
        jsonDoc["items"][7]["id"] = "item8";
        serializeJsonPretty(jsonDoc, json);
        write_to_file(HOME_ASSISTANT_SETTINGS_FILENAME, json);
        return false;
    }
    deserializeJson(jsonDoc, json);
    return true;
}

void setup() {
    LittleFS.begin();

    loadHomeAssistantSettings();

    DEBUG_UART.begin(115200);
    DEBUG_UART.println(F("\r\n!!!!!Start of MAIN Setup!!!!!\r\n"));


    if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
    {
        delay(2000);
        display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
        delay(2000);
        display.clearDisplay();
        display.display();
        display.setTextSize(1);
        display.setTextColor(WHITE, BLACK);
    }
    else{
        DEBUG_UART.println(F("oled init fail"));
        if (display.begin(SSD1306_SWITCHCAPVCC, 0x3D))
            DEBUG_UART.println(F("oled addr is 0x3D"));
    }
    
    printESP_info();
    
    WiFiManager wifiManager;
    DEBUG_UART.println(F("trying to connect to saved wifi"));
    
    display.setCursor(0, 0);
    display.println("WiFi connecting...");
    display.display();
    if (wifiManager.autoConnect() == true) { // using ESP.getChipId() internally
        display.setCursor(0, 9);
        display.println("OK");
        display.setCursor(0, 17);
        display.println(WiFi.localIP());
        display.display();
    } else {
        display.setCursor(0, 9);
        display.println("FAIL");
        display.display();
    }
    //delay(2000);
    //checkForUpdates();
    setup_BasicOTA();
    tcp2uart.begin();

    //display.clearDisplay();
   // display.display();

    DEBUG_UART.println(F("\r\n!!!!!End of MAIN Setup!!!!!\r\n"));

    Wire.beginTransmission(0x38);
    Wire.write(0xFF); // all led off & all inputs
    Wire.endTransmission(0x38);

    server.on("/listFiles", srv_handle_list_files);
    server.on("/formatLittleFs", []() { if (LittleFS.format()) server.send(200,"text/html", "Format OK"); else server.send(200,"text/html", "format Fail"); });
    server.onNotFound([]() {                              // If the client requests any URI
        if (!handleFileRead(server.uri()))                  // send it if it exists
            server.send(404, "text/plain", "404: Not Found"); // otherwise, respond with a 404 (Not Found) error
    });
    fsBrowser.setup(server); // this contains failsafe upload
    server.begin(HTTP_PORT);
}

uint8_t keyState = 0;
uint8_t keyStateOld = 0;
uint8_t ledState = 0;
uint8_t rawWrite = 0;
uint8_t update_display = 0;

void set_HomeAssistant_switch_state(const String &entityId, bool state);
void toggle_HomeAssistant_switch_state(const String &entityId);

bool state1 = false;
bool state2 = false;
bool state3 = false;
bool state4 = false;
bool state5 = false;
bool state6 = false;
bool state7 = false;
bool state8 = false;

void loop() {
    server.handleClient();
    tcp2uart.BridgeMainTask();
    ArduinoOTA.handle();

    // read and write back to PCF8574A
    Wire.requestFrom(0x38, 1);
    keyState = Wire.read();

    display.setCursor(0, 47);

    //rawWrite = 0xFF; // lower nibble is allways key inputs
    if ((keyState & 0x01) == 0x01) {
        //rawWrite &= 0x7F; 
        //set_HomeAssistant_switch_state("switch.ytterbelysning_framsida_socket_1", state1);
        state1 = !state1;
        display.print("1 ");
    } else display.print("0 ");
    if ((keyState & 0x02) == 0x02) {
        //rawWrite &= 0xBF;
        //set_HomeAssistant_switch_state("switch.ytterbelysning_baksida_socket_1", state2);
        state2 = !state2;
        display.print("1 ");
    } else display.print("0 ");
    if ((keyState & 0x04) == 0x04) {
        //rawWrite &= 0xDF;
        //set_HomeAssistant_switch_state("switch.ytterbelysning_kortsida_socket_1", state3);
        state3 = !state3;
        display.print("1 ");
    } else display.print("0 ");
    if ((keyState & 0x08) == 0x08) {
        //rawWrite &= 0xEF;
        state4 = !state4;
        //toggle_HomeAssistant_switch_state("switch.vaxtbelysning_uppe_socket_1");
        display.print("1 ");
    } else display.print("0 ");
    if ((keyState & 0x10) == 0x10) {
        //rawWrite &= 0x7F; 
        //set_HomeAssistant_switch_state("switch.ytterbelysning_framsida_socket_1", state1);
        state5 = !state5;
        display.print("1 ");
    } else display.print("0 ");
    if ((keyState & 0x20) == 0x20) {
        //rawWrite &= 0xBF;
        //set_HomeAssistant_switch_state("switch.ytterbelysning_baksida_socket_1", state2);
        state6 = !state6;
        display.print("1 ");
    } else display.print("0 ");
    if ((keyState & 0x40) == 0x40) {
        //rawWrite &= 0xDF;
        //set_HomeAssistant_switch_state("switch.ytterbelysning_kortsida_socket_1", state3);
        state7 = !state7;
        display.print("1 ");
    } else display.print("0 ");
    if ((keyState & 0x80) == 0x80) {
        //rawWrite &= 0xEF;
        state8 = !state8;
        
        //toggle_HomeAssistant_switch_state("switch.vaxtbelysning_uppe_socket_1");
        display.print("1 ");
    } else display.print("0 ");
    //Wire.beginTransmission(0x38);
    //Wire.write(rawWrite);
    //Wire.endTransmission(0x38);




    //if (update_display == 1) {
    //    update_display = 0;
        display.display();
    //}
}

void displayPrintHttpState(int httpCode)
{
    if (httpCode > 0) { // ok
        display.setCursor(0,0);
        display.print(httpCode);
        display.print(" OK ");
    }
    else // fail
    {
        display.setCursor(0,0);
        display.print(httpCode);
        display.print(" FAIL ");
    }
    display.display();
}
void setHomeAssistantHttpHeader()
{
    http.addHeader("authorization", F("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIzN2NlMjg4ZGVkMWE0OTBhYmIzNDYxMDNiM2YzMzIzNCIsImlhdCI6MTY2OTkwNjI1OCwiZXhwIjoxOTg1MjY2MjU4fQ.XP-8H5PRQG6tJ8MBYmiN0I4djs-KpahZliTrnPTvlcQ"));
    http.addHeader("Content-Type", "application/json");
}

bool get_HomeAssistant_switch_state(const String &entityId) {
    http.begin(client, F("http://192.168.1.107:8123/api/states/") + entityId);
    setHomeAssistantHttpHeader();
    int httpCode = http.GET();
    
    http.end();

    displayPrintHttpState(httpCode);

    if (httpCode>0) {
        String payload = http.getString();
        http.end();

        DynamicJsonDocument doc(1024);

        deserializeJson( doc, payload);

        JsonObject obj = doc.as<JsonObject>();

        if (obj == NULL) {
            display.setCursor(0,8);
            display.print("json obj null");
            display.display();
            return false;
        }
        String state = obj["state"];

        if (state == NULL) {
            display.setCursor(0,8);
            display.print("json state var null");
            display.display();
            return false;
        } 
        if (state == "ON") return true;

    }
    else
        http.end();

    return false;
}

void toggle_HomeAssistant_switch_state(const String &entityId)
{
    if (get_HomeAssistant_switch_state(entityId) == true)
        set_HomeAssistant_switch_state(entityId, false);
    else
        set_HomeAssistant_switch_state(entityId, true);
}

void set_HomeAssistant_switch_state(const String &entityId, bool state)
{
    if (state == true)
        http.begin(client, F("http://192.168.1.107:8123/api/services/switch/turn_on"));
    else
        http.begin(client, F("http://192.168.1.107:8123/api/services/switch/turn_off"));

    setHomeAssistantHttpHeader();

    int httpCode = 0;

    httpCode = http.POST("{\"entity_id\":\""+entityId+"\"}");
    http.end();

    displayPrintHttpState(httpCode);
}

void oled_LCD_write12digitDec(uint32_t value, uint8_t maxDigits, uint8_t dotPos = 0) {
    uint32_t rest = value;
    uint32_t curr = rest / 100000000000;
    //display.clearDisplay();
    if (maxDigits >= 12)
        display.print(curr);
    rest = rest % 100000000000;
    curr = rest / 10000000000;
    if (maxDigits >= 11)
        display.print(curr);
    if (dotPos == 10) display.print('.');
    rest = rest % 10000000000;
    curr = rest / 1000000000;
    if (maxDigits >= 10)
        display.print(curr);
    if (dotPos == 9) display.print('.');
    rest = rest % 1000000000;
    curr = rest / 100000000;
    if (maxDigits >= 9)
        display.print(curr);
    if (dotPos == 8) display.print('.');
    rest = rest % 100000000;
    curr = rest / 10000000;
    if (maxDigits >= 8)
        display.print(curr);
    if (dotPos == 7) display.print('.');
    rest = rest % 10000000;
    curr = rest / 1000000;
    if (maxDigits >= 7)
        display.print(curr);
    if (dotPos == 6) display.print('.');
    rest = rest % 1000000;
    curr = rest / 100000;
    if (maxDigits >= 6)
        display.print(curr);
    if (dotPos == 5) display.print('.');
    rest = rest % 100000;
    curr = rest / 10000;
    if (maxDigits >= 5)
        display.print(curr);
    if (dotPos == 4) display.print('.');
    rest = rest % 10000;
    curr = rest / 1000;
    if (maxDigits >= 4)
        display.print(curr);
    if (dotPos == 3) display.print('.');
    rest = rest % 1000;
    curr = rest / 100;
    if (maxDigits >= 3)
        display.print(curr);
    if (dotPos == 2) display.print('.');
    rest = rest % 100;
    curr = rest / 10;
    if (maxDigits >= 2)
        display.print(curr);
    if (dotPos == 1) display.print('.');
    rest = rest % 10;
    if (maxDigits >= 1)
        display.print(rest, 10);

}

void checkForUpdates(void)
{
    //EEPROM.put(SPI_FLASH_SEC_SIZE, "hello");

    DEBUG_UART.println(F("checking for updates"));
    String updateUrl = "http://espOtaServer/esp_ota/" + String(ESP.getChipId(), HEX) + ".bin";
    t_httpUpdate_return ret = ESPhttpUpdate.update(client, updateUrl.c_str());
    DEBUG_UART.print(F("HTTP_UPDATE_"));
    switch (ret) {
      case HTTP_UPDATE_FAILED:
        DEBUG_UART.println(F("FAIL Error "));
        DEBUG_UART.printf("(%d): %s", ESPhttpUpdate.getLastError(), ESPhttpUpdate.getLastErrorString().c_str());
        break;

      case HTTP_UPDATE_NO_UPDATES:
        DEBUG_UART.println(F("NO_UPDATES"));
        break;

      case HTTP_UPDATE_OK:
        DEBUG_UART.println(F("OK"));
        break;
    }
}

// called from setup() function
void printESP_info(void) { 
    uint32_t realSize = ESP.getFlashChipRealSize();
    uint32_t ideSize = ESP.getFlashChipSize();
    FlashMode_t ideMode = ESP.getFlashChipMode();
  
    DEBUG_UART.print(F("Flash real id:   ")); DEBUG_UART.printf("%08X\r\n", ESP.getFlashChipId());
    DEBUG_UART.print(F("Flash real size: ")); DEBUG_UART.printf("%u 0\r\n\r\n", realSize);
  
    DEBUG_UART.print(F("Flash ide  size: ")); DEBUG_UART.printf("%u\r\n", ideSize);
    DEBUG_UART.print(F("Flash ide speed: ")); DEBUG_UART.printf("%u\r\n", ESP.getFlashChipSpeed());
    DEBUG_UART.print(F("Flash ide mode:  ")); DEBUG_UART.printf("%s\r\n", (ideMode == FM_QIO ? "QIO" : ideMode == FM_QOUT ? "QOUT" : ideMode == FM_DIO ? "DIO" : ideMode == FM_DOUT ? "DOUT" : "UNKNOWN"));
  
    if(ideSize != realSize)
    {
        DEBUG_UART.println(F("Flash Chip configuration wrong!\r\n"));
    }
    else
    {
        DEBUG_UART.println(F("Flash Chip configuration ok.\r\n"));
    }
    DEBUG_UART.printf(" ESP8266 Chip id = %08X\n", ESP.getChipId());
}

void setup_BasicOTA()
{
    ArduinoOTA.onStart([]() {
        otaPartProcentCount = 0;
        String type;

        if (ArduinoOTA.getCommand() == U_FLASH) {

          type = "sketch";

        } else { // U_SPIFFS

          type = "filesystem";

        }
        // NOTE: if updating SPIFFS this would be the place to unmount SPIFFS using SPIFFS.end()

        DEBUG_UART.println(F("OTA Start\rOTA Progress: "));

    });

    ArduinoOTA.onEnd([]() {

        DEBUG_UART.println("\n100%\nOTA End");

    });

    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {

        //DEBUG_UART.printf("Progress: %u%%\r", (progress / (total / 100)));
        //Serial1.printf("%u%%\r", (progress / (total / 100)));
        DEBUG_UART.print("-");
        if (otaPartProcentCount < 10)
          otaPartProcentCount++;
        else
        {
          otaPartProcentCount = 0;
          DEBUG_UART.printf(" %u%%\r", (progress / (total / 100)));
        }
    });

    ArduinoOTA.onError([](ota_error_t error) {
        DEBUG_UART.printf("OTA Error");
        DEBUG_UART.printf("[%u]: ", error);
        if (error == OTA_AUTH_ERROR) DEBUG_UART.println(F("Auth Failed"));
        else if (error == OTA_BEGIN_ERROR) DEBUG_UART.println(F("Begin Failed"));
        else if (error == OTA_CONNECT_ERROR) DEBUG_UART.println(F("Connect Failed"));
        else if (error == OTA_RECEIVE_ERROR) DEBUG_UART.println(F("Receive Failed"));
        else if (error == OTA_END_ERROR) DEBUG_UART.println(F("End Failed"));
    });

    ArduinoOTA.begin();

    DEBUG_UART.println("Ready");

    DEBUG_UART.print("IP address: ");

    DEBUG_UART.println(WiFi.localIP());
}

void srv_handle_list_files()
{
    String str = "Files:\n";
    Dir dir = LittleFS.openDir("/");
    while (dir.next()) {
        str += dir.fileName();
        str += " / ";
        str += dir.fileSize();
        str += "\n";
    }
    server.send(200, "text/plain", str);
}
String getContentType(String filename) { // convert the file extension to the MIME type
  if (filename.endsWith(".html")) return "text/html";
  else if (filename.endsWith(".css")) return "text/css";
  else if (filename.endsWith(".js")) return "application/javascript";
  else if (filename.endsWith(".ico")) return "image/x-icon";
  else if (filename.endsWith(".gz")) return "application/x-gzip";
  return "text/plain";
}
bool handleFileRead(String path) { // send the right file to the client (if it exists)
  Serial.println("handleFileRead: " + path);
  if (path.endsWith("/")) path += "index.html";          // If a folder is requested, send the index file
  String contentType = getContentType(path);             // Get the MIME type
  String pathWithGz = path + ".gz";
  if (LittleFS.exists(pathWithGz) || LittleFS.exists(path)) { // If the file exists, either as a compressed archive, or normal
    if (LittleFS.exists(pathWithGz))                         // If there's a compressed version available
      path += ".gz";                                         // Use the compressed verion
    File file = LittleFS.open(path, "r");                    // Open the file
    size_t sent = server.streamFile(file, contentType);    // Send it to the client
    file.close();                                          // Close the file again
    Serial.println(String("\tSent file: ") + path);
    return true;
  }
  Serial.println(String("\tFile Not Found: ") + path);   // If the file doesn't exist, return false
  return false;
}

bool load_from_file(String file_name, String &contents) {
  contents = "";
  
  File this_file = LittleFS.open(file_name, "r");
  if (!this_file) { // failed to open the file, retrn empty result
    return false;
  }
  while (this_file.available()) {
      contents += (char)this_file.read();
  }
  
  this_file.close();
  return true;
}

bool write_to_file(String file_name, String contents) {  
  File this_file = LittleFS.open(file_name, "w");
  if (!this_file) { // failed to open the file, return false
    return false;
  }
  int bytesWritten = this_file.print(contents);
 
  if (bytesWritten == 0) { // write failed
      return false;
  }
   
  this_file.close();
  return true;
}