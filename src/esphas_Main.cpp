/* 
 
*/
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WebServer.h>

#include <ArduinoOTA.h>
#include <EEPROM.h>
#include <LittleFS.h>
#include "TCP2UART.h"

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
//#include <Fonts/FreeMono9pt7b.h>

#include "FSBrowser.h"
#include "FileHelpers.h"
#include "OLedHelpers.h"
#include "OtaHelpers.h"
#include "Buttons.h"
#include "HomeAssistant.h"
#include "MainHelpers.h"

FSBrowser fsBrowser;
Adafruit_SSD1306 display(128, 64, &Wire, -1); // -1 = no reset pin
TCP2UART tcp2uart;
ESP8266WebServer server(80);

#define DEBUG_UART Serial1

/*************** SETUP *******************/
void setup() {
    DEBUG_UART.begin(115200);
    DEBUG_UART.println(F("\r\n!!!!!Start of MAIN Setup!!!!!\r\n"));
    LittleFS.begin();
    HomeAssistant::loadHomeAssistantSettings();
    OLedHelpers::setup(display);
    MainHelpers::setup(display);
    MainHelpers::printESP_info();
    MainHelpers::setup_wifi();
    //OtaHelpers::checkForUpdates(client);
    OtaHelpers::setup_BasicOTA();
    Buttons::setup(display, HomeAssistant::execKeyPress);
    HomeAssistant::setup(display, server);
    FileHelpers::setup(server);
    fsBrowser.setup(server); // this contains failsafe upload
    server.begin();
    tcp2uart.begin();
    DEBUG_UART.println(F("\r\n!!!!!End of MAIN Setup!!!!!\r\n"));
}

/***************** LOOP *********************/
void loop() {
    server.handleClient();
    tcp2uart.BridgeMainTask();
    ArduinoOTA.handle();
    Buttons::keyTask();
}
