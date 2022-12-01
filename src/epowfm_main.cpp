/* 
 
*/
#include <ESP8266WiFi.h>
#include <WiFiManager.h>
#include <ESP8266httpUpdate.h>
#include <ESP8266HTTPClient.h>
#include <EEPROM.h>
#include "TCP2UART.h"
#include "SPI.h"

#include <ArduinoOTA.h>
static int otaPartProcentCount = 0;

#include <ESP8266WebServer.h>

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
//#include <Fonts/FreeMono9pt7b.h>

#include <ArduinoJson.h>


#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 32 // OLED display height, in pixels

#define SCREEN_ADDRESS 0x3C ///< See datasheet for Address; 0x3D for 128x64, 0x3C for 128x32
Adafruit_SSD1306 display(128, 64, &Wire, -1); // -1 = no reset pin

#define DEBUG_UART Serial1

TCP2UART tcp2uart;

extern const char index_html[];
extern const char main_js[];
// QUICKFIX...See https://github.com/esp8266/Arduino/issues/263
#define min(a,b) ((a)<(b)?(a):(b))
#define max(a,b) ((a)>(b)?(a):(b))

#define LED_PIN 5                       // 0 = GPIO0, 2=GPIO2
#define LED_COUNT 50

#define WIFI_TIMEOUT 30000              // checks WiFi every ...ms. Reset after this time, if WiFi cannot reconnect.
#define HTTP_PORT 80

#define DOGM_LCD_CS 0
#define DOGM_LCD_RS 5

#define PULSE_INPUT_A 12
#define PULSE_INPUT_B 13

unsigned long auto_last_change = 0;
unsigned long last_wifi_check_time = 0;

ESP8266WebServer server(HTTP_PORT);
HTTPClient http;
WiFiClient client;

uint32_t pulsesLiter_A = 468;
uint8_t changed_A = 0;
uint32_t count_A = 0;
uint32_t count_A_old = 0;

uint32_t pulsesLiter_B = 360;
uint8_t changed_B = 0;
uint32_t count_B = 0;
uint32_t count_B_old = 0;

uint32_t test = 1234567890;

uint8_t update_display = 0;

unsigned long currTime = 0;
unsigned long deltaTime_second = 0;

void printESP_info(void);
void checkForUpdates(void);
void setup_BasicOTA(void);
void sendOneSpiByte(uint8_t data);

void waterMeter_A_ISR();
void waterMeter_B_ISR();
void DOGM_LCD_write12digitDec(uint32_t value);
void oled_LCD_write12digitDec(uint32_t value, uint8_t maxDigits, uint8_t dotPos);

void setup() {
    DEBUG_UART.begin(115200);
    DEBUG_UART.println(F("\r\n!!!!!Start of MAIN Setup!!!!!\r\n"));


    if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
    {
        delay(2000);
        display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
        delay(2000);
        display.clearDisplay();
        display.display();
        //display.setFont(&FreeMono9pt7b);
        display.setTextSize(1);
        display.setTextColor(WHITE, BLACK);
        //display.setCursor(0, 0);
        /*// Display static text
        display.println("Hello world universe");
        display.setCursor(1, 9);
        display.println("012345678901234567890");
        display.setCursor(0, 17);
        display.println("ABCDEFGHIJKLMNOPQRSTU");
        display.setCursor(0, 25);
        display.println("@!\"#-_+?%&/(){[]};:=");
        display.display();
        */
    }
    else{
        DEBUG_UART.println(F("oled init fail"));
        if (display.begin(SSD1306_SWITCHCAPVCC, 0x3D))
            DEBUG_UART.println(F("oled addr is 0x3D"));
    }
    //DOGM_LCD_init();
    //DOGM_LCD_setCursor(0, 0);
    //DOGM_LCD_writeStr("STARTING...");

    
    printESP_info();
    
    WiFiManager wifiManager;
    DEBUG_UART.println(F("trying to connect to saved wifi"));
    //DOGM_LCD_setCursor(1, 0);
    //DOGM_LCD_writeStr("WIFI CONNECTING.");
    display.setCursor(0, 0);
    display.println("WiFi connecting...");
    display.display();
    if (wifiManager.autoConnect() == true) { // using ESP.getChipId() internally
        display.setCursor(0, 9);
        display.println("OK");
        display.setCursor(0, 17);
        display.println(WiFi.localIP());
        display.display();
        delay(2000);
    } else {
        display.setCursor(0, 9);
        display.println("FAIL");
        display.display();
        delay(2000);
    }
    //checkForUpdates();
    setup_BasicOTA();
    tcp2uart.begin();

    //DOGM_LCD_setCursor(0, 0);
    //DOGM_LCD_writeStr("RAW:");
    display.clearDisplay();
    display.display();

    //display.setCursor(0, 0);
    //display.print("RAW_A:");

    //display.setCursor(0, 8);
    //display.print("RAW_B:");
    
    //DOGM_LCD_setCursor(1, 0);
    //DOGM_LCD_writeStr("LITERS:0000000.0");
    //display.setCursor(0, 16);
    //display.print("LITERS:0000000.0");
    
    //DOGM_LCD_setCursor(2, 0);
    //DOGM_LCD_writeStr("LITER/MIN:0000.0");
    //display.setCursor(0, 24);
    //display.print("LITER/MIN:0000.0");
    /*
    display.setCursor(0, 0);
    oled_LCD_write12digitDec(count_A, 10, 0);
    display.setCursor(0, 16);
    oled_LCD_write12digitDec((count_A * 10) / pulsesLiter_A, 9, 1);

    display.setCursor(68, 0);
    oled_LCD_write12digitDec(count_B, 10, 0);
    display.setCursor(68, 16);
    oled_LCD_write12digitDec((count_B * 10) / pulsesLiter_B, 9, 1);
*/
    //display.setTextSize(2);
    display.display();

    pinMode(PULSE_INPUT_A, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PULSE_INPUT_A), waterMeter_A_ISR, RISING);

    pinMode(PULSE_INPUT_B, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PULSE_INPUT_B), waterMeter_B_ISR, RISING);    
    
    DEBUG_UART.println(F("\r\n!!!!!End of MAIN Setup!!!!!\r\n"));

    Wire.beginTransmission(0x38);
    Wire.write(0xFF); // all led off & all inputs
    Wire.endTransmission(0x38);

}

uint8_t keyState = 0;
uint8_t keyStateOld = 0;
uint8_t ledState = 0;
uint8_t rawWrite = 0;
unsigned long deltaTime_minute = 0;

uint32_t count_A_old2 = 0;
uint32_t count_B_old2 = 0;

uint32_t calcTotalDeciLiters_A = 0;
uint32_t calcTotalDeciLiters_B = 0;

uint32_t calcTotalDeciLiters_old_A = 0;
uint32_t calcTotalDeciLiters_old_B = 0;

uint32_t calcFlow_A = 0;
uint32_t calcFlow_B = 0;

uint32_t calcFlow_old_A = 0;
uint32_t calcFlow_old_B = 0;

uint16_t pressure_A = 0;
uint16_t pressure_B = 0;

uint32_t pressure_average_count = 0;
uint32_t pressure_A_average_current = 0;
uint32_t pressure_B_average_current = 0;

uint32_t pressure_A_average = 0;
uint32_t pressure_B_average = 0;

uint32_t pressure_A_average_old = 0;
uint32_t pressure_B_average_old = 0;

String urlApi = "";
int8_t anyChanged = 0;

void set_HomeAssistant_switch_state(const String &entityId, bool state);
void toggle_HomeAssistant_switch_state(const String &entityId);

bool state1 = false;
bool state2 = false;
bool state3 = false;
bool state4 = false;

void loop() {
    tcp2uart.BridgeMainTask();
    ArduinoOTA.handle();
/*
    if (tcp2uart.uartMessageReceived == true) {
        tcp2uart.uartMessageReceived = false;
        if (tcp2uart.serialRxBuff[0] == '@' && // start of message
            tcp2uart.serialRxBuff[1] == 'S' && // Slave response
            tcp2uart.serialRxBuff[2] == 'P' && // Pressure
            tcp2uart.serialRxBuff[3] == 'S' ) { // Sensor
            for (int i = 5; i < 14; i++)
                tcp2uart.serialRxBuff[i] -= 0x30;
            pressure_A = tcp2uart.serialRxBuff[5] * 1000 + tcp2uart.serialRxBuff[6] * 100 + tcp2uart.serialRxBuff[7] * 10 + tcp2uart.serialRxBuff[8];
            pressure_B = tcp2uart.serialRxBuff[10] * 1000 + tcp2uart.serialRxBuff[11] * 100 + tcp2uart.serialRxBuff[12] * 10 + tcp2uart.serialRxBuff[13];

            if (pressure_average_count == 0) {
                pressure_A_average_current = pressure_A;
                pressure_B_average_current = pressure_B;
                pressure_average_count = 1;
            } else if (pressure_average_count == 10) {
                pressure_average_count = 0;
                pressure_A_average = pressure_A_average_current / 10;
                pressure_B_average = pressure_B_average_current / 10;
                pressure_A_average_current = 0;
                pressure_B_average_current = 0;
            } else {
                pressure_average_count++;
                pressure_A_average_current += pressure_A;
                pressure_B_average_current += pressure_B;
            }
            
        }
    }
    */
    currTime = millis();


/*
    if (changed_A == 1) {
        changed_A = 0;
        //DOGM_LCD_setCursor(0, 4);
        //DOGM_LCD_write12digitDec(count);
        //DOGM_LCD_writeStr("000000000000");
        display.setCursor(0, 0);
        oled_LCD_write12digitDec(count_A, 10, 0);
        display.setCursor(0, 16);
        calcTotalDeciLiters_A = (count_A * 10) / pulsesLiter_A;
        oled_LCD_write12digitDec(calcTotalDeciLiters_A, 9, 1);
        update_display = 1;
    }

    if (changed_B == 1) {
        changed_B = 0;
        //DOGM_LCD_setCursor(0, 4);
        //DOGM_LCD_write12digitDec(count);
        //DOGM_LCD_writeStr("000000000000");
        display.setCursor(68, 0);
        oled_LCD_write12digitDec(count_B, 10, 0);
        display.setCursor(68, 16);
        calcTotalDeciLiters_B = (count_B * 10) / pulsesLiter_B;
        oled_LCD_write12digitDec(calcTotalDeciLiters_B, 9, 1);
        update_display = 1;
    }

    if (currTime - deltaTime_second >= 1000) {
        deltaTime_second = currTime;
        display.setCursor(0, 8);
        oled_LCD_write12digitDec(pressure_A, 4, 0);
        display.setCursor(36, 8);
        oled_LCD_write12digitDec(pressure_A_average, 4, 0);
        display.setCursor(68, 8);
        oled_LCD_write12digitDec(pressure_B, 4, 0);
        display.setCursor(104, 8);
        oled_LCD_write12digitDec(pressure_B_average, 4, 0);

        display.setCursor(30, 24);
        calcFlow_A = ((count_A-count_A_old) * 10 * 60)/pulsesLiter_A;
        oled_LCD_write12digitDec(calcFlow_A, 4, 1);
        display.setCursor(98, 24);
        calcFlow_B = ((count_B-count_B_old) * 10 * 60)/pulsesLiter_B;
        oled_LCD_write12digitDec(calcFlow_B, 4, 1);

        update_display = 1;
        count_A_old = count_A;
        count_B_old = count_B;
    }
    */
    if (currTime - deltaTime_minute >= 30000) {
        deltaTime_minute = currTime;
/*
        urlApi = "";
        anyChanged = 0;
        if (count_A != count_A_old2) {
            count_A_old2 = count_A;
            urlApi += "&field1=" + String(count_A);
            anyChanged = 1;
        }
        if (count_B != count_B_old2) {
            count_B_old2 = count_B;
            urlApi += "&field2=" + String(count_B);
            anyChanged = 1;
        }
        if (calcTotalDeciLiters_A != calcTotalDeciLiters_old_A) {
            calcTotalDeciLiters_old_A = calcTotalDeciLiters_A;
            urlApi += "&field3=" + String((float)calcTotalDeciLiters_A/10.0f, 1);
            anyChanged = 1;
        }
        if (calcTotalDeciLiters_B != calcTotalDeciLiters_old_B) {
            calcTotalDeciLiters_old_B = calcTotalDeciLiters_B;
            urlApi += "&field4=" + String((float)calcTotalDeciLiters_B/10.0f, 1);
            anyChanged = 1;
        }
        if (calcFlow_A != calcFlow_old_A) {
            calcFlow_old_A = calcFlow_A;
            urlApi += "&field5=" + String((float)calcFlow_A/10.0f, 1);
            anyChanged = 1;
        }
        if (calcFlow_B != calcFlow_old_B) {
            calcFlow_old_B = calcFlow_B;
            urlApi += "&field6=" + String((float)calcFlow_B/10.0f, 1);
            anyChanged = 1;
        }
        if (pressure_A_average != pressure_A_average_old) {
            pressure_A_average_old = pressure_A_average;
            urlApi += "&field7=" + String(pressure_A_average);
            anyChanged = 1;
        }
        if (pressure_B_average != pressure_B_average_old) {
            pressure_B_average_old = pressure_B_average;
            urlApi += "&field8=" + String(pressure_B_average);
            anyChanged = 1;
        }

        if (anyChanged == 1) {
            String url = "http://api.thingspeak.com/update?api_key=FUP6M75ELGKWA2J8" + urlApi;
            http.begin(client, url);
            
            int httpCode = http.GET();
            if (httpCode > 0) {
                DEBUG_UART.println(F("\r\nGET request sent\r\n"));
                DEBUG_UART.println(urlApi);
            }
            else {
                DEBUG_UART.println(F("\r\nGET request FAILURE\r\n"));
                DEBUG_UART.println(urlApi);
            }
            http.end();
        }*/
    }
    
    if (update_display == 1) {
        update_display = 0;
        display.display();
    }


    // read and write back to PCF8574A
    Wire.requestFrom(0x38, 1);
    keyState = Wire.read();

    rawWrite = 0xFF; // lower nibble is allways key inputs
    if ((keyState & 0x01) == 0x01) {
        rawWrite &= 0x7F; 
        set_HomeAssistant_switch_state("switch.ytterbelysning_framsida_socket_1", state1);
        state1 = !state1;
    }
    if ((keyState & 0x02) == 0x02) {
        rawWrite &= 0xBF;
        set_HomeAssistant_switch_state("switch.ytterbelysning_baksida_socket_1", state2);
        state2 = !state2;
    }
    if ((keyState & 0x04) == 0x04) {
        rawWrite &= 0xDF;
        set_HomeAssistant_switch_state("switch.ytterbelysning_kortsida_socket_1", state3);
        state3 = !state3;
    }
    if ((keyState & 0x08) == 0x08) {
        rawWrite &= 0xEF;
        toggle_HomeAssistant_switch_state("switch.vaxtbelysning_uppe_socket_1");

    }
    Wire.beginTransmission(0x38);
    Wire.write(rawWrite);
    Wire.endTransmission(0x38);

/*
    digitalWrite(DOGM_LCD_CS, LOW); // enable Slave Select
    digitalWrite(DOGM_LCD_RS, LOW);
    SPI.transfer(0xAA);

    digitalWrite(DOGM_LCD_RS, HIGH);
    SPI.transfer(0x55);
    digitalWrite(DOGM_LCD_CS, HIGH); // disable Slave Select
    */
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

void ICACHE_RAM_ATTR waterMeter_A_ISR() {
    changed_A = 1;
    count_A++;
}

void ICACHE_RAM_ATTR waterMeter_B_ISR() {
    changed_B = 1;
    count_B++;
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

void sendOneSpiByte(uint8_t data) {
    digitalWrite(DOGM_LCD_CS, LOW); // enable chip Select
    SPI.transfer(data);
    digitalWrite(DOGM_LCD_CS, HIGH); // disable chip Select
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
