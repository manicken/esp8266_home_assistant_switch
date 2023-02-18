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
#include "LocalTuya.h"
#include "WebSocketHelper.h"

FSBrowser fsBrowser;
Adafruit_SSD1306 display(128, 64, &Wire, -1); // -1 = no reset pin
TCP2UART tcp2uart;
ESP8266WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81); // websocket used for remote debugging through webpage

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t lenght);

#define DEBUG_UART Serial1
/*
void execKeyPress(int index)
{
    //HomeAssistant::execKeyPress(index);
    if (index < 4)
        LocalTuya::exec(index, 1);
    else
        LocalTuya::exec(index-4, 0);
}*/
/*************** SETUP *******************/
void setup() {
    DEBUG_UART.begin(115200);
    DEBUG_UART.println(F("\r\n!!!!!Start of MAIN Setup!!!!!\r\n"));
    LittleFS.begin();
    
    OLedHelpers::setup(display);
    MainHelpers::setup(display);
    MainHelpers::printESP_info();
    MainHelpers::setup_wifi();
    //OtaHelpers::checkForUpdates(client);
    OtaHelpers::setup_BasicOTA();
    Buttons::setup(display, server, HomeAssistant::exec, LocalTuya::exec);
    HomeAssistant::setup(display, server);
    LocalTuya::setup(display, server);
    FileHelpers::setup(server);
    fsBrowser.setup(server); // this contains failsafe upload
    server.begin();
    tcp2uart.begin();
    webSocket.begin();                          // start the websocket server
    webSocket.onEvent(webSocketEvent);          // if there's an incomming websocket message, go to function 'webSocketEvent'
    WebSocketHelper::webSocket = &webSocket;
    DEBUG_UART.println(F("\r\n!!!!!End of MAIN Setup!!!!!\r\n"));
}

/***************** LOOP *********************/
void loop() {
    webSocket.loop(); 
    server.handleClient();
    tcp2uart.BridgeMainTask();
    ArduinoOTA.handle();
    Buttons::keyTask();
}


void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t lenght) { // When a WebSocket message is received
  switch (type) {
    case WStype_DISCONNECTED:             // if the websocket is disconnected
      DEBUG_UART.printf("[%u] Disconnected!\n", num);
      break;
    case WStype_CONNECTED: {              // if a new websocket connection is established
        IPAddress ip = webSocket.remoteIP(num);
        DEBUG_UART.printf("[%u] Connected from %d.%d.%d.%d url: %s\n", num, ip[0], ip[1], ip[2], ip[3], payload);
      }
      break;
    case WStype_TEXT:                     // if new text data is received
      DEBUG_UART.printf("[%u] get Text: %s\n", num, payload);
      break;
  }
}