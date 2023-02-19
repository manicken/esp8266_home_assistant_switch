/* 
 
*/
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WebServer.h>
#include <WebSocketsServer.h>

#include <ArduinoOTA.h>
#include <EEPROM.h>
#include <LittleFS.h>
#include "TCP2UART.h"

//#include <Adafruit_GFX.h>
//#include <Adafruit_SSD1306.h>
//#include <Fonts/FreeMono9pt7b.h>

#include "Main.h"

#include "FSBrowser.h"
#include "FileHelpers.h"
#include "OLedHelpers.h"
#include "OtaHelpers.h"
#include "Buttons.h"
#include "HomeAssistant.h"
#include "MainHelpers.h"
#include "LocalTuya.h"

//FSBrowser fsBrowser; // changed to namespace
TCP2UART tcp2uart;

#define DEBUG_UART Serial1

/*************** SETUP *******************/
void setup() {
    DEBUG_UART.begin(115200);
    DEBUG_UART.println(F("\r\n!!!!!Start of MAIN Setup!!!!!\r\n"));
    LittleFS.begin();
    Main::setup();

    OLedHelpers::setup(Main::display);
    MainHelpers::printESP_info();
    MainHelpers::setup_wifi();
    //OtaHelpers::checkForUpdates(client);
    OtaHelpers::setup_BasicOTA();
    Buttons::setup(HomeAssistant::exec, LocalTuya::exec);
    HomeAssistant::setup();
    LocalTuya::setup();
    FileHelpers::setup();
    FSBrowser::setup(/*Main::webServer*/); // this contains failsafe upload
    
    tcp2uart.begin();

    DEBUG_UART.println(F("\r\n!!!!!End of MAIN Setup!!!!!\r\n"));
}

/***************** LOOP *********************/
void loop() {
    Main::webSocketServer.loop(); 
    Main::webServer.handleClient();
    tcp2uart.BridgeMainTask();
    ArduinoOTA.handle();
    Buttons::keyTask();
}
